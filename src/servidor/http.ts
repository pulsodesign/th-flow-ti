import { obterSessao } from "./autenticacao";

/** Cabeçalho que o app envia em toda chamada que altera dados (proteção contra CSRF). */
export const CABECALHO_APP = "x-thflow-requisicao";

export function json(dados: unknown, status = 200, extras: HeadersInit = {}) {
  const headers = new Headers(extras);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(dados), { status, headers });
}

/**
 * Recusa chamadas vindas de outros sites. Formulários e links de terceiros não
 * conseguem enviar cabeçalhos próprios, e uma chamada `fetch` de outra origem
 * com esse cabeçalho é barrada pelo navegador (não há CORS liberado).
 */
export function mesmaOrigem(request: Request) {
  if (request.headers.get(CABECALHO_APP) !== "1") return false;
  const site = request.headers.get("sec-fetch-site");
  return !site || site === "same-origin" || site === "none";
}

export async function exigirSessao(request: Request) {
  const sessao = await obterSessao(request);
  if (!sessao) return { resposta: json({ error: { message: "sessao_expirada" } }, 401) } as const;
  return { sessao } as const;
}

/** Origem pública do app (para montar links de e-mail). */
export function origemDoApp(request: Request) {
  const env = process.env["APP_URL"];
  if (env) return new URL(env).origin;
  const proto = request.headers.get("x-forwarded-proto");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (proto && host) return `${proto.split(",")[0]}://${host}`;
  return new URL(request.url).origin;
}

export async function lerJson<T>(request: Request, limiteBytes = 2_000_000): Promise<T> {
  const tamanho = Number(request.headers.get("content-length") ?? 0);
  if (tamanho > limiteBytes) throw new Error("Requisição grande demais.");
  const texto = await request.text();
  if (texto.length > limiteBytes) throw new Error("Requisição grande demais.");
  return JSON.parse(texto) as T;
}

/** Origem pública do app na requisição em andamento (funções de servidor). */
export async function origemAtual() {
  const { getRequest } = await import("@tanstack/react-start/server");
  return origemDoApp(getRequest());
}
