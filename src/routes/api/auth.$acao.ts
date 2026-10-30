import { createFileRoute } from "@tanstack/react-router";

/**
 * Login e sessão.
 *   GET  /api/auth/sessao            usuário logado (ou null)
 *   GET  /api/auth/confirmar-email   link de confirmação de troca de e-mail
 *   POST /api/auth/entrar            { email, senha }
 *   POST /api/auth/sair
 *   POST /api/auth/verificar         { token, tipo }  (convite e redefinição)
 *   POST /api/auth/atualizar         { senha } | { email }
 *   POST /api/auth/recuperar         { email, destino }
 */
export const Route = createFileRoute("/api/auth/$acao")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { json } = await import("@/servidor/http");
        const auth = await import("@/servidor/autenticacao");
        if (params.acao === "sessao") {
          const s = await auth.obterSessao(request);
          return json({ user: s?.usuario ?? null });
        }
        if (params.acao === "confirmar-email") {
          const token = new URL(request.url).searchParams.get("token") ?? "";
          try {
            await auth.confirmarTrocaEmail(token, auth.ipDaRequisicao(request));
            return new Response(null, { status: 303, headers: { location: "/perfil" } });
          } catch {
            return new Response(null, {
              status: 303,
              headers: { location: "/auth?erro=link_invalido" },
            });
          }
        }
        return json({ error: { message: "Não encontrado." } }, 404);
      },

      POST: async ({ request, params }) => {
        const { json, mesmaOrigem, lerJson, origemDoApp } = await import("@/servidor/http");
        const auth = await import("@/servidor/autenticacao");
        if (!mesmaOrigem(request))
          return json({ error: { message: "Origem não permitida." } }, 403);

        const ip = auth.ipDaRequisicao(request);
        const agente = request.headers.get("user-agent");
        const responderErro = (e: unknown) => {
          if (e instanceof auth.ErroAuth) return json({ error: { message: e.message } }, e.status);
          console.error("[auth]", e);
          return json({ error: { message: "Não foi possível continuar." } }, 500);
        };

        try {
          type Corpo = Partial<Record<"email" | "senha" | "token" | "tipo" | "destino", string>>;
          const corpo: Corpo = params.acao === "sair" ? {} : await lerJson<Corpo>(request, 20_000);

          switch (params.acao) {
            case "entrar": {
              const r = await auth.entrar(corpo.email ?? "", corpo.senha ?? "", ip, agente);
              return json({ user: r.usuario }, 200, { "set-cookie": auth.cookieDeSessao(r.token) });
            }
            case "sair": {
              await auth.sair(auth.lerCookie(request, auth.COOKIE_SESSAO));
              return json({ ok: true }, 200, { "set-cookie": auth.cookieDeSessao(null) });
            }
            case "verificar": {
              const r = await auth.verificarLink(corpo.token ?? "", corpo.tipo ?? "", ip, agente);
              return json({ ok: true }, 200, { "set-cookie": auth.cookieDeSessao(r.token) });
            }
            case "recuperar": {
              await auth.solicitarRecuperacao(
                corpo.email ?? "",
                corpo.destino,
                origemDoApp(request),
                ip,
              );
              return json({ ok: true });
            }
            case "atualizar": {
              const s = await auth.obterSessao(request);
              if (!s) return json({ error: { message: "sessao_expirada" } }, 401);
              if (typeof corpo.senha === "string") {
                await auth.alterarSenha(s.usuario.id, corpo.senha, ip, s.token);
              }
              if (
                typeof corpo.email === "string" &&
                corpo.email.trim().toLowerCase() !== s.usuario.email.toLowerCase()
              ) {
                await auth.solicitarTrocaEmail(s.usuario.id, corpo.email, origemDoApp(request), ip);
              }
              return json({ user: s.usuario });
            }
            default:
              return json({ error: { message: "Não encontrado." } }, 404);
          }
        } catch (e) {
          return responderErro(e);
        }
      },
    },
  },
});
