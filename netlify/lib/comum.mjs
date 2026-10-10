// Funções compartilhadas: Mercado Pago + armazenamento das cartas (Netlify Blobs)
import { getStore } from "@netlify/blobs";

export const PRECO = Number(process.env.PRECO || "17.99"); // valor cobrado de verdade
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
export async function confirmarPagamento(id, reg) {
  if (reg.pago) return true;
  const j = await mp("/v1/payments/search?sort=date_created&criteria=desc&external_reference=" + encodeURIComponent(id));
  const ok = (j.results || []).find(p => p.status === "approved" && p.external_reference === id && Number(p.transaction_amount) >= PRECO - 0.01);
  if (!ok) return false;
  reg.pago = true; reg.pagoEm = Date.now(); reg.mpId = ok.id;
  await loja().setJSON("c/" + id, reg);
  return true;
}
