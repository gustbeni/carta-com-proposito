// Funções compartilhadas: Mercado Pago + armazenamento das cartas (Netlify Blobs)
import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";
import { emailLigado, enviarCartaPorEmail } from "./correio.mjs";

export const PRECO = Number(process.env.PRECO || "21.99"); // valor cobrado de verdade (carta Padrão)
export const PRECO_PREMIUM = Number(process.env.PRECO_PREMIUM || "29.99"); // carta Premium
export const DIAS_PADRAO = 90; // a carta Padrão fica no ar por 3 meses depois do pagamento; a Premium é vitalícia
export const planoDe = p => p === "premium" ? "premium" : "padrao";
export const valorDo = plano => planoDe(plano) === "premium" ? PRECO_PREMIUM : PRECO;
// a carta Padrão (só pedidos com plano, feitos depois que os pacotes existiram) expira 3 meses depois do pagamento
export function expirou(reg) {
  if (!reg || reg.plano !== "padrao") return false;
  return Date.now() > (reg.pagoEm || reg.criado || 0) + DIAS_PADRAO * 864e5;
}
export const DESCRICAO = "Carta com Propósito";
export const DIAS_PARA_EDITAR = 7;
const MP = "https://api.mercadopago.com";

export const loja = () => getStore({ name: "cartas", consistency: "strong" });

export function resposta(dados, status = 200) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export function idValido(id) { return typeof id === "string" && /^[A-Za-z0-9_-]{8,40}$/.test(id); }

export function enderecoSite(req) {
  return (process.env.URL || new URL(req.url).origin).replace(/\/$/, "");
}

// confere se a carta tem um formato razoável e não é grande demais.
// O que é do Premium (mais polaroides e o mini filme) só fica se o pedido for Premium.
export function limparCarta(c, plano) {
  if (!c || typeof c !== "object" || Array.isArray(c)) return null;
  if (!Array.isArray(c.v) || !c.v.length || typeof c.p !== "string" || !c.p.trim()) return null;
  const texto = JSON.stringify(c);
  if (texto.length > 20000) return "grande";
  const limpa = JSON.parse(texto);
  delete limpa.pl; // quem diz se é Premium é o pedido, nunca a carta
  const premium = planoDe(plano) === "premium";
  if (Array.isArray(limpa.fu)) limpa.fu = limpa.fu.slice(0, premium ? 6 : 3);
  if (Array.isArray(limpa.fc)) limpa.fc = limpa.fc.slice(0, premium ? 6 : 3);
  if (premium && Array.isArray(limpa.mf)) limpa.mf = limpa.mf.slice(0, 7); else delete limpa.mf;
  return limpa;
}

export async function mp(caminho, { metodo = "GET", corpo, idem } = {}) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error("Falta a variável MP_ACCESS_TOKEN no Netlify");
  const headers = { Authorization: "Bearer " + token, "Content-Type": "application/json" };
  if (idem) headers["X-Idempotency-Key"] = idem;
  const r = await fetch(MP + caminho, { method: metodo, headers, body: corpo ? JSON.stringify(corpo) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.error("Mercado Pago", r.status, JSON.stringify(j).slice(0, 500)); throw new Error("mp " + r.status); }
  return j;
}

// procura no Mercado Pago um pagamento aprovado para esta carta
// Pix: API de Orders (reg.mpOrder). Cartão: Checkout Pro (busca de pagamentos por external_reference).
// Depois de pago, manda o e-mail com o link e o QR code (se a pessoa pediu e se ainda não foi).
export async function confirmarPagamento(id, reg, { email = true } = {}) {
  if (reg.pago) { if (email) await mandarEmail(id, reg); return true; }
  const valorPedido = Number(reg.valor) || 17.99; // pedidos antigos foram criados a 17,99
  let aprovado = null;
  if (reg.mpOrder) {
    try {
      const o = await mp("/v1/orders/" + encodeURIComponent(reg.mpOrder));
      if (o.external_reference === id && o.status === "processed" && Number(o.total_amount) >= valorPedido - 0.01) aprovado = o.id;
    } catch (e) {}
  }
  if (!aprovado) {
    try {
      const j = await mp("/v1/payments/search?sort=date_created&criteria=desc&external_reference=" + encodeURIComponent(id));
      const ok = (j.results || []).find(p => p.status === "approved" && p.external_reference === id && Number(p.transaction_amount) >= valorPedido - 0.01);
      if (ok) aprovado = ok.id;
    } catch (e) {}
  }
  if (!aprovado) return false;
  reg.pago = true; reg.pagoEm = Date.now(); reg.mpId = aprovado;
  await loja().setJSON("c/" + id, reg);
  try { await avisarMeta(id, reg); } catch (e) { console.error("Meta CAPI", e.message); }
  if (email) await mandarEmail(id, reg);
  return true;
}

// E-mail com o link e o QR code para quem comprou. Só manda uma vez (e desiste depois de 3 erros);
// "forcar" é o botão "Receber no meu e-mail" da tela da carta paga.
function prazo(p, ms) {
  let t; const limite = new Promise((_, nao) => { t = setTimeout(() => nao(new Error("demorou")), ms); });
  return Promise.race([p, limite]).finally(() => clearTimeout(t));
}
export async function mandarEmail(id, reg, { forcar = false } = {}) {
  if (!emailLigado() || !reg.pago || !reg.email) return false;
  if (!forcar && (!reg.querEmail || reg.emailOk || (reg.emailErros || 0) >= 3)) return !!reg.emailOk;
  const atual = await loja().get("c/" + id, { type: "json" }).catch(() => null);
  if (atual) Object.assign(reg, atual); // outra chamada pode ter acabado de mandar
  if (!forcar && reg.emailOk) return true;
  try {
    const site = (process.env.URL || "https://carta-com-proposito.netlify.app").replace(/\/$/, "");
    await prazo(enviarCartaPorEmail({ link: site + "/c/" + id, emailDestino: reg.email, para: (reg.carta || {}).p, plano: reg.plano }), 9000);
    reg.emailOk = Date.now(); reg.emailEnvios = (reg.emailEnvios || 0) + 1;
  } catch (e) {
    console.error("E-mail da carta não foi", e.code || (e.message === "demorou" ? "demorou" : "erro"), e.responseCode || ""); // sem o endereço de ninguém
    reg.emailErros = (reg.emailErros || 0) + 1;
  }
  await loja().setJSON("c/" + id, reg);
  return !!reg.emailOk;
}

// guarda dados do navegador de quem está comprando, para o Meta reconhecer a compra
export function dadosNavegador(req) {
  const h = req.headers, ck = {};
  String(h.get("cookie") || "").split(";").forEach(p => { const i = p.indexOf("="); if (i > 0) ck[p.slice(0, i).trim()] = p.slice(i + 1).trim(); });
  return {
    ip: h.get("x-nf-client-connection-ip") || (h.get("x-forwarded-for") || "").split(",")[0].trim() || undefined,
    ua: (h.get("user-agent") || "").slice(0, 400) || undefined,
    fbp: ck._fbp || undefined, fbc: ck._fbc || undefined,
  };
}

// API de Conversões: o próprio servidor avisa o Meta que a compra foi paga
// (conta a venda mesmo se a pessoa fechou o site antes do Pix cair)
const sha = v => createHash("sha256").update(String(v).trim().toLowerCase()).digest("hex");
export async function avisarMeta(id, reg) {
  const token = process.env.META_CAPI_TOKEN;
  if (!token || reg.metaOk) return;
  const pixel = process.env.META_PIXEL_ID || "1595171231774957";
  const n = reg.nav || {};
  const user_data = { external_id: [sha(id)] };
  if (reg.email) user_data.em = [sha(reg.email)];
  if (n.ip) user_data.client_ip_address = n.ip;
  if (n.ua) user_data.client_user_agent = n.ua;
  if (n.fbp) user_data.fbp = n.fbp;
  if (n.fbc) user_data.fbc = n.fbc;
  const corpo = { data: [{
    event_name: "Purchase", event_time: Math.floor(Date.now() / 1000), event_id: "compra_" + id,
    action_source: "website", event_source_url: (process.env.URL || "https://carta-com-proposito.netlify.app") + "/",
    user_data, custom_data: { currency: "BRL", value: Number(reg.valor) || 17.99, content_name: DESCRICAO },
  }] };
  if (process.env.META_TEST_CODE) corpo.test_event_code = process.env.META_TEST_CODE;
  const r = await fetch("https://graph.facebook.com/v23.0/" + pixel + "/events?access_token=" + encodeURIComponent(token), {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.error("Meta CAPI", r.status, JSON.stringify(j).slice(0, 400)); return; }
  reg.metaOk = true;
  await loja().setJSON("c/" + id, reg);
}

// Spotify só toca 30 segundos para quem não está logado. Procuramos a mesma música no YouTube,
// que toca completa e começa sozinha quando a carta é aberta.
const YT_CHAVE = process.env.YOUTUBE_KEY || "AIzaSyB4hj6bF9qJPjQ_xouOqqlUJ9WlTl5yYb0";
const desfazer = t => String(t || "").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
export async function nomeSpotify(tipoId) {
  const m = /^track\/([A-Za-z0-9]{10,40})$/.exec(tipoId || ""); if (!m) return null;
  const url = "https://open.spotify.com/track/" + m[1];
  try {
    const r = await fetch(url, { headers: { "User-Agent": "facebookexternalhit/1.1", "Accept-Language": "pt-BR,pt;q=0.9" } });
    const h = await r.text();
    const tit = desfazer((h.match(/<meta property="og:title" content="([^"]*)"/) || [])[1]);
    const desc = desfazer((h.match(/<meta property="og:description" content="([^"]*)"/) || [])[1]);
    const artista = desc.split("·")[0].trim();
    if (tit) return { musica: tit, artista };
    const t2 = desfazer((h.match(/<title>([^<]*)<\/title>/) || [])[1]);
    const m2 = /^(.*?) - .*? by (.*?) \| Spotify$/.exec(t2); if (m2) return { musica: m2[1], artista: m2[2] };
  } catch (e) {}
  try {
    const j = await (await fetch("https://open.spotify.com/oembed?url=" + encodeURIComponent(url))).json();
    if (j && j.title) return { musica: desfazer(j.title), artista: "" };
  } catch (e) {}
  return null;
}
export async function buscarYouTube(q) {
  const u = "https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=5&regionCode=BR&q=" + encodeURIComponent(q) + "&key=" + encodeURIComponent(YT_CHAVE);
  const r = await fetch(u, { headers: { Referer: "https://carta-com-proposito.netlify.app/" } });
  if (!r.ok) { console.error("YouTube busca", r.status); return null; }
  const j = await r.json();
  const it = (j.items || []).find(x => x.id && x.id.videoId); if (!it) return null;
  return { y: it.id.videoId, t: desfazer(it.snippet.title), c: desfazer(it.snippet.channelTitle) };
}
// várias sugestões para a busca pelo nome da música. Se o limite diário do YouTube acabou, avisa com { limite: true }
export async function sugestoesYouTube(q, n = 6) {
  const u = "https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&regionCode=BR&relevanceLanguage=pt&maxResults=" + n + "&q=" + encodeURIComponent(q) + "&key=" + encodeURIComponent(YT_CHAVE);
  const r = await fetch(u, { headers: { Referer: "https://carta-com-proposito.netlify.app/" } });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    const motivo = (((j.error || {}).errors || [])[0] || {}).reason || "";
    console.error("YouTube sugestões", r.status, motivo);
    if (r.status === 403 || r.status === 429) throw Object.assign(new Error("limite"), { limite: true });
    throw new Error("youtube " + r.status);
  }
  const j = await r.json();
  return (j.items || []).filter(x => x.id && x.id.videoId).map(x => ({
    y: x.id.videoId, t: desfazer(x.snippet.title), c: desfazer(x.snippet.channelTitle),
    img: (((x.snippet.thumbnails || {}).default || {}).url || "").replace(/^http:/, "https:"),
  }));
}
export async function spotifyParaYouTube(tipoId) {
  const n = await nomeSpotify(tipoId); if (!n || !n.musica) return null;
  const achou = await buscarYouTube((n.musica + " " + (n.artista || "")).trim());
  return achou ? { ...achou, musica: n.musica, artista: n.artista } : null;
}
