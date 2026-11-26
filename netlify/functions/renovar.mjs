// "Tornar ela para sempre": quem abre uma carta Padrão que passou do prazo pode pagar R$ 9,99 no Pix
// e a carta volta a abrir, agora para sempre. POST cria o Pix; GET pergunta se já caiu.
import { DESCRICAO, loja, resposta, idValido, mp, temRecurso, PRECO_RENOVA, refRenova, confirmarRenovacao } from "../lib/comum.mjs";

export default async (req) => {
  const u = new URL(req.url);
  let id = u.searchParams.get("id");
  if (req.method === "POST") { const b = await req.json().catch(() => ({})); id = b.id || id; }
  if (!idValido(id)) return resposta({ erro: "id" }, 400);
  const reg = await loja().get("c/" + id, { type: "json" });
  if (!reg || !reg.pago || reg.plano !== "padrao") return resposta({ erro: "nao-pode" }, 404);
  if (req.method !== "POST") {
    try { return resposta({ pago: await confirmarRenovacao(id, reg) }); } catch { return resposta({ pago: false }); }
  }
  if (temRecurso(reg, "vit")) return resposta({ pago: true });
  const valor = PRECO_RENOVA.toFixed(2);
  const email = reg.email || "cliente." + id.toLowerCase().replace(/[^a-z0-9]/g, "") + "@cartacomproposito.com.br";
  try {
    const o = await mp("/v1/orders", {
      metodo: "POST", idem: refRenova(id) + "." + Date.now(),
      corpo: {
        type: "online", processing_mode: "automatic", total_amount: valor, external_reference: refRenova(id),
        description: DESCRICAO + " para sempre", payer: { email },
        transactions: { payments: [{ amount: valor, payment_method: { id: "pix", type: "bank_transfer" }, expiration_time: "PT30M" }] },
      },
    });
    const pm = (((o.transactions || {}).payments || [])[0] || {}).payment_method || {};
    if (!pm.qr_code) return resposta({ erro: "pix_recusado" }, 402);
    reg.renova = { order: o.id, criado: Date.now() };
    await loja().setJSON("c/" + id, reg);
    return resposta({ pix: { qr: pm.qr_code_base64, copia: pm.qr_code } });
  } catch (e) {
    console.error("renovar", e.message);
    return resposta({ erro: "pagamento" }, 502);
  }
};
export const config = { path: "/api/renovar" };
