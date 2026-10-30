import { useEffect, useState } from "react";
import { Bell, MailPlus } from "@/components/ui/icon";
import { toast } from "sonner";
import { db } from "@/lib/dados/cliente";
import { useAuth } from "@/lib/thc/auth";
import { usePush } from "@/lib/thc/push";
import {
  NIVEIS,
  TIPOS_NOTIFICACAO,
  TODOS_TIPOS,
  type TipoNotificacao,
} from "@/lib/thc/notificacoes";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

const TEXTO_ESTADO = {
  carregando: "Verificando este aparelho…",
  "sem-suporte":
    "Este navegador não recebe notificações. No computador, use Chrome, Edge, Firefox ou Safari atualizados.",
  "iphone-atalho":
    "No iPhone, as notificações só funcionam pelo atalho: no Safari toque em Compartilhar › Adicionar à Tela de Início e abra o TH Flow por esse ícone.",
  bloqueado:
    "As notificações estão bloqueadas para o TH Flow neste aparelho. Libere nas configurações do navegador (ou do celular) e volte aqui.",
  desativado: "Receba os avisos mesmo com o TH Flow fechado, no computador e no celular.",
  ativado: "Este aparelho recebe as notificações do TH Flow.",
} as const;

/** Push neste aparelho + escolha dos tipos que chegam por e-mail. */
export function NotificacoesConfig() {
  const { userId } = useAuth();
  const push = usePush(userId);
  const [emailAtivo, setEmailAtivo] = useState(true);
  const [tipos, setTipos] = useState<string[]>(TODOS_TIPOS);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!userId) return;
    void db
      .from("notification_prefs")
      .select("email_ativo, email_tipos")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setEmailAtivo(data.email_ativo);
        setTipos(data.email_tipos ?? TODOS_TIPOS);
      });
  }, [userId]);

  const salvar = async (ativo: boolean, lista: string[]) => {
    if (!userId) return;
    setEmailAtivo(ativo);
    setTipos(lista);
    setSalvando(true);
    const { error } = await db.from("notification_prefs").upsert({
      user_id: userId,
      email_ativo: ativo,
      email_tipos: lista,
      updated_at: new Date().toISOString(),
    });
    setSalvando(false);
    if (error) toast.error("Não foi possível salvar suas preferências.");
  };

  const alternarTipo = (id: TipoNotificacao) =>
    void salvar(emailAtivo, tipos.includes(id) ? tipos.filter((t) => t !== id) : [...tipos, id]);

  const ativar = async () => {
    try {
      await push.ativar();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não foi possível ativar as notificações neste aparelho.",
      );
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="panel p-5 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h2 className="text-[16px] font-semibold">Notificações neste aparelho</h2>
              {push.estado === "ativado" && (
                <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10.5px] font-semibold text-success">
                  Ativas
                </span>
              )}
            </div>
            <p className="mt-1 max-w-[520px] text-[12.5px] text-muted-foreground">
              {TEXTO_ESTADO[push.estado]}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {push.estado === "desativado" && (
              <button
                onClick={() => void ativar()}
                disabled={push.ocupado}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-[12.5px] font-semibold text-primary-foreground fluid hover:opacity-90 disabled:opacity-60"
              >
                <Bell className="size-4" /> {push.ocupado ? "Ativando…" : "Ativar notificações"}
              </button>
            )}
            {push.estado === "ativado" && (
              <>
                <button
                  onClick={() => void push.desativar()}
                  disabled={push.ocupado}
                  className="px-2 py-2 text-[12.5px] text-muted-foreground fluid hover:text-foreground disabled:opacity-60"
                >
                  Desativar
                </button>
                <button
                  onClick={() =>
                    void push
                      .testar()
                      .then(() => toast.success("Aviso de teste enviado. Deve chegar em segundos."))
                      .catch((e: unknown) =>
                        toast.error(e instanceof Error ? e.message : "O teste não foi enviado."),
                      )
                  }
                  disabled={push.ocupado}
                  className="rounded-full border border-border px-4 py-2 text-[12.5px] font-medium fluid hover:bg-surface disabled:opacity-60"
                >
                  Enviar teste
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="panel p-5 md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-[16px] font-semibold">
              <MailPlus className="size-4 text-primary-ink" /> Notificações por e-mail
            </h2>
            <p className="mt-1 max-w-[520px] text-[12.5px] text-muted-foreground">
              No app e no aparelho você recebe todos os avisos. Escolha quais também chegam por
              e-mail.
            </p>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-[12.5px]">
            <span className="text-muted-foreground">{emailAtivo ? "Ligado" : "Desligado"}</span>
            <Switch checked={emailAtivo} onCheckedChange={(v) => void salvar(v, tipos)} />
          </label>
        </div>

        <div
          className={cn(
            "mt-5 overflow-hidden rounded-xl border border-border",
            !emailAtivo && "pointer-events-none opacity-50",
          )}
        >
          <div className="hidden grid-cols-[1fr_110px_56px] items-center gap-4 border-b border-border bg-surface/60 px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground md:grid">
            <span>Aviso</span>
            <span>Importância</span>
            <span className="text-right">E-mail</span>
          </div>
          <ul className="divide-y divide-border">
            {TIPOS_NOTIFICACAO.map((t) => {
              const nivel = NIVEIS.find((n) => n.id === t.nivel);
              return (
                <li
                  key={t.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 md:grid-cols-[1fr_110px_56px]"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium">{t.label}</p>
                    <p className="truncate text-[11.5px] text-muted-foreground">Ex.: {t.exemplo}</p>
                  </div>
                  <span className="order-3 col-span-2 flex items-center gap-1.5 text-[11px] text-muted-foreground md:order-none md:col-span-1">
                    <span className={cn("size-2 rounded-full", nivel?.classe)} />
                    {nivel?.label}
                  </span>
                  <div className="flex justify-end">
                    <Switch
                      checked={tipos.includes(t.id)}
                      onCheckedChange={() => alternarTipo(t.id)}
                      aria-label={`E-mail: ${t.label}`}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        <p className="mt-2 h-4 text-[11px] text-muted-foreground">{salvando ? "Salvando…" : ""}</p>
      </div>
    </div>
  );
}
