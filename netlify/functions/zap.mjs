// Botão "Mandar WhatsApp" do aviso de Pix não pago: confere a chave do pedido e abre o WhatsApp
// de quem comprou com a mensagem pronta. O número fica só no pedido (nunca vai para o ntfy).
import { loja, idValido } from "../lib/comum.mjs";

const pagina = (t) => new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font:16px system-ui;padding:32px;text-align:center">${t}</body>`, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });

export default async (req) => {
  const u = new URL(req.url), id = u.searchParams.get("id"), k = u.searchParams.get("k") || "";
  if (!idValido(id)) return pagina("Link inválido.");
  const reg = await loja().get("c/" + id, { type: "json" }).catch(() => null);
  if (!reg || !reg.whats || !reg.zapTok || k !== reg.zapTok) return pagina("Link inválido.");
  if (reg.pago) return pagina("Boa notícia: esta carta já foi paga. Não precisa mandar mensagem. 💌");
  const site = (process.env.URL || "https://carta-com-proposito.netlify.app").replace(/\/$/, "");
  const para = String((reg.carta || {}).p || "").trim().slice(0, 40);
  const msg = `Oi! Tudo bem? Eu sou Gustavo Benites, dono do site Carta com Propósito 💌\n\nVi que você montou uma carta${para ? " para " + para : ""} no nosso site, mas o Pix não foi concluído. Ela continua salva no seu celular: é só abrir o site de novo e tocar em pagar. Se o código tiver vencido, um novo é gerado na hora 👉 ${site}\n\nSe teve alguma dificuldade, me chama aqui que eu te ajudo!`;
  return new Response(null, { status: 302, headers: { location: "https://wa.me/" + reg.whats + "?text=" + encodeURIComponent(msg), "cache-control": "no-store" } });
};
export const config = { path: "/api/zap" };
