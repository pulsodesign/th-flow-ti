import { createFileRoute } from "@tanstack/react-router";

const LIMITE_BYTES = 10 * 1024 * 1024;

/** Envio de anexos (multipart: campos "arquivo" e "pasta"). Guardados no PostgreSQL. */
export const Route = createFileRoute("/api/enviar-arquivo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { json, mesmaOrigem, exigirSessao } = await import("@/servidor/http");
        if (!mesmaOrigem(request))
          return json({ error: { message: "Origem não permitida." } }, 403);
        const auth = await exigirSessao(request);
        if ("resposta" in auth) return auth.resposta;
        if (Number(request.headers.get("content-length") ?? 0) > LIMITE_BYTES + 100_000) {
          return json({ error: { message: "Arquivo maior que 10 MB." } }, 413);
        }

        const form = await request.formData().catch(() => null);
        const arquivo = form?.get("arquivo");
        if (!(arquivo instanceof File))
          return json({ error: { message: "Arquivo não enviado." } }, 400);
        if (arquivo.size > LIMITE_BYTES)
          return json({ error: { message: "Arquivo maior que 10 MB." } }, 413);

        const uid = auth.sessao.usuario.id;
        const pasta =
          String(form?.get("pasta") ?? "geral")
            .replace(/[^\w-]+/g, "_")
            .slice(0, 60) || "geral";
        const nome = arquivo.name.replace(/[^\w.-]+/g, "_").slice(-120) || "arquivo";
        const caminho = `${uid}/${pasta}/${crypto.randomUUID()}-${nome}`;
        const tipo = /^[\w.+-]+\/[\w.+-]+$/.test(arquivo.type)
          ? arquivo.type
          : "application/octet-stream";

        const bytes = Buffer.from(await arquivo.arrayBuffer());
        const { comoServidor } = await import("@/servidor/banco");
        await comoServidor((c) =>
          c.query(
            "INSERT INTO app.arquivos (caminho, dono_id, tipo, tamanho, conteudo) VALUES ($1, $2, $3, $4, $5)",
            [caminho, uid, tipo, bytes.length, bytes],
          ),
        );
        return json({ path: caminho, url: `/api/arquivos/${caminho}` });
      },
    },
  },
});
