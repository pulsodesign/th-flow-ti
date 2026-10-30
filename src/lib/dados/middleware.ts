import { createMiddleware } from "@tanstack/react-start";

/**
 * Exige login nas funções de servidor. Disponibiliza no contexto:
 *   - db:     acesso aos dados em nome do usuário (regras de RLS valem)
 *   - userId: id do usuário logado
 * A sessão vem do cookie HttpOnly; o navegador o envia sozinho.
 */
export const exigirLogin = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { getRequest } = await import("@tanstack/react-start/server");
  const { obterSessao } = await import("@/servidor/autenticacao");
  const { dbDoUsuario } = await import("@/servidor/dados");
  const sessao = await obterSessao(getRequest());
  if (!sessao) throw new Error("sessao_expirada");
  return next({ context: { db: dbDoUsuario(sessao.usuario.id), userId: sessao.usuario.id } });
});
