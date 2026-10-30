// Entrega a carta para quem escaneou o QR code (só se estiver paga)
import { loja, resposta, idValido, confirmarPagamento, spotifyParaYouTube, tituloYouTube, expirou, cartaEntregue } from "../lib/comum.mjs";

export default async (req) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!idValido(id)) return resposta({ erro: "id" }, 404);
  const reg = await loja().get("c/" + id, { type: "json" });
  if (!reg) return resposta({ erro: "nao-encontrada" }, 404);
  let pago = reg.pago;
  if (!pago) { try { pago = await confirmarPagamento(id, reg); } catch {} }
  if (!pago) return resposta({ erro: "nao-paga" }, 404);
  const c = reg.carta || {};
  // carta Padrão: fica no ar por 3 meses depois do pagamento
  if (expirou(reg)) return resposta({ expirada: true, p: c.p, d: c.d });
  const abre = typeof c.ab === "string" ? Date.parse(c.ab) : NaN;
  if (abre && abre > Date.now()) {
    // ainda não chegou o dia: entrega só o necessário para a contagem regressiva
    return resposta({ bloqueada: true, ab: new Date(abre).toISOString(), p: c.p, d: c.d, o: c.o });
  }
  // Música do Spotify: troca pela mesma música no YouTube (toca completa e começa sozinha)
  let carta = reg.carta;
  if (typeof c.ml === "string" && c.ml.startsWith("s:track/")) {
    let conv = reg.musicaYT && reg.musicaYT.de === c.ml ? reg.musicaYT : null;
    if (!conv || (conv.falhou && Date.now() - conv.falhou > 6 * 3600e3)) {
      try { const r = await spotifyParaYouTube(c.ml.slice(2)); conv = r ? { de: c.ml, y: r.y, t: r.t, mt: r.musica ? r.musica + (r.artista ? " · " + r.artista : "") : "" } : { de: c.ml, falhou: Date.now() }; reg.musicaYT = conv; await loja().setJSON("c/" + id, reg); } catch (e) {}
    }
    if (conv && conv.y) carta = { ...c, ml: "y:" + conv.y, mt: c.mt || conv.mt || conv.t || "" };
  }
  // nome da música para o card da carta (cartas sem o nome guardado): busca uma vez e guarda
  if (typeof carta.ml === "string" && carta.ml.startsWith("y:") && !carta.mt) {
    let nm = reg.musicaNome && reg.musicaNome.de === carta.ml ? reg.musicaNome : null;
    if (!nm) { const t = await tituloYouTube(carta.ml.slice(2)); nm = { de: carta.ml, t }; reg.musicaNome = nm; try { await loja().setJSON("c/" + id, reg); } catch (e) {} }
    if (nm.t) carta = { ...carta, mt: nm.t };
  }
  return resposta({ carta: cartaEntregue(reg, carta) });
};
export const config = { path: "/api/carta" };
