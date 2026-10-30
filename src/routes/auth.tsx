import { useEffect, useRef, useState } from "react";
import { aplicarTema, type ThemeId } from "@/lib/thc/theme";
import { LogoTHFlow } from "@/components/thc/LogoTHFlow";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { KeyRound, LogIn } from "@/components/ui/icon";
import { toast } from "sonner";
import { db } from "@/lib/dados/cliente";
import { boardSlug } from "@/lib/thc/slug";
import { useAuth } from "@/lib/thc/auth";
import { traduzErroAuth } from "@/lib/thc/i18n";
import { SenhaInput } from "@/components/thc/SenhaInput";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — TH Flow" },
      {
        name: "description",
        content: "Acesse a plataforma de gestão de projetos da TH Flow com e-mail e senha.",
      },
      { property: "og:title", content: "Entrar — TH Flow" },
      { property: "og:description", content: "Login da equipe TH Flow." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [mode, setMode] = useState<"login" | "definir" | "recuperar">("login");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [busy, setBusy] = useState(false);
  const [pronto, setPronto] = useState(true);
  const linkProcessado = useRef(false);

  // O login é sempre no tema claro; ao sair da tela, volta o tema salvo do usuário.
  useEffect(() => {
    aplicarTema("claro");
    return () => {
      const salvo = window.localStorage.getItem("thflow:tema") as ThemeId | null;
      if (salvo) aplicarTema(salvo);
    };
  }, []);

  // Converte o link do convite/recuperação em uma sessão válida antes de definir a senha.
  useEffect(() => {
    if (linkProcessado.current) return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const tipo = params.get("tipo");
    const ehDefinir =
      params.get("mode") === "definir" || tipo === "convite" || tipo === "recuperacao" || !!token;

    if (!ehDefinir) return;
    linkProcessado.current = true;
    setMode("definir");
    setPronto(false);

    void (async () => {
      try {
        if (token && (tipo === "convite" || tipo === "recuperacao")) {
          const { error } = await db.auth.validarLink({ token, tipo });
          if (error) throw error;
        } else if (token || tipo) {
          throw new Error("link_invalido");
        }
        const { data, error } = await db.auth.usuario();
        if (error || !data.user) throw error ?? new Error("sessao_expirada");
        window.history.replaceState({}, "", "/auth?mode=definir");
        setPronto(true);
      } catch (err) {
        toast.error(traduzErroAuth(err, "Não foi possível validar o link de acesso."));
        setMode("recuperar");
        setPronto(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (session && mode === "login") void irParaPaginaInicial(session.user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, mode, navigate]);

  // Cada usuário entra direto no seu quadro individual; sem quadro, cai no dashboard.
  const irParaPaginaInicial = async (userId: string) => {
    const { data: board } = await db
      .from("projects")
      .select("id, nome, owner_id, kind")
      .eq("kind", "individual")
      .eq("owner_id", userId)
      .maybeSingle();
    if (board) {
      const { data: perfil } = await db
        .from("profiles")
        .select("id, nome, cargo, foto_perfil, cor, created_at, updated_at")
        .eq("id", userId)
        .maybeSingle();
      const slug = boardSlug(board as never, perfil ? [perfil as never] : []);
      void navigate({
        to: "/quadro/$boardId",
        params: { boardId: slug },
        search: {} as never,
        replace: true,
      });
    } else {
      void navigate({ to: "/dashboard", replace: true });
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await db.auth.entrar({ email: email.trim().toLowerCase(), senha });
        if (error) throw error;
        toast.success("Login realizado com sucesso.");
        const { data: sessao } = await db.auth.sessao();
        if (sessao.session) await irParaPaginaInicial(sessao.session.user.id);
      } else if (mode === "definir") {
        if (senha !== confirmacao) {
          toast.error("As senhas não coincidem.");
          return;
        }
        const { data: atual, error: sessionError } = await db.auth.usuario();
        if (sessionError || !atual.user) {
          toast.error("Link expirado ou inválido. Solicite um novo e-mail de acesso.");
          setMode("recuperar");
          return;
        }
        const { error } = await db.auth.atualizar({ senha });
        if (error) throw error;
        toast.success("Senha criada com sucesso. Use-a nos próximos acessos.");
        await irParaPaginaInicial(atual.user.id);
      } else {
        const { error } = await db.auth.pedirRedefinicao(
          email.trim().toLowerCase(),
          `${window.location.origin}/redefinir-senha`,
        );
        if (error) throw error;
        toast.success("Enviamos um e-mail para redefinir sua senha.");
        setMode("login");
      }
    } catch (err) {
      toast.error(traduzErroAuth(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+2rem)] sm:px-6">
      {/* Manchas de cor atrás do vidro, para o desfoque aparecer. No celular elas somem nas bordas,
          para o fundo encostar na cor das barras do navegador (iPhone) sem faixa visível. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 max-md:[mask-image:linear-gradient(to_bottom,transparent,#000_22%,#000_78%,transparent)]"
      >
        <div className="absolute left-[10%] top-[4%] size-[420px] rounded-full bg-[radial-gradient(circle,#f3c85a_0%,transparent_70%)] blur-[10px]" />
        <div className="absolute -bottom-20 right-[8%] size-[520px] rounded-full bg-[radial-gradient(circle,#eab343_0%,transparent_70%)] blur-[10px]" />
        <div className="absolute -top-16 right-[23%] size-[360px] rounded-full bg-[radial-gradient(circle,rgb(122_140_255/0.55)_0%,transparent_70%)] blur-[10px]" />
      </div>

      <div className="rise-in relative flex w-full max-w-[1124px] items-center gap-10 rounded-[44px] border-[1.5px] border-white/85 bg-[linear-gradient(135deg,rgb(255_255_255/0.72),rgb(255_255_255/0.42))] px-7 py-6 shadow-[inset_0_1px_0_rgb(255_255_255/0.9),inset_0_-1px_0_rgb(255_255_255/0.3),0_40px_90px_-40px_rgb(35_37_77/0.45)] backdrop-blur-[34px] backdrop-saturate-[1.7] sm:p-[22px] lg:gap-[110px] lg:pr-[110px]">
        <div className="relative hidden h-[640px] w-[480px] shrink-0 overflow-hidden rounded-[32px] bg-[url(/marca/fundo-login.jpg)] bg-cover bg-center shadow-[0_30px_70px_-35px_rgb(20_22_58/0.55)] md:block">
          <p className="absolute left-[38px] top-9 text-[13px] font-medium tracking-[0.04em] text-white/70">
            É hora de se organizar
          </p>
          <img
            src="/marca/favicon.svg"
            alt=""
            aria-hidden
            className="absolute bottom-[30px] left-[30px] h-10 w-auto"
          />
        </div>

        <div className="mx-auto w-full max-w-[400px] py-6 md:mx-0">
          <LogoTHFlow className="mx-auto mb-6 h-11 md:mx-0 md:mb-7 md:h-12" />
          <h1 className="text-center text-[38px] font-light leading-none tracking-[-0.03em] text-foreground sm:text-[52px] md:text-left">
            {mode === "definir"
              ? "Crie sua senha"
              : mode === "recuperar"
                ? "Recuperar acesso"
                : "Bem-vindo"}
          </h1>

          <form onSubmit={submit} className="mt-4 space-y-5">
            {mode !== "definir" && (
              <label className="block pt-3">
                <span className="mb-2 ml-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  E-mail
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-[22px] border border-[var(--glass-border)] bg-tile px-5 py-3.5 text-[14px] shadow-[var(--shadow-soft)] outline-none fluid focus:border-primary/60"
                />
              </label>
            )}

            {mode !== "recuperar" && (
              <label className="block">
                <span className="mb-2 ml-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {mode === "definir" ? "Nova senha" : "Senha"}
                </span>
                <SenhaInput
                  required
                  minLength={6}
                  autoComplete={mode === "definir" ? "new-password" : "current-password"}
                  value={senha}
                  onChange={setSenha}
                  className="w-full rounded-[22px] border border-[var(--glass-border)] bg-tile px-5 py-3.5 text-[14px] shadow-[var(--shadow-soft)] outline-none fluid focus:border-primary/60 pr-11"
                />
              </label>
            )}

            {mode === "definir" && (
              <label className="block">
                <span className="mb-2 ml-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Confirmar nova senha
                </span>
                <SenhaInput
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={confirmacao}
                  onChange={setConfirmacao}
                  className="w-full rounded-[22px] border border-[var(--glass-border)] bg-tile px-5 py-3.5 text-[14px] shadow-[var(--shadow-soft)] outline-none fluid focus:border-primary/60 pr-11"
                />
              </label>
            )}

            {mode === "definir" && (
              <p className="ml-1 text-[11.5px] text-muted-foreground">
                Use pelo menos 6 caracteres e evite senhas comuns ou já usadas em outros serviços.
              </p>
            )}

            <button
              type="submit"
              disabled={busy || !pronto}
              className="!mt-7 inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-primary text-[15px] font-semibold text-primary-foreground shadow-[0_14px_26px_-14px_rgb(234_179_67/0.9)] fluid hover:opacity-90 disabled:opacity-60"
            >
              {mode === "definir" ? (
                <KeyRound className="size-4" />
              ) : mode === "recuperar" ? null : (
                <LogIn className="size-4" />
              )}
              {busy || !pronto
                ? "Aguarde…"
                : mode === "definir"
                  ? "Definir senha"
                  : mode === "recuperar"
                    ? "Enviar e-mail"
                    : "Entrar"}
            </button>

            <div className="text-center text-[13px] text-muted-foreground">
              {mode !== "login" ? (
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="hover:text-foreground"
                >
                  Voltar ao login
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setMode("recuperar")}
                  className="hover:text-foreground"
                >
                  Esqueci minha senha
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
