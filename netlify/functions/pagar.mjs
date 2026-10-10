// Cria a carta (ainda não paga) e gera o Pix ou o link do cartão no Mercado Pago
import { randomBytes } from "node:crypto";
import { PRECO, DESCRICAO, loja, resposta, enderecoSite, limparCarta, mp } from "../lib/comum.mjs";

export default async (req) => {
  if (req.method !== "POST") return resposta({ erro: "metodo" }, 405);
  let b; try { b = await req.json(); } catch { return resposta({ erro: "dados" }, 400); }
  const carta = limparCarta(b.carta);
  if (carta === "grande") return resposta({ erro: "grande" }, 413);
  if (!carta) return resposta({ erro: "carta" }, 400);
  const email = String(b.email || "").trim().slice(0, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return resposta({ erro: "email" }, 400);
  const metodo = b.metodo === "cartao" ? "cartao" : "pix";

  const id = randomBytes(9).toString("base64url");
  const chave = randomBytes(16).toString("hex");
  const site = enderecoSite(req);
  const reg = { carta, chave, email, pago: false, criado: Date.now() };
  await loja().setJSON("c/" + id, reg);

  try {
    if (metodo === "pix") {
      const p = await mp("/v1/payments", {
        metodo: "POST", idem: id,
        corpo: {
          transaction_amount: PRECO, description: DESCRICAO, payment_method_id: "pix",
          payer: { email }, external_reference: id,
          notification_url: site.startsWith("https://") ? site + "/api/aviso" : undefined,
        },
      });
      const t = (p.point_of_interaction || {}).transaction_data || {};
      return resposta({ id, chave, pix: { qr: t.qr_code_base64, copia: t.qr_code } });
    }
    const pref = await mp("/checkout/preferences", {
      metodo: "POST", idem: id,
      corpo: {
        items: [{ id: "carta", title: DESCRICAO, quantity: 1, unit_price: PRECO, currency_id: "BRL" }],
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
