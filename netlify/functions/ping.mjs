// Chamado pelo site quando alguém abre a página (no máximo a cada 5 minutos por aparelho).
// Serve só para conferir os Pix pendentes e mandar o aviso "Pix não pago" na hora certa,
// sem função agendada. A própria conferência roda no máximo a cada 5 minutos no total.
import { verPendentesZap } from "../lib/comum.mjs";

export default async () => {
  await Promise.race([verPendentesZap().catch(e => console.error("zap", e.message)), new Promise(r => setTimeout(r, 8000))]);
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
};
export const config = { path: "/api/ping" };
