// O site pergunta aqui, a cada poucos segundos, se o pagamento já caiu
import { loja, resposta, idValido, confirmarPagamento } from "../lib/comum.mjs";

export default async (req) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!idValido(id)) return resposta({ erro: "id" }, 400);
  const reg = await loja().get("c/" + id, { type: "json" });
  if (!reg) return resposta({ erro: "nao-encontrada" }, 404);
  try {
    const pago = await confirmarPagamento(id, reg);
    return resposta({ pago, email: pago && reg.emailOk ? "enviado" : undefined });
  }
  catch { return resposta({ pago: false }); }
};
export const config = { path: "/api/status" };
