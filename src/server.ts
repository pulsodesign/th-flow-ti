import "./lib/captura-de-erros";

import { consumirUltimoErro } from "./lib/captura-de-erros";
import { paginaDeErro } from "./lib/pagina-de-erro";
import { iniciarAgendador } from "./servidor/rotinas";
import { aplicarCabecalhosDeSeguranca } from "./servidor/cabecalhos";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

// Rotinas diárias (lembretes das 9h, séries mensais, eventos vencidos).
iniciarAgendador();

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// Quando uma tela falha no servidor, o framework devolve um 500 em JSON
// ({"unhandled":true,"message":"HTTPError"}) sem passar pelo try/catch. Aqui essa
// resposta vira a página de erro, e o erro original vai para o log.
async function tratarFalhaAoMontarTela(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!ehFalhaDoFramework(body)) return response;

  console.error(consumirUltimoErro() ?? new Error(`Falha ao montar a tela: ${body}`));
  return new Response(paginaDeErro(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function ehFalhaDoFramework(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return aplicarCabecalhosDeSeguranca(await tratarFalhaAoMontarTela(response));
    } catch (error) {
      console.error(error);
      return aplicarCabecalhosDeSeguranca(
        new Response(paginaDeErro(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );
    }
  },
};
