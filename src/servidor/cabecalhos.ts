/**
 * Cabeçalhos de segurança aplicados a todas as respostas do servidor.
 *
 * A política de conteúdo (CSP) libera só o que o app usa: os próprios arquivos,
 * as fontes do Google e a API pública de feriados (brasilapi.com.br).
 * Os scripts inline são permitidos porque o React injeta o estado inicial da
 * página assim (detalhes em SECURITY.md).
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob:",
  "connect-src 'self' https://brasilapi.com.br",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const FIXOS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "cross-origin-opener-policy": "same-origin",
};

export function aplicarCabecalhosDeSeguranca(resposta: Response): Response {
  // Algumas respostas (ex.: redirecionamentos) têm cabeçalhos imutáveis.
  let r = resposta;
  try {
    r.headers.set("x-teste-mutavel", "1");
    r.headers.delete("x-teste-mutavel");
  } catch {
    r = new Response(resposta.body, resposta);
  }
  const h = r.headers;
  for (const [nome, valor] of Object.entries(FIXOS)) if (!h.has(nome)) h.set(nome, valor);
  if (process.env["NODE_ENV"] === "production") {
    if (!h.has("content-security-policy")) h.set("content-security-policy", CSP);
    if (process.env["COOKIE_SEGURO"] !== "false") {
      h.set("strict-transport-security", "max-age=31536000; includeSubDomains");
    }
  }
  return r;
}
