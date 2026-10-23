// E-mail para quem comprou, com o link e o QR code da carta.
// Sai de uma conta do Gmail com "senha de app": variáveis EMAIL_USUARIO e EMAIL_SENHA_APP no Netlify.
import nodemailer from "nodemailer";
import QRCode from "qrcode";

export const emailLigado = () => !!(process.env.EMAIL_USUARIO && process.env.EMAIL_SENHA_APP);

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function textoEmail(link, para, plano) {
  const nome = String(para || "").trim() || "quem você ama";
  const assunto = `Sua carta para ${nome} está pronta 💌`;
  const texto = [
    `Sua carta para ${nome} está pronta!`,
    "",
    `Envie este link para ${nome}:`,
    link,
    "",
    "O QR code da carta vai junto, como imagem. Você pode imprimir e entregar com um presente: é só apontar a câmera do celular.",
    "",
    plano === "padrao" ? "A carta Padrão fica no ar por 3 meses depois do pagamento." : plano === "premium" ? "Sua carta Premium é vitalícia: o link funciona para sempre." : "",
    "Guarde este e-mail. Você pode mudar a carta por 7 dias depois do pagamento, no mesmo aparelho em que comprou.",
    "",
    "Com carinho,",
    "Carta com Propósito",
  ].join("\n");
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:0;background:#F6EFE6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6EFE6;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#3A1331;border-radius:20px;overflow:hidden;font-family:Georgia,'Times New Roman',serif">
  <tr><td style="padding:34px 28px 10px;text-align:center">
    <p style="margin:0;font:600 11px/1.4 Arial,sans-serif;letter-spacing:3px;text-transform:uppercase;color:#ECC16B">Carta com Propósito</p>
    <h1 style="margin:14px 0 0;font:italic 600 30px/1.2 Georgia,serif;color:#F7D995">Sua carta para ${esc(nome)} está pronta</h1>
  </td></tr>
  <tr><td style="padding:14px 28px 6px;text-align:center;font:400 16px/1.55 Arial,sans-serif;color:#F2DCCB">
    Agora é só entregar. Envie este link para ${esc(nome)}:
  </td></tr>
  <tr><td style="padding:12px 28px;text-align:center">
    <a href="${esc(link)}" style="display:inline-block;padding:15px 30px;border-radius:999px;background:#ECC16B;color:#3A0B2B;font:700 16px/1 Arial,sans-serif;text-decoration:none">Abrir a carta</a>
    <p style="margin:14px 0 0;font:400 13px/1.4 Arial,sans-serif;word-break:break-all"><a href="${esc(link)}" style="color:#F7D995">${esc(link)}</a></p>
  </td></tr>
  <tr><td style="padding:18px 28px 8px;text-align:center">
    <div style="display:inline-block;padding:12px;background:#FFFFFF;border-radius:14px"><img src="cid:qrcarta" width="200" height="200" alt="QR code da carta" style="display:block;width:200px;height:200px"></div>
    <p style="margin:12px 0 0;font:400 14px/1.5 Arial,sans-serif;color:#E5CBBE">Este é o QR code da carta. Imprima e entregue junto com um presente: é só apontar a câmera do celular.</p>
  </td></tr>
  <tr><td style="padding:18px 28px 30px;text-align:center;font:400 13px/1.55 Arial,sans-serif;color:#B8919F">
    ${plano === "padrao" ? "A carta Padrão fica no ar por 3 meses depois do pagamento.<br>" : plano === "premium" ? "Sua carta Premium é vitalícia: o link funciona para sempre.<br>" : ""}Guarde este e-mail. Você pode mudar a carta por 7 dias depois do pagamento, no mesmo aparelho em que comprou.
  </td></tr>
</table>
</td></tr></table></body></html>`;
  return { assunto, texto, html };
}

// "transporte" só é passado nos testes; no site o e-mail sai pelo Gmail
export async function enviarCartaPorEmail({ link, emailDestino, para, plano, transporte }) {
  const t = transporte || nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USUARIO, pass: String(process.env.EMAIL_SENHA_APP || "").replace(/\s+/g, "") },
  });
  const qr = await QRCode.toBuffer(link, { width: 480, margin: 2, errorCorrectionLevel: "M", color: { dark: "#221A17", light: "#FFFFFF" } });
  const { assunto, texto, html } = textoEmail(link, para, plano);
  return t.sendMail({
    from: { name: "Carta com Propósito", address: process.env.EMAIL_USUARIO || "carta@exemplo.com" },
    to: emailDestino,
    subject: assunto,
    text: texto,
    html,
    attachments: [{ filename: "qrcode-da-carta.png", content: qr, contentType: "image/png", cid: "qrcarta" }],
  });
}
