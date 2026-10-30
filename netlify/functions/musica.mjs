// Recebe um link do Spotify e devolve a mesma música no YouTube (que toca completa).
// Com ?y=ID, devolve só o nome do vídeo do YouTube (para mostrar na carta).
import { resposta, spotifyParaYouTube, tituloYouTube } from "../lib/comum.mjs";

export default async (req) => {
  const q = new URL(req.url).searchParams, y = q.get("y") || "";
  if (y) { // só o nome de um vídeo do YouTube
    if (!/^[A-Za-z0-9_-]{11}$/.test(y)) return resposta({ erro: "link" }, 400);
    const t = await tituloYouTube(y); return t ? resposta({ y, t }) : resposta({ erro: "nao-achou" }, 404);
  }
  const s = q.get("s") || "";
  if (!/^track\/[A-Za-z0-9]{10,40}$/.test(s)) return resposta({ erro: "link" }, 400);
  try { const r = await spotifyParaYouTube(s); return r ? resposta(r) : resposta({ erro: "nao-achou" }, 404); }
  catch (e) { console.error(e); return resposta({ erro: "falhou" }, 502); }
};
export const config = { path: "/api/musica" };
