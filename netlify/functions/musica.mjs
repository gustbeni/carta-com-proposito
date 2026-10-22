// Recebe um link do Spotify e devolve a mesma música no YouTube (que toca completa)
import { resposta, spotifyParaYouTube } from "../lib/comum.mjs";

export default async (req) => {
  const s = new URL(req.url).searchParams.get("s") || "";
  if (!/^track\/[A-Za-z0-9]{10,40}$/.test(s)) return resposta({ erro: "link" }, 400);
  try { const r = await spotifyParaYouTube(s); return r ? resposta(r) : resposta({ erro: "nao-achou" }, 404); }
  catch (e) { console.error(e); return resposta({ erro: "falhou" }, 502); }
};
export const config = { path: "/api/musica" };
