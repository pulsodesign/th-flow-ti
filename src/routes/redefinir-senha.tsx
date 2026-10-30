import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { KeyRound } from "@/components/ui/icon";
import { toast } from "sonner";
import { db } from "@/lib/dados/cliente";
import { traduzErroAuth } from "@/lib/thc/i18n";
import { SenhaInput } from "@/components/thc/SenhaInput";

export const Route = createFileRoute("/redefinir-senha")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Redefinir senha — TH Flow" },
      { name: "description", content: "Defina uma nova senha para acessar o TH Flow." },
      { property: "og:title", content: "Redefinir senha — TH Flow" },
      { property: "og:description", content: "Defina uma nova senha para acessar o TH Flow." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RedefinirSenhaPage,
});

function RedefinirSenhaPage() {
  const navigate = useNavigate();
  const processado = useRef(false);
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [verificando, setVerificando] = useState(true);
  const [linkValido, setLinkValido] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (processado.current) return;
    processado.current = true;
    let ativo = true;

    void (async () => {
      try {
        const query = new URLSearchParams(window.location.search);
        if (query.get("erro")) throw new Error(query.get("erro") ?? "link_invalido");

        const token = query.get("token");
        const tipo = query.get("tipo");

        if (token && tipo === "recuperacao") {
          const { error } = await db.auth.validarLink({ token, tipo });
          if (error) throw error;
        } else if (tipo && tipo !== "recuperacao") {
          throw new Error("link_invalido");
        }

        const { data, error } = await db.auth.usuario();
        if (error || !data.user) throw error ?? new Error("sessao_expirada");
        if (!ativo) return;
        window.history.replaceState({}, "", "/redefinir-senha");
        setLinkValido(true);
      } catch (err) {
        if (!ativo) return;
        setLinkValido(false);
        toast.error(traduzErroAuth(err, "Não foi possível validar o link de redefinição."));
      } finally {
        if (ativo) setVerificando(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, []);

  const salvar = async (event: React.FormEvent) => {
    event.preventDefault();
    if (senha.length < 6) {
      toast.error("A senha precisa ter ao menos 6 caracteres.");
      return;
    }
    if (senha !== confirmacao) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await db.auth.atualizar({ senha });
      if (error) throw error;
      toast.success("Senha redefinida com sucesso.");
      void navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(traduzErroAuth(err, "Não foi possível redefinir a senha."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-[380px] rise-in">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl gradient-navy text-[15px] font-bold">
            TH
          </div>
          <h1 className="text-[20px] font-semibold tracking-tight">Redefinir senha</h1>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            {verificando
              ? "Validando seu link…"
              : linkValido
                ? "Crie uma nova senha segura"
                : "Este link não está mais disponível"}
          </p>
        </div>

        {linkValido ? (
          <form onSubmit={salvar} className="panel space-y-3 p-5">
            <PasswordField label="Nova senha" value={senha} onChange={setSenha} />
            <PasswordField
              label="Confirmar nova senha"
              value={confirmacao}
              onChange={setConfirmacao}
            />
            <p className="text-[11px] text-muted-foreground">
              Use pelo menos 6 caracteres e evite senhas comuns ou já usadas em outros serviços.
            </p>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary font-semibold px-3 py-2.5 text-[13px] text-primary-foreground fluid hover:opacity-90 disabled:opacity-60"
            >
              <KeyRound className="size-4" /> {busy ? "Salvando…" : "Salvar nova senha"}
            </button>
          </form>
        ) : !verificando ? (
          <div className="panel p-5 text-center">
            <p className="text-[12.5px] text-muted-foreground">
              Solicite um novo e-mail para continuar com segurança.
            </p>
            <Link
              to="/auth"
              className="mt-4 inline-flex rounded-full bg-primary font-semibold px-3 py-2 text-[12.5px] text-primary-foreground"
            >
              Solicitar novo link
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function PasswordField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <SenhaInput
        required
        minLength={6}
        autoComplete="new-password"
        value={value}
        onChange={onChange}
      />
    </label>
  );
}
