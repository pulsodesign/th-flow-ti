import { createFileRoute } from "@tanstack/react-router";

/** Fluxo de avisos de mudança (Server-Sent Events) para a pessoa logada. */
export const Route = createFileRoute("/api/tempo-real")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { exigirSessao } = await import("@/servidor/http");
        const auth = await exigirSessao(request);
        if ("resposta" in auth) return auth.resposta;
        const { assinar } = await import("@/servidor/tempo-real");

        const codificador = new TextEncoder();
        let cancelar: (() => void) | undefined;
        const corpo = new ReadableStream<Uint8Array>({
          start(controle) {
            const escrever = (texto: string) => {
              try {
                controle.enqueue(codificador.encode(texto));
              } catch {
                cancelar?.();
              }
            };
            escrever("retry: 3000\n: conectado\n\n");
            const sair = assinar(auth.sessao.usuario.id, (m) =>
              escrever(`data: ${JSON.stringify(m)}\n\n`),
            );
            // Mantém a conexão viva atrás de proxies.
            const batida = setInterval(() => escrever(": ping\n\n"), 25_000);
            cancelar = () => {
              clearInterval(batida);
              sair();
            };
            request.signal.addEventListener("abort", () => {
              cancelar?.();
              try {
                controle.close();
              } catch {
                /* já fechado */
              }
            });
          },
          cancel() {
            cancelar?.();
          },
        });

        return new Response(corpo, {
          headers: {
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-store",
            "x-accel-buffering": "no",
          },
        });
      },
    },
  },
});
