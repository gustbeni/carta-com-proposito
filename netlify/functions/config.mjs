// Diz ao site se o envio da carta por e-mail está ligado (variáveis EMAIL_USUARIO e EMAIL_SENHA_APP)
// e se o pagamento está no plano B (PagBank: só Pix, pede o CPF)
import { resposta, usaReserva } from "../lib/comum.mjs";
import { emailLigado } from "../lib/correio.mjs";

export default async () => resposta({ email: emailLigado(), reserva: usaReserva() || undefined });
export const config = { path: "/api/config" };
