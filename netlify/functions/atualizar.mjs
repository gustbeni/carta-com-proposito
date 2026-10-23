// Salva mudanças na carta depois de paga (até 7 dias), usando a chave secreta que ficou no celular de quem comprou
import { loja, resposta, idValido, limparCarta, confirmarPagamento, DIAS_PARA_EDITAR } from "../lib/comum.mjs";

export default async (req) => {
  if (req.method !== "POST") return resposta({ erro: "metodo" }, 405);
  let b; try { b = await req.json(); } catch { return resposta({ erro: "dados" }, 400); }
  if (!idValido(b.id)) return resposta({ erro: "id" }, 400);
  const reg = await loja().get("c/" + b.id, { type: "json" });
  if (!reg || typeof b.chave !== "string" || b.chave !== reg.chave) return resposta({ erro: "chave" }, 403);
  if (!(await confirmarPagamento(b.id, reg, { email: false }).catch(() => false))) return resposta({ erro: "nao-paga" }, 402);
  const carta = limparCarta(b.carta);
  if (carta === "grande") return resposta({ erro: "grande" }, 413);
  if (!carta) return resposta({ erro: "carta" }, 400);
  const igual = JSON.stringify(carta) === JSON.stringify(reg.carta);
  if (!igual) {
    if (Date.now() - (reg.pagoEm || reg.criado) > DIAS_PARA_EDITAR * 864e5) return resposta({ erro: "prazo" }, 409);
    reg.carta = carta; reg.editado = Date.now();
    await loja().setJSON("c/" + b.id, reg);
  }
  return resposta({ ok: true });
};
export const config = { path: "/api/atualizar" };
