// Entrega a carta para quem escaneou o QR code (só se estiver paga)
import { loja, resposta, idValido, confirmarPagamento } from "../lib/comum.mjs";

export default async (req) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!idValido(id)) return resposta({ erro: "id" }, 404);
  const reg = await loja().get("c/" + id, { type: "json" });
  if (!reg) return resposta({ erro: "nao-encontrada" }, 404);
  let pago = reg.pago;
  if (!pago) { try { pago = await confirmarPagamento(id, reg); } catch {} }
  if (!pago) return resposta({ erro: "nao-paga" }, 404);
  const c = reg.carta || {};
  const abre = typeof c.ab === "string" ? Date.parse(c.ab) : NaN;
  if (abre && abre > Date.now()) {
    // ainda não chegou o dia: entrega só o necessário para a contagem regressiva
    return resposta({ bloqueada: true, ab: new Date(abre).toISOString(), p: c.p, d: c.d, o: c.o });
  }
  return resposta({ carta: reg.carta });
};
export const config = { path: "/api/carta" };
