// Página /meuacesso: a pessoa digita o e-mail da compra e vê as cartas pagas (link, QR code e edição por 7 dias)
import { loja, acessos, resposta, chaveEmail, sha, confirmarPagamento, expirou, dadosNavegador, DIAS_PADRAO, DIAS_PARA_EDITAR } from "../lib/comum.mjs";

const LIMITE_POR_HORA = 40; // consultas por aparelho (IP) por hora

export default async (req) => {
  if (req.method !== "POST") return resposta({ erro: "metodo" }, 405);
  let b; try { b = await req.json(); } catch { return resposta({ erro: "dados" }, 400); }
  const email = String(b.email || "").trim().toLowerCase().slice(0, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return resposta({ erro: "email" }, 400);
  if (!(await dentroDoLimite(req))) return resposta({ erro: "limite" }, 429);
  await indexarAntigas();

  const ind = (await acessos().get(chaveEmail(email), { type: "json" }).catch(() => null)) || { ids: [] };
  const regs = await Promise.all(ind.ids.slice(-60).map(id => loja().get("c/" + id, { type: "json" }).then(r => [id, r]).catch(() => [id, null])));
  const cartas = [];
  for (const [id, reg] of regs) {
    if (!reg || String(reg.email || "").trim().toLowerCase() !== email) continue;
    // pedido recente que ainda não aparece como pago: confere no Mercado Pago (o webhook pode ter atrasado)
    if (!reg.pago && Date.now() - (reg.criado || 0) < 864e5) { try { await confirmarPagamento(id, reg); } catch {} }
    if (!reg.pago) continue;
    const pagoEm = reg.pagoEm || reg.criado || 0;
    cartas.push({
      id, chave: reg.chave, plano: reg.plano || null, pagoEm,
      expira: reg.plano === "padrao" ? pagoEm + DIAS_PADRAO * 864e5 : null, expirada: expirou(reg),
      editarAte: pagoEm + DIAS_PARA_EDITAR * 864e5, emailOk: !!reg.emailOk,
      carta: reg.plano === "premium" ? { ...reg.carta, pl: "p" } : reg.carta,
    });
  }
  cartas.sort((a, b) => b.pagoEm - a.pagoEm);
  return resposta({ cartas });
};

// para ninguém ficar testando e-mails sem parar
async function dentroDoLimite(req) {
  try {
    const hora = Math.floor(Date.now() / 36e5), k = "lim/" + sha(dadosNavegador(req).ip || "sem-ip").slice(0, 24);
    const l = await acessos().get(k, { type: "json" });
    const n = l && l.h === hora ? l.n + 1 : 1;
    if (n > LIMITE_POR_HORA) return false;
    await acessos().setJSON(k, { h: hora, n });
  } catch {}
  return true;
}

// uma vez só: liga ao e-mail as cartas compradas antes desta página existir
async function indexarAntigas() {
  const st = acessos();
  if (await st.get("pronto").catch(() => null)) return;
  const { blobs } = await loja().list({ prefix: "c/" });
  const mapa = {};
  for (let i = 0; i < blobs.length; i += 25) {
    const lote = await Promise.all(blobs.slice(i, i + 25).map(x => loja().get(x.key, { type: "json" }).then(r => [x.key.slice(2), r]).catch(() => [x.key.slice(2), null])));
    for (const [id, reg] of lote) if (reg && reg.email) (mapa[chaveEmail(reg.email)] = mapa[chaveEmail(reg.email)] || []).push(id);
  }
  for (const [k, ids] of Object.entries(mapa)) {
    const atual = (await st.get(k, { type: "json" }).catch(() => null)) || { ids: [] };
    await st.setJSON(k, { ids: [...new Set([...ids, ...atual.ids])] });
  }
  await st.set("pronto", String(Date.now()));
}

export const config = { path: "/api/acesso" };
