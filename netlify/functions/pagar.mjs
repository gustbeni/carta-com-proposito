// Cria a carta (ainda não paga) e gera o Pix ou o link do cartão no Mercado Pago
import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { DESCRICAO, loja, pendentes, resposta, enderecoSite, limparCarta, mp, dadosNavegador, planoDe, valorDo, extrasDe, guardarNoAcesso, usaReserva, pagbank, cpfValido, zapValido, verPendentesZap, DIAS_PADRAO, blackAtivo } from "../lib/comum.mjs";

export default async (req, context) => {
  // aproveita a chamada para ver se algum Pix ficou 1 hora sem pagar (aviso de WhatsApp para o dono)
  const verZap = verPendentesZap().catch(e => console.error("zap", e.message));
  if (context && context.waitUntil) context.waitUntil(verZap);
  if (req.method !== "POST") return resposta({ erro: "metodo" }, 405);
  let b; try { b = await req.json(); } catch { return resposta({ erro: "dados" }, 400); }
  const plano = planoDe(b.plano), extras0 = extrasDe(b.extras, plano);
  /* Black Novembro: toda Padrão nova já sai vitalícia, sem cobrar */
  const extras = blackAtivo() && plano !== "premium" && !extras0.includes("vit") ? extras0.concat("vit") : extras0;
  const PRECO = valorDo(plano, extras);
  const carta = limparCarta(b.carta, plano, extras);
  if (carta === "grande") return resposta({ erro: "grande" }, 413);
  if (!carta) return resposta({ erro: "carta" }, 400);
  // "Não tenho e-mail": a carta é criada sem e-mail (não aparece no Meu acesso nem recebe o e-mail);
  // o Mercado Pago exige um e-mail do pagador, então vai um endereço genérico só para ele.
  const semEmail = b.semEmail === true;
  const email = semEmail ? "" : String(b.email || "").trim().slice(0, 120);
  if (!semEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return resposta({ erro: "email" }, 400);
  const reserva = usaReserva(); // plano B (PagBank): só Pix, com CPF
  const metodo = !reserva && b.metodo === "cartao" ? "cartao" : "pix";
  const cpf = reserva ? cpfValido(b.cpf) : "";
  if (reserva && !cpf) return resposta({ erro: "cpf" }, 400);

  const id = randomBytes(9).toString("base64url");
  const chave = randomBytes(16).toString("hex");
  const site = enderecoSite(req);
  const whats = zapValido(b.whats);
  const reg = { carta, chave, email, semEmail, whats: whats || undefined, zapTok: whats ? randomBytes(12).toString("hex") : undefined, querEmail: !semEmail && b.enviarEmail === true, plano, extras, diasPadrao: DIAS_PADRAO, pago: false, criado: Date.now(), nav: dadosNavegador(req), valor: PRECO };
  await loja().setJSON("c/" + id, reg);
  if (email) await guardarNoAcesso(email, id).catch(e => console.error("acesso", e.message)); // para aparecer em /meuacesso
  const emailMP = email || "cliente." + id.toLowerCase().replace(/[^a-z0-9]/g, "") + "@cartacomproposito.com.br";

  try {
    if (reserva) {
      const nome = plano === "premium" ? DESCRICAO + " Premium" : DESCRICAO;
      const centavos = Math.round(PRECO * 100);
      const vence = new Date(Date.now() + 2 * 36e5).toISOString().replace(/\.\d{3}Z$/, "Z"); // 2 horas, como no Mercado Pago
      const base = {
        reference_id: id,
        customer: { name: "Cliente Carta com Proposito", email: emailMP, tax_id: cpf },
        items: [{ reference_id: plano, name: nome, quantity: 1, unit_amount: centavos }],
        notification_urls: site.startsWith("https://") ? [site + "/api/aviso-pagbank"] : undefined,
      };
      let o;
      try { // formato novo (cobrança Pix); se o PagBank recusar, tenta o formato antigo (qr_codes)
        o = await pagbank("/orders", { metodo: "POST", idem: id, corpo: { ...base, charges: [{ reference_id: id, description: nome, amount: { value: centavos, currency: "BRL" }, payment_method: { type: "PIX", pix: { expiration_date: vence } } }] } });
      } catch (e) {
        o = await pagbank("/orders", { metodo: "POST", idem: id + "q", corpo: { ...base, qr_codes: [{ amount: { value: centavos }, expiration_date: vence }] } });
      }
      const ch = (o.charges || [])[0] || {};
      const copia = (ch.qr_code && ch.qr_code.text) || ((o.qr_codes || [])[0] || {}).text || "";
      if (!copia) throw new Error("PagBank sem código Pix");
      reg.pbOrder = o.id; reg.gateway = "pagbank";
      await loja().setJSON("c/" + id, reg);
      if (whats) await pendentes().setJSON("p/" + id, { criado: reg.criado }).catch(e => console.error("pendentes", e.message));
      const qr = (await QRCode.toDataURL(copia, { margin: 1, width: 360 })).split(",")[1];
      return resposta({ id, chave, pix: { qr, copia } });
    }
    if (metodo === "pix") {
      const valor = PRECO.toFixed(2);
      const pedidoMP = {
        type: "online", processing_mode: "automatic", total_amount: valor, external_reference: id,
        description: plano === "premium" ? DESCRICAO + " Premium" : DESCRICAO,
        payer: { email: emailMP },
        items: [{ title: plano === "premium" ? DESCRICAO + " Premium" : DESCRICAO, unit_price: valor, quantity: 1, description: "Carta on-line com QR code" }],
        transactions: { payments: [{ amount: valor, payment_method: { id: "pix", type: "bank_transfer" }, expiration_time: "PT2H" }] },
      };
      // O antifraude do Mercado Pago às vezes recusa o Pix (status "failed", sem QR code).
      // Tentativas: normal; sem o nome do produto; e com o e-mail genérico da loja (como no "Não tenho e-mail").
      const qrDe = o => ((((o || {}).transactions || {}).payments || [])[0] || {}).payment_method || {};
      const tentar = async (corpo, idem) => { try { return await mp("/v1/orders", { metodo: "POST", idem, corpo }); } catch (e) { console.error("pix", idem, e.message); return null; } };
      let o = await tentar(pedidoMP, id);
      if (!qrDe(o).qr_code) { delete pedidoMP.items; delete pedidoMP.description; o = await tentar(pedidoMP, id + "b") || o; }
      const generico = "cliente." + id.toLowerCase().replace(/[^a-z0-9]/g, "") + "@cartacomproposito.com.br";
      if (!qrDe(o).qr_code && emailMP !== generico) { o = await tentar({ ...pedidoMP, payer: { email: generico } }, id + "c") || o; }
      if (o && o.id) reg.mpOrder = o.id;
      if (!qrDe(o).qr_code) {
        reg.pixRecusado = Date.now();
        await loja().setJSON("c/" + id, reg);
        console.error("pix recusado", id, o && o.status);
        return resposta({ erro: "pix_recusado" }, 402);
      }
      await loja().setJSON("c/" + id, reg);
      // aviso de WhatsApp para o dono (verPendentesZap). O lembrete por e-mail (netlify/desligado/lembrete.mjs) continua desligado.
      if (whats) await pendentes().setJSON("p/" + id, { criado: reg.criado }).catch(e => console.error("pendentes", e.message));
      const pm = (((o.transactions || {}).payments || [])[0] || {}).payment_method || {};
      return resposta({ id, chave, pix: { qr: pm.qr_code_base64, copia: pm.qr_code } });
    }
    const pref = await mp("/checkout/preferences", {
      metodo: "POST", idem: id,
      corpo: {
        items: [{ id: plano === "premium" ? "carta-premium" : "carta", title: plano === "premium" ? DESCRICAO + " Premium" : DESCRICAO, quantity: 1, unit_price: PRECO, currency_id: "BRL" }],
        payer: { email: emailMP }, external_reference: id,
        payment_methods: { excluded_payment_types: [{ id: "ticket" }] }, // sem boleto: demora dias e a carta é presente na hora
        back_urls: { success: site + "/?pedido=" + id, pending: site + "/?pedido=" + id, failure: site + "/?pedido=" + id },
        auto_return: "approved", statement_descriptor: "CARTA PROPOSITO",
        notification_url: site.startsWith("https://") ? site + "/api/aviso" : undefined,
      },
    });
    return resposta({ id, chave, link: pref.init_point });
  } catch (e) {
    console.error(e);
    return resposta({ erro: "pagamento" }, 502);
  }
};
export const config = { path: "/api/pagar" };
