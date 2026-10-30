import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { paginaDeErro } from "./lib/pagina-de-erro";

// Falha inesperada ao montar uma tela: registra no log e mostra a página de erro.
const tratarErros = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(paginaDeErro(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Ao definir este arquivo, a proteção padrão contra chamadas de outros sites
// nas funções de servidor precisa ser incluída aqui explicitamente.
const protecaoCsrf = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [tratarErros, protecaoCsrf],
}));
