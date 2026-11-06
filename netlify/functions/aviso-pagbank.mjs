// Plano B: o PagBank avisa aqui quando um pedido muda (libera a carta mesmo se a pessoa fechou o site).
// Não confia no conteúdo do aviso: busca o pedido direto no PagBank e confere tudo no confirmarPagamento.
import { loja, resposta, idValido, pagbank, confirmarPagamento } from "../lib/comum.mjs";

export default async (req) => {
  try {
    const b = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const oid = String(b.id || req.headers.get("x-product-id") || "");
    if (!/^ORDE_[A-Za-z0-9-]+$/.test(oid)) return resposta({ ok: true });
    const o = await pagbank("/orders/" + encodeURIComponent(oid));
    const id = o.reference_id;
    if (idValido(id)) {
      const reg = await loja().get("c/" + id, { type: "json" });
      if (reg && reg.pbOrder === oid) await confirmarPagamento(id, reg);
    }
  } catch (e) { console.error(e); }
  return resposta({ ok: true });
};
export const config = { path: "/api/aviso-pagbank" };
