// Lembrete automático: a cada 20 minutos, procura Pix que venceram sem pagamento (2 horas)
// e manda UM e-mail para quem comprou, lembrando que a carta continua salva no aparelho.
// Não manda se: a pessoa pagou (este pedido ou outro mais novo com o mesmo e-mail), comprou sem e-mail,
// já recebeu o lembrete, ou o pedido tem mais de 24 horas.
import { loja, pendentes, acessos, chaveEmail, confirmarPagamento } from "../lib/comum.mjs";
import { emailLigado, enviarLembrete } from "../lib/correio.mjs";

const ESPERA = 2 * 3600e3 + 10 * 60e3; // o Pix vale 2 horas; espera mais 10 minutos
const LIMITE = 24 * 3600e3;

async function pagouOutro(email, id, criado) {
  try {
    const a = await acessos().get(chaveEmail(email), { type: "json" });
    for (const outro of (a && a.ids) || []) {
      if (outro === id) continue;
      const r = await loja().get("c/" + outro, { type: "json" }).catch(() => null);
      if (r && (r.criado || 0) >= criado - 60e3 && (r.pago || await confirmarPagamento(outro, r).catch(() => false))) return true;
    }
  } catch (e) {}
  return false;
}

export default async () => {
  if (!emailLigado()) return;
  const site = (process.env.URL || "https://carta-com-proposito.netlify.app").replace(/\/$/, "");
  const { blobs } = await pendentes().list({ prefix: "p/" });
  for (const b of blobs) {
    const id = b.key.slice(2);
    const fora = () => pendentes().delete(b.key).catch(() => {});
    try {
      const reg = await loja().get("c/" + id, { type: "json" });
      if (!reg || reg.pago || reg.lembreteEm || !reg.email || reg.semEmail) { await fora(); continue; }
      const idade = Date.now() - (reg.criado || 0);
      if (idade < ESPERA) continue;
      if (idade > LIMITE) { await fora(); continue; }
      if (await confirmarPagamento(id, reg).catch(() => false)) { await fora(); continue; }
      if (await pagouOutro(reg.email, id, reg.criado || 0)) { await fora(); continue; }
      reg.lembreteEm = Date.now(); // marca antes de mandar, para nunca mandar duas vezes
      await loja().setJSON("c/" + id, reg);
      await fora();
      await enviarLembrete({ site, emailDestino: reg.email, para: (reg.carta || {}).p });
    } catch (e) { console.error("lembrete", id, e.message); }
  }
};
export const config = { schedule: "*/20 * * * *" };
