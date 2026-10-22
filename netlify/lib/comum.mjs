// Funções compartilhadas: Mercado Pago + armazenamento das cartas (Netlify Blobs)
import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

export const PRECO = Number(process.env.PRECO || "21.99"); // valor cobrado de verdade
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

// confere se a carta tem um formato razoável e não é grande demais
export function limparCarta(c) {
  if (!c || typeof c !== "object" || Array.isArray(c)) return null;
  if (!Array.isArray(c.v) || !c.v.length || typeof c.p !== "string" || !c.p.trim()) return null;
  const texto = JSON.stringify(c);
  if (texto.length > 20000) return "grande";
  return JSON.parse(texto);
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
export async function confirmarPagamento(id, reg) {
  if (reg.pago) return true;
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
  return true;
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
