// Botão "Receber no meu e-mail": manda de novo o link e o QR code para quem comprou (com a chave do aparelho)
import { loja, resposta, idValido, confirmarPagamento, mandarEmail } from "../lib/comum.mjs";
import { emailLigado } from "../lib/correio.mjs";

export default async (req) => {
  if (req.method !== "POST") return resposta({ erro: "metodo" }, 405);
  if (!emailLigado()) return resposta({ erro: "desligado" }, 503);
  let b; try { b = await req.json(); } catch { return resposta({ erro: "dados" }, 400); }
  if (!idValido(b.id)) return resposta({ erro: "id" }, 400);
  const reg = await loja().get("c/" + b.id, { type: "json" });
  if (!reg || typeof b.chave !== "string" || b.chave !== reg.chave) return resposta({ erro: "chave" }, 403);
  if (!(await confirmarPagamento(b.id, reg, { email: false }).catch(() => false))) return resposta({ erro: "nao-paga" }, 402);
  if ((reg.emailEnvios || 0) >= 5) return resposta({ erro: "limite" }, 429);
  reg.querEmail = true;
  const ok = await mandarEmail(b.id, reg, { forcar: true });
  return ok ? resposta({ ok: true }) : resposta({ erro: "envio" }, 502);
};
export const config = { path: "/api/email" };
