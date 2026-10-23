// Diz ao site se o envio da carta por e-mail está ligado (variáveis EMAIL_USUARIO e EMAIL_SENHA_APP)
import { resposta } from "../lib/comum.mjs";
import { emailLigado } from "../lib/correio.mjs";

export default async () => resposta({ email: emailLigado() });
export const config = { path: "/api/config" };
