// Busca a música pelo nome no YouTube e devolve sugestões. Guarda as buscas por 14 dias para gastar menos do limite
// diário do YouTube. Quando o limite acaba, responde { limite: true } até o dia seguinte e o site fica só com o link.
import { getStore } from "@netlify/blobs";
import { resposta, sugestoesYouTube } from "../lib/comum.mjs";

const hojeNoYouTube = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }); // o limite renova à meia-noite do Pacífico

export default async (req) => {
  const q = String(new URL(req.url).searchParams.get("q") || "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (q.length < 2) return resposta({ itens: [] });
  const store = getStore({ name: "buscas" });
  const chave = "q/" + q.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").trim().replace(/ /g, "-").slice(0, 70);
  try {
    const guardada = await store.get(chave, { type: "json" });
    if (guardada && Date.now() - guardada.em < 14 * 864e5) return resposta({ itens: guardada.itens });
    const lim = await store.get("limite", { type: "json" });
    if (lim && lim.dia === hojeNoYouTube()) return resposta({ limite: true });
    const itens = await sugestoesYouTube(q);
    await store.setJSON(chave, { em: Date.now(), itens });
    return resposta({ itens });
  } catch (e) {
    if (e.limite) { await store.setJSON("limite", { dia: hojeNoYouTube() }).catch(() => {}); return resposta({ limite: true }); }
    console.error("busca de música", e.message);
    return resposta({ erro: "falhou" }, 502);
  }
};
export const config = { path: "/api/buscar" };
