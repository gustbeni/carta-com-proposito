// O Mercado Pago avisa aqui quando um pagamento muda (libera a carta mesmo se a pessoa fechou o site)
import { loja, resposta, idValido, mp, confirmarPagamento } from "../lib/comum.mjs";

export default async (req) => {
  try {
    const u = new URL(req.url);
    let pid = u.searchParams.get("data.id") || u.searchParams.get("id");
    if (req.method === "POST") { const b = await req.json().catch(() => ({})); pid = (b.data && b.data.id) || pid; }
    if (!pid || !/^\d+$/.test(String(pid))) return resposta({ ok: true });
    const p = await mp("/v1/payments/" + pid); // confere direto no Mercado Pago, não confia no aviso
    const id = p.external_reference;
    if (idValido(id)) { const reg = await loja().get("c/" + id, { type: "json" }); if (reg) await confirmarPagamento(id, reg); }
  } catch (e) { console.error(e); }
  return resposta({ ok: true });
};
export const config = { path: "/api/aviso" };
