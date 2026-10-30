/**
 * Envio dos e-mails de acesso (convite, redefinição de senha, troca de e-mail)
 * pelo Resend. Sem RESEND_API_KEY/EMAIL_REMETENTE, o link é só registrado no
 * log do servidor, o que serve para testes locais.
 */

function escHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type Modelo = { assunto: string; titulo: string; texto: string; botao: string };

const MODELOS: Record<"convite" | "recuperacao" | "troca_email", Modelo> = {
  convite: {
    assunto: "Você foi convidado para o TH Flow",
    titulo: "Boas-vindas ao TH Flow",
    texto:
      "Você recebeu acesso ao TH Flow. Clique no botão abaixo para criar sua senha. O link vale por 24 horas.",
    botao: "Criar minha senha",
  },
  recuperacao: {
    assunto: "Redefinição de senha do TH Flow",
    titulo: "Redefinir sua senha",
    texto:
      "Recebemos um pedido para redefinir sua senha. Se não foi você, ignore este e-mail. O link vale por 1 hora.",
    botao: "Redefinir senha",
  },
  troca_email: {
    assunto: "Confirme seu novo e-mail no TH Flow",
    titulo: "Confirmar novo e-mail",
    texto:
      "Clique no botão abaixo para confirmar este endereço como seu novo e-mail de acesso ao TH Flow. O link vale por 24 horas.",
    botao: "Confirmar e-mail",
  },
};

export async function enviarEmailDeAcesso(
  tipo: keyof typeof MODELOS,
  para: string,
  link: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const chave = process.env["RESEND_API_KEY"];
  const remetente = process.env["EMAIL_REMETENTE"];
  if (!chave || !remetente) {
    console.warn(
      `[email] envio desligado (sem RESEND_API_KEY/EMAIL_REMETENTE). ${tipo} para ${para}: ${link}`,
    );
    return { ok: true };
  }
  const m = MODELOS[tipo];
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#23254d">
  <p style="font-size:18px;font-weight:bold;margin:0 0 8px">${escHtml(m.titulo)}</p>
  <p style="margin:0 0 20px">${escHtml(m.texto)}</p>
  <a href="${escHtml(link)}" style="display:inline-block;background:#eab343;color:#23254d;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:bold">${escHtml(m.botao)}</a>
</div>`;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: remetente, to: [para], subject: m.assunto, html }),
    });
    if (!r.ok) return { ok: false, erro: `Resend respondeu ${r.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}
