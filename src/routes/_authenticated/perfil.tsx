import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bell, KeyRound, Save, User } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { db } from "@/lib/dados/cliente";
import { useAuth } from "@/lib/thc/auth";
import { traduzErroAuth } from "@/lib/thc/i18n";
import { Avatar, AvatarColorPicker, AVATAR_NEUTRAL_COLOR } from "@/components/thc/atoms";
import { SenhaInput } from "@/components/thc/SenhaInput";
import { NotificacoesConfig } from "@/components/thc/NotificacoesConfig";

const SECOES = [
  { id: "perfil", label: "Perfil", Icone: User },
  { id: "notificacoes", label: "Notificações", Icone: Bell },
  { id: "seguranca", label: "Senha e segurança", Icone: KeyRound },
] as const;
type Secao = (typeof SECOES)[number]["id"];

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Meu Perfil — TH Flow" },
      {
        name: "description",
        content: "Atualize seu nome, e-mail, cargo e foto de perfil na plataforma da TH Flow.",
      },
      { property: "og:title", content: "Meu Perfil — TH Flow" },
      { property: "og:description", content: "Dados pessoais do seu acesso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, userId, role, refresh, session } = useAuth();
  const emailAtual = session?.user.email ?? "";
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cargo, setCargo] = useState("");
  const [foto, setFoto] = useState("");
  const [cor, setCor] = useState(AVATAR_NEUTRAL_COLOR);
  const [busy, setBusy] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [secao, setSecao] = useState<Secao>("perfil");

  const trocarSenha = async () => {
    if (senha.length < 6) {
      toast.error("A senha precisa ter ao menos 6 caracteres.");
      return;
    }
    if (senha !== senha2) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setPwBusy(true);
    try {
      if (!emailAtual || !senhaAtual) {
        toast.error("Digite sua senha atual para confirmar a alteração.");
        return;
      }
      const { error: loginError } = await db.auth.entrar({ email: emailAtual, senha: senhaAtual });
      if (loginError) throw new Error("senha_atual_incorreta");
      const { error } = await db.auth.atualizar({ senha });
      if (error) throw error;
      setSenhaAtual("");
      setSenha("");
      setSenha2("");
      toast.success("Senha atualizada.");
    } catch (err) {
      toast.error(traduzErroAuth(err, "Não foi possível alterar a senha."));
    } finally {
      setPwBusy(false);
    }
  };

  const enviarLink = async () => {
    if (!emailAtual) return;
    setPwBusy(true);
    try {
      const { error } = await db.auth.pedirRedefinicao(
        emailAtual,
        `${window.location.origin}/redefinir-senha`,
      );
      if (error) throw error;
      toast.success("Link de redefinição enviado para seu e-mail.");
    } catch (err) {
      toast.error(traduzErroAuth(err, "Não foi possível enviar o link."));
    } finally {
      setPwBusy(false);
    }
  };

  useEffect(() => {
    setEmail(emailAtual);
  }, [emailAtual]);

  useEffect(() => {
    if (!profile) return;
    setNome(profile.nome);
    setCargo(profile.cargo);
    setFoto(profile.foto_perfil ?? "");
    setCor(profile.cor || AVATAR_NEUTRAL_COLOR);
  }, [profile]);

  const save = async () => {
    if (!userId) return;
    setBusy(true);
    try {
      const { error } = await db
        .from("profiles")
        .update({ nome, cargo, foto_perfil: foto || null, cor })
        .eq("id", userId);
      if (error) throw error;
      if (email !== emailAtual) {
        const { error: authError } = await db.auth.atualizar({ email });
        if (authError) throw authError;
        await db.from("user_emails").upsert({ user_id: userId, email });
        toast.info("Confirme o novo e-mail pela mensagem enviada.");
      }
      await refresh();
      toast.success("Perfil atualizado.");
    } catch (err) {
      toast.error(traduzErroAuth(err, "Não foi possível salvar as alterações."));
    } finally {
      setBusy(false);
    }
  };

  const btnPrimario =
    "inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-[12.5px] font-semibold text-primary-foreground fluid hover:opacity-90 disabled:opacity-60";

  return (
    <div className="flex h-full flex-col">
      <header className="px-4 py-4 md:px-8 md:py-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Conta
        </p>
        <h1 className="mt-1 text-[30px] font-light leading-[1.05] tracking-[-0.02em] md:text-[44px]">
          Meu Perfil
        </h1>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-4 pb-8 md:px-8 rise-in">
        <div className="mx-auto flex max-w-[1080px] flex-col gap-5 md:flex-row md:items-start md:gap-8">
          {/* Navegação das seções: coluna à esquerda no desktop, abas no celular */}
          <aside className="md:sticky md:top-0 md:w-[240px] md:shrink-0">
            <div className="panel hidden items-center gap-3 p-4 md:flex">
              <Avatar
                user={profile ? { ...profile, nome, foto_perfil: foto || null, cor } : null}
                size={44}
              />
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-semibold">{nome || "—"}</p>
                <p className="truncate text-[11.5px] text-muted-foreground">
                  {role === "gestor" ? "Administrador" : "Membro"}
                </p>
              </div>
            </div>
            <nav className="flex gap-1 overflow-x-auto md:mt-3 md:flex-col">
              {SECOES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSecao(s.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2.5 rounded-full px-3.5 py-2 text-left text-[13px] fluid md:rounded-xl",
                    secao === s.id
                      ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground shadow-[var(--shadow-soft)]"
                      : "text-muted-foreground hover:bg-surface hover:text-foreground",
                  )}
                >
                  <s.Icone className="size-4" />
                  {s.label}
                </button>
              ))}
            </nav>
          </aside>

          <section className="min-w-0 flex-1">
            {secao === "perfil" && (
              <div className="panel p-5 md:p-7">
                <SecaoTitulo
                  titulo="Dados pessoais"
                  descricao="Como você aparece para a equipe nas tarefas, comentários e quadros."
                />
                <div className="mt-5 flex items-center gap-4">
                  <Avatar
                    user={profile ? { ...profile, nome, foto_perfil: foto || null, cor } : null}
                    size={64}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold">{nome || "—"}</p>
                    <p className="text-[12px] text-muted-foreground">
                      Nível de acesso: {role === "gestor" ? "Administrador" : "Membro"}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <Field label="Nome" value={nome} onChange={setNome} />
                  <Field label="E-mail" value={email} onChange={setEmail} type="email" />
                  <Field label="Cargo" value={cargo} onChange={setCargo} />
                  <Field label="Foto de perfil (URL)" value={foto} onChange={setFoto} />
                </div>

                <div className="mt-5">
                  <span className="mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    Cor do avatar
                  </span>
                  <AvatarColorPicker value={cor} onChange={setCor} />
                </div>

                <div className="mt-6 flex justify-end border-t border-border pt-5">
                  <button onClick={() => void save()} disabled={busy} className={btnPrimario}>
                    <Save className="size-4" /> {busy ? "Salvando…" : "Salvar alterações"}
                  </button>
                </div>
              </div>
            )}

            {secao === "notificacoes" && <NotificacoesConfig />}

            {secao === "seguranca" && (
              <div className="panel p-5 md:p-7">
                <SecaoTitulo
                  titulo="Senha"
                  descricao="Use pelo menos 6 caracteres e evite senhas comuns ou já usadas em outros serviços."
                />
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2 md:max-w-[calc(50%-0.5rem)]">
                    <Field
                      label="Senha atual"
                      value={senhaAtual}
                      onChange={setSenhaAtual}
                      type="password"
                    />
                  </div>
                  <Field label="Nova senha" value={senha} onChange={setSenha} type="password" />
                  <Field
                    label="Confirmar nova senha"
                    value={senha2}
                    onChange={setSenha2}
                    type="password"
                  />
                </div>
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
                  <button
                    onClick={() => void enviarLink()}
                    disabled={pwBusy}
                    className="text-[12.5px] text-muted-foreground underline-offset-4 fluid hover:text-foreground hover:underline disabled:opacity-60"
                  >
                    Esqueceu a senha? Enviar link por e-mail
                  </button>
                  <button
                    onClick={() => void trocarSenha()}
                    disabled={pwBusy}
                    className={btnPrimario}
                  >
                    <KeyRound className="size-4" /> {pwBusy ? "Salvando…" : "Definir nova senha"}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function SecaoTitulo({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <div>
      <h2 className="text-[16px] font-semibold">{titulo}</h2>
      <p className="mt-1 text-[12.5px] text-muted-foreground">{descricao}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      {type === "password" ? (
        <SenhaInput value={value} onChange={onChange} />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:border-primary"
        />
      )}
    </label>
  );
}
