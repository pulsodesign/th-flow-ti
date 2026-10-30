import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  AtSign,
  Bell,
  BellRing,
  CalendarDays,
  CheckCircle2,
  MessageSquare,
  Pencil,
  Search,
  ThumbsUp,
  UserPlus,
} from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TaskModal } from "@/components/thc/TaskModal";
import { useNotificationHistory, useWorkspace } from "@/lib/thc/store";
import { cn } from "@/lib/utils";
import { NIVEIS } from "@/lib/thc/notificacoes";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  head: () => ({
    meta: [
      { title: "Histórico de notificações — TH Flow" },
      {
        name: "description",
        content:
          "Histórico completo de atividades, comentários, menções e mudanças de status das suas tarefas.",
      },
      { property: "og:title", content: "Histórico de notificações — TH Flow" },
      {
        property: "og:description",
        content: "Filtre notificações por menções, status e busca rápida.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificacoesPage,
});

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

function limpaCorpo(body: string) {
  return body
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s*Abrir:\s*$/i, "")
    .trim();
}

function dataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function NotificacoesPage() {
  const { data: items = [], isLoading } = useNotificationHistory();
  const { tasks, profiles, statuses } = useWorkspace();
  const [busca, setBusca] = useState("");
  const [mencao, setMencao] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [nivel, setNivel] = useState("todos");
  const [aberta, setAberta] = useState<string | null>(null);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return items.filter((n) => {
      const tarefa = n.task_id ? tasks.find((t) => t.id === n.task_id) : null;
      if (termo) {
        const alvo = `${n.titulo} ${n.body} ${tarefa?.titulo ?? ""}`.toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      if (status !== "todos" && tarefa?.status !== status) return false;
      if (nivel !== "todos" && (n.nivel ?? "media") !== nivel) return false;
      if (mencao !== "todos") {
        const pessoa = profiles.find((p) => p.id === mencao);
        const primeiro = (pessoa?.nome ?? "").split(" ")[0]?.toLowerCase() ?? "";
        const citado = !!primeiro && `${n.titulo} ${n.body}`.toLowerCase().includes(primeiro);
        const envolvido =
          !!tarefa && (tarefa.usuario_id.includes(mencao) || tarefa.criador_id === mencao);
        if (!citado && !envolvido) return false;
      }
      return true;
    });
  }, [items, tasks, profiles, busca, mencao, status, nivel]);

  const current = aberta ? (tasks.find((t) => t.id === aberta) ?? null) : null;

  return (
    <div className="flex h-full flex-col">
      <header className="px-8 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Atividades
        </p>
        <h1 className="mt-1 text-[30px] font-light leading-[1.05] tracking-[-0.02em] md:text-[44px]">
          Histórico de notificações
        </h1>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Comentários, menções e mudanças de status das tarefas em que você está envolvido.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative w-[260px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar no histórico"
              className="h-8 pl-8 text-[12.5px]"
            />
          </div>
          <span className="text-[11.5px] uppercase tracking-[0.12em] text-muted-foreground">
            Filtrar por:
          </span>
          <Select value={mencao} onValueChange={setMencao}>
            <SelectTrigger className="h-8 w-[190px] text-[12.5px]">
              <SelectValue placeholder="Menções" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as menções</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={nivel} onValueChange={setNivel}>
            <SelectTrigger className="h-8 w-[170px] text-[12.5px]">
              <SelectValue placeholder="Importância" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Toda importância</SelectItem>
              {NIVEIS.map((nv) => (
                <SelectItem key={nv.id} value={nv.id}>
                  Importância {nv.label.toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 w-[180px] text-[12.5px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s.id} value={s.chave}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-3 py-4 md:px-6 md:py-5">
        <div className="panel overflow-hidden">
          {isLoading && (
            <p className="px-4 py-10 text-center text-[12.5px] text-muted-foreground">
              Carregando histórico…
            </p>
          )}
          {!isLoading && !lista.length && (
            <p className="px-4 py-10 text-center text-[12.5px] text-muted-foreground">
              Nenhuma notificação encontrada com esses filtros.
            </p>
          )}
          {lista.map((n) => {
            const tarefa = n.task_id ? tasks.find((t) => t.id === n.task_id) : null;
            const statusLabel = statuses.find((s) => s.chave === tarefa?.status)?.label;
            const Icone = ICONES[n.tipo as keyof typeof ICONES] ?? Bell;
            return (
              <button
                key={n.id}
                disabled={!tarefa}
                onClick={() => tarefa && setAberta(tarefa.id)}
                className={cn(
                  "flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left fluid last:border-b-0",
                  tarefa ? "cursor-pointer hover:bg-surface" : "cursor-default",
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
                  <span className="flex items-center gap-2">
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
                    {n.nivel === "alta" && (
                      <span className="shrink-0 rounded-full bg-destructive/12 px-2 py-0.5 text-[10.5px] font-semibold text-destructive">
                        Importante
                      </span>
                    )}
                    {statusLabel && (
                      <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] text-muted-foreground">
                        {statusLabel}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">
                    {limpaCorpo(n.body)}
                  </span>
                  <span className="mt-1 block text-[10.5px] text-muted-foreground/70">
                    {dataHora(n.created_at)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <TaskModal task={current} onClose={() => setAberta(null)} />
    </div>
  );
}
