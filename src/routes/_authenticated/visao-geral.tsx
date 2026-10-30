import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Search } from "@/components/ui/icon";
import { useWorkspace } from "@/lib/thc/store";
import { rodaHorizontal } from "@/lib/thc/roda";
import { useAuth } from "@/lib/thc/auth";
import { Avatar } from "@/components/thc/atoms";
import { TaskCard } from "@/components/thc/TaskCard";
import { TaskModal } from "@/components/thc/TaskModal";
import { FiltersBar } from "@/components/thc/FiltersBar";
import {
  DEFAULT_FILTERS,
  SORT_OPTIONS,
  doneKeysOf,
  filterTasks,
  ocultarArquivadas,
  sortTasks,
  useStoredState,
  type SortKey,
  type TaskFilters,
} from "@/lib/thc/filters";
import { EVENT_STATUS_KEY, isEventoEncerrado, type Task } from "@/lib/thc/types";

export const Route = createFileRoute("/_authenticated/visao-geral")({
  head: () => ({
    meta: [
      { title: "Visão Geral — TH Flow" },
      {
        name: "description",
        content: "Quadro por pessoa: veja com quem está cada tarefa da operação da TH Flow.",
      },
      { property: "og:title", content: "Visão Geral — TH Flow" },
      { property: "og:description", content: "Kanban por responsável, com carga do time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OverviewPage,
});

function OverviewPage() {
  const { profiles, tasks, statuses } = useWorkspace();
  const { userId } = useAuth();
  const [open, setOpen] = useState<Task | null>(null);

  // Estados guardados no localStorage para manter a preferência do usuário
  const [filters, setFilters] = useStoredState<TaskFilters>("thc-visao-filtros", {
    ...DEFAULT_FILTERS,
    quick: "abertas", // Por padrão exibiremos apenas as tarefas em aberto
  });
  const [sort, setSort] = useStoredState<SortKey>("thc-visao-sort", "padrao");

  // Estado para a barra de pesquisa de texto
  const [busca, setBusca] = useState("");

  const current = open ? (tasks.find((t) => t.id === open.id) ?? null) : null;

  // Aplica os filtros (abertas, concluídas, por tag, etc.) globalmente antes de separar
  // Entregues há mais de 60 dias ficam arquivadas: só aparecem quando há busca.
  const doneKeys = doneKeysOf(statuses);
  const visiveisBase = ocultarArquivadas(
    filterTasks(tasks, filters, doneKeys, userId),
    doneKeys,
    busca,
  );

  // Aplicação do filtro de busca por texto em cima das tarefas visíveis
  const visiveis = visiveisBase.filter((t) => {
    if (!busca.trim()) return true;
    const termo = busca.toLowerCase();
    const tituloMatch = t.titulo?.toLowerCase().includes(termo);
    const areaMatch = t.area?.toLowerCase().includes(termo);
    const solicitanteMatch = t.solicitante?.toLowerCase().includes(termo);
    const tagMatch = (t.tags ?? []).some((tag) => tag.nome.toLowerCase().includes(termo));
    return tituloMatch || areaMatch || solicitanteMatch || tagMatch;
  });

  // Separa as tarefas da coluna de Eventos
  const eventosBase = visiveis.filter(
    (t) => t.status === EVENT_STATUS_KEY && !isEventoEncerrado(t),
  );
  const eventos = sortTasks(eventosBase, sort, profiles);

  return (
    <div className="flex h-full flex-col">
      <header className="px-4 py-4 md:px-8 md:py-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Operação
        </p>
        <h1 className="mt-1 text-[30px] font-light leading-[1.05] tracking-[-0.02em] md:text-[44px]">
          Visão Geral
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Cada coluna é uma pessoa da equipe, com as tarefas sob responsabilidade dela.
        </p>

        {/* BARRA DE PESQUISA, FILTROS E ORDENAÇÃO */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Campo de pesquisa de texto com ícone de lupa */}
            <div className="relative w-full md:w-auto">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar tarefa específica..."
                className="h-9 w-full rounded-full border border-[var(--glass-border)] bg-surface pr-3 pl-10 text-[12px] text-foreground outline-none transition-colors focus:border-primary/50 md:w-64"
              />
              {busca && (
                <button
                  onClick={() => setBusca("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  Limpar
                </button>
              )}
            </div>

            <div className="flex min-w-0 items-center gap-1.5 max-md:w-full">
              <span className="text-[12px] text-muted-foreground max-md:hidden">Filtrar por:</span>
              <FiltersBar filters={filters} onChange={setFilters} />
            </div>
          </div>

          <label className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            Ordenar por
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-9 rounded-full border border-[var(--glass-border)] bg-surface px-3.5 text-[12px] text-foreground outline-none"
            >
              {SORT_OPTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <div
        onWheel={rodaHorizontal}
        className="flex min-h-0 flex-1 snap-x snap-mandatory gap-4 overflow-x-auto px-3 py-4 md:snap-none md:px-6 md:py-5 rise-in"
      >
        {profiles.map((p) => {
          // Filtra as tarefas visíveis que pertencem a este perfil específico e ordena
          const baseItems = visiveis.filter(
            (t) => t.usuario_id.includes(p.id) && t.status !== EVENT_STATUS_KEY,
          );
          const items = sortTasks(baseItems, sort, profiles);

          return (
            <section
              key={p.id}
              className="glass flex w-[85vw] max-w-[300px] shrink-0 snap-center flex-col overflow-hidden rounded-[28px] md:w-[300px] md:max-w-none"
            >
              <header className="flex items-center gap-2.5 px-4 py-3.5">
                <Avatar user={p} size={30} />
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{p.nome}</span>
                <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {items.length}
                </span>
              </header>
              <div className="lista-coluna mb-2.5 min-h-0 flex-1 space-y-2.5 overflow-auto px-2.5 pb-5">
                {items.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    profiles={profiles}
                    statuses={statuses}
                    onOpen={() => setOpen(t)}
                  />
                ))}
                {!items.length && (
                  <p className="px-1 text-[11.5px] text-muted-foreground">
                    Sem tarefas para exibir.
                  </p>
                )}
              </div>
            </section>
          );
        })}

        {/* COLUNA ESPECÍFICA DE EVENTOS */}
        <section className="flex w-[300px] shrink-0 flex-col overflow-hidden rounded-[28px] border border-event/30 bg-event/8">
          <header className="flex items-center gap-2.5 px-4 py-3.5 text-[15px] font-medium text-event-foreground">
            <CalendarDays className="size-5 text-event-foreground" />
            <span className="min-w-0 flex-1 truncate">Eventos</span>
            <span className="text-[11px] text-event-foreground">{eventos.length}</span>
          </header>
          <div className="lista-coluna mb-2.5 min-h-0 flex-1 space-y-2.5 overflow-auto px-2.5 pb-5">
            {eventos.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                profiles={profiles}
                statuses={statuses}
                onOpen={() => setOpen(t)}
              />
            ))}
            {!eventos.length && (
              <p className="px-1 text-[11.5px] text-muted-foreground">Sem eventos para exibir.</p>
            )}
          </div>
        </section>
      </div>

      <TaskModal task={current} onClose={() => setOpen(null)} />
    </div>
  );
}
