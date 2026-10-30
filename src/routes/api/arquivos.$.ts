import { createFileRoute } from "@tanstack/react-router";

/**
 * Leitura e exclusão de anexos.
 * - Ler: qualquer pessoa logada (os anexos aparecem para todos que veem a tarefa).
 * - Excluir: quem enviou o arquivo ou um gestor.
 */
export const Route = createFileRoute("/api/arquivos/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { json, exigirSessao } = await import("@/servidor/http");
        const auth = await exigirSessao(request);
        if ("resposta" in auth) return auth.resposta;
        const caminho = params._splat ?? "";
        const { comoServidor } = await import("@/servidor/banco");
        const arq = await comoServidor(async (c) => {
          const { rows } = await c.query<{ tipo: string; conteudo: Buffer }>(
            "SELECT tipo, conteudo FROM app.arquivos WHERE caminho = $1",
            [caminho],
          );
          return rows[0];
        });
        if (!arq) return json({ error: { message: "Arquivo não encontrado." } }, 404);
        const nome =
          caminho
            .split("/")
            .pop()
            ?.replace(/^[0-9a-f-]{36}-/, "") ?? "arquivo";
        const exibir =
          /^image\/(png|jpe?g|gif|webp|avif)$/.test(arq.tipo) || arq.tipo === "application/pdf";
        return new Response(new Uint8Array(arq.conteudo), {
          headers: {
            "content-type": arq.tipo,
            "content-length": String(arq.conteudo.length),
            "content-disposition": `${exibir ? "inline" : "attachment"}; filename="${nome.replace(/"/g, "")}"`,
            "cache-control": "private, max-age=86400",
            "x-content-type-options": "nosniff",
            // Um arquivo aberto direto no navegador nunca roda scripts.
            "content-security-policy":
              "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
          },
        });
      },

      DELETE: async ({ request, params }) => {
        const { json, mesmaOrigem, exigirSessao } = await import("@/servidor/http");
        if (!mesmaOrigem(request))
          return json({ error: { message: "Origem não permitida." } }, 403);
        const auth = await exigirSessao(request);
        if ("resposta" in auth) return auth.resposta;
        const { comoUsuario, comoServidor } = await import("@/servidor/banco");
        const uid = auth.sessao.usuario.id;
        const gestor = await comoUsuario(
          uid,
          async (c) => (await c.query("SELECT public.is_gestor() AS g")).rows[0]?.g === true,
        );
        await comoServidor((c) =>
          c.query("DELETE FROM app.arquivos WHERE caminho = $1 AND (dono_id = $2 OR $3)", [
            params._splat ?? "",
            uid,
            gestor,
          ]),
        );
        return json({ ok: true });
      },
    },
  },
});
