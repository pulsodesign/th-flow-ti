import {
  ArrowRight,
  AtSign,
  Bell,
  BellRing,
  CalendarDays,
  CheckCircle2,
  MessageSquare,
  Pencil,
  ThumbsUp,
  UserPlus,
} from "@/components/ui/icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNavigate } from "@tanstack/react-router";
import { useNotifications, useWorkspace } from "@/lib/thc/store";
import { cn } from "@/lib/utils";

/** "há 5 min", "há 3 h", "há 2 d" — leitura rápida no popover. */
function tempoRelativo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d < 7) return `há ${d} d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

const ICONES = {
  atribuicao: UserPlus,
  mencao: AtSign,
  comentario: MessageSquare,
  status: ArrowRight,
  conclusao: CheckCircle2,
  entrega: CheckCircle2,
  data: CalendarDays,
  atualizacao: Pencil,
  curtida: ThumbsUp,
  lembrete: BellRing,
} as const;

/** Cor do ícone pelo nível de importância (notificações antigas contam como média). */
const COR_NIVEL = {
  alta: "bg-destructive/15 text-destructive",
  media: "bg-warning/20 text-foreground",
  baixa: "bg-surface-2 text-muted-foreground",
} as const;

/** Remove URLs do corpo — o card inteiro já é clicável. */
function limpaCorpo(body: string) {
  return body
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s*Abrir:\s*$/i, "")
    .trim();
}

export function NotificationBell() {
  const { items, unread, markAllRead } = useNotifications();
  const { tasks } = useWorkspace();
  const navigate = useNavigate();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label="Notificações"
          className="relative rounded-md p-1.5 text-muted-foreground fluid hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[15px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
              {unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[330px] overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
          <p className="text-[12.5px] font-semibold">Notificações</p>
          {unread > 0 && (
            <button
              onClick={() => void markAllRead()}
              className="text-[11px] text-primary-ink hover:underline"
            >
              Marcar todas como lidas
            </button>
          )}
        </div>
        <div className="max-h-[380px] overflow-auto">
          {!items.length && (
            <p className="px-3 py-8 text-center text-[12px] text-muted-foreground">
              Nada por aqui ainda.
            </p>
          )}
          {items.map((n) => {
            const alvo = n.task_id ? tasks.find((t) => t.id === n.task_id) : null;
            const board = alvo?.board_id ?? alvo?.projeto_id ?? null;
            const clicavel = !!board;
            const Icone = ICONES[n.tipo as keyof typeof ICONES] ?? Bell;
            return (
              <button
                key={n.id}
                disabled={!clicavel}
                onClick={() => {
                  if (!alvo || !board) return;
                  void navigate({
                    to: "/quadro/$boardId",
                    params: { boardId: board },
                    search: { task: alvo.id },
                  });
                }}
                className={cn(
                  "flex w-full items-start gap-2.5 border-b border-border/60 px-3.5 py-3 text-left fluid",
                  clicavel ? "cursor-pointer hover:bg-surface" : "cursor-default",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                    COR_NIVEL[n.nivel ?? "media"],
                  )}
                >
                  <Icone className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "truncate text-[12.5px]",
                        n.lida
                          ? "font-medium text-muted-foreground"
                          : "font-semibold text-foreground",
                      )}
                    >
                      {n.titulo}
                    </span>
                    {!n.lida && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                  </span>
                  <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">
                    {limpaCorpo(n.body)}
                  </span>
                  <span className="mt-1 block text-[10.5px] text-muted-foreground/70">
                    {tempoRelativo(n.created_at)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="border-t border-border bg-surface/50 px-3 py-2">
          <button
            onClick={() => void navigate({ to: "/notificacoes" })}
            className="w-full rounded-md px-2 py-1.5 text-[12px] font-medium text-primary-ink fluid hover:bg-surface"
          >
            Ver histórico completo
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
