// Cria a carta (ainda não paga) e gera o Pix ou o link do cartão no Mercado Pago
import { randomBytes } from "node:crypto";
import { DESCRICAO, loja, resposta, enderecoSite, limparCarta, mp, dadosNavegador, planoDe, valorDo, guardarNoAcesso } from "../lib/comum.mjs";

export default async (req) => {
  if (req.method !== "POST") return resposta({ erro: "metodo" }, 405);
  let b; try { b = await req.json(); } catch { return resposta({ erro: "dados" }, 400); }
  const plano = planoDe(b.plano), PRECO = valorDo(plano);
  const carta = limparCarta(b.carta, plano);
  if (carta === "grande") return resposta({ erro: "grande" }, 413);
  if (!carta) return resposta({ erro: "carta" }, 400);
  const email = String(b.email || "").trim().slice(0, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return resposta({ erro: "email" }, 400);
  const metodo = b.metodo === "cartao" ? "cartao" : "pix";

  const id = randomBytes(9).toString("base64url");
  const chave = randomBytes(16).toString("hex");
  const site = enderecoSite(req);
  const reg = { carta, chave, email, querEmail: b.enviarEmail === true, plano, pago: false, criado: Date.now(), nav: dadosNavegador(req), valor: PRECO };
  await loja().setJSON("c/" + id, reg);
  await guardarNoAcesso(email, id).catch(e => console.error("acesso", e.message)); // para aparecer em /meuacesso

  try {
    if (metodo === "pix") {
      const valor = PRECO.toFixed(2);
      const pedidoMP = {
        type: "online", processing_mode: "automatic", total_amount: valor, external_reference: id,
        description: plano === "premium" ? DESCRICAO + " Premium" : DESCRICAO,
        payer: { email },
        items: [{ title: plano === "premium" ? DESCRICAO + " Premium" : DESCRICAO, unit_price: valor, quantity: 1, description: "Carta on-line com QR code" }],
        transactions: { payments: [{ amount: valor, payment_method: { id: "pix", type: "bank_transfer" }, expiration_time: "PT30M" }] },
      };
      let o;
      try { o = await mp("/v1/orders", { metodo: "POST", idem: id, corpo: pedidoMP }); }
      catch (e) { // se o Mercado Pago recusar o nome do produto, cria sem ele para não perder a venda
        delete pedidoMP.items; delete pedidoMP.description;
        o = await mp("/v1/orders", { metodo: "POST", idem: id + "b", corpo: pedidoMP });
      }
      reg.mpOrder = o.id;
      await loja().setJSON("c/" + id, reg);
      const pm = (((o.transactions || {}).payments || [])[0] || {}).payment_method || {};
      return resposta({ id, chave, pix: { qr: pm.qr_code_base64, copia: pm.qr_code } });
    }
    const pref = await mp("/checkout/preferences", {
      metodo: "POST", idem: id,
      corpo: {
        items: [{ id: plano === "premium" ? "carta-premium" : "carta", title: plano === "premium" ? DESCRICAO + " Premium" : DESCRICAO, quantity: 1, unit_price: PRECO, currency_id: "BRL" }],
        payer: { email }, external_reference: id,
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
