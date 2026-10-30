import { createFileRoute } from "@tanstack/react-router";
import type { ChamadaRpc, Consulta } from "@/lib/dados/consulta";

/**
 * Consultas do app em nome do usuário logado. Cada chamada roda numa transação
 * com o papel `thflow_usuario`, então as regras de RLS do banco decidem o que
 * a pessoa pode ler e alterar.
 */
export const Route = createFileRoute("/api/dados")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { json, mesmaOrigem, exigirSessao, lerJson } = await import("@/servidor/http");
        if (!mesmaOrigem(request))
          return json({ error: { message: "Origem não permitida." } }, 403);
        const auth = await exigirSessao(request);
        if ("resposta" in auth) return auth.resposta;

        let corpo: { consulta?: Consulta; rpc?: ChamadaRpc };
        try {
          corpo = await lerJson(request);
        } catch (e) {
          return json(
            { data: null, error: { message: e instanceof Error ? e.message : "JSON inválido." } },
            400,
          );
        }

        const { comoUsuario } = await import("@/servidor/banco");
        const { executarConsulta, executarRpc } = await import("@/servidor/sql");
        const id = auth.sessao.usuario.id;
        try {
          const r = corpo.rpc
            ? await comoUsuario(id, (c) => executarRpc(c, corpo.rpc!))
            : corpo.consulta
              ? await comoUsuario(id, (c) => executarConsulta(c, corpo.consulta!))
              : { data: null, error: { message: "Requisição inválida." } };
          return json(r, r.error ? 400 : 200);
        } catch (e) {
          // Falha de conexão ou erro inesperado: registra no servidor, sem expor detalhes.
          console.error("[dados]", e);
          return json(
            { data: null, error: { message: "Não foi possível acessar os dados agora." } },
            500,
          );
        }
      },
    },
  },
});
