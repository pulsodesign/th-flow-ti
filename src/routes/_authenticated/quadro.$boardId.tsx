import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import {
  ArrowUpDown,
  CalendarDays,
  Check,
  Columns3,
  Filter,
  LayoutGrid,
  List,
  Plus,
  Search,
  UserCheck,
} from "@/components/ui/icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { KanbanView } from "@/components/thc/KanbanView";
import { ListView } from "@/components/thc/ListView";
import { CalendarView } from "@/components/thc/CalendarView";
import { TaskModal } from "@/components/thc/TaskModal";
import { FiltersBar } from "@/components/thc/FiltersBar";
import { BotaoAtualizar } from "@/components/thc/BotaoAtualizar";
import {
  boardLabel,
  tasksForBoard,
  useColumnMutations,
  useTaskMutations,
  useWorkspace,
} from "@/lib/thc/store";
import { useAuth } from "@/lib/thc/auth";
import {
  DEFAULT_FILTERS,
  QUICK_OPTIONS,
  SORT_OPTIONS,
  doneKeysOf,
  filterTasks,
  ocultarArquivadas,
  useStoredState,
  type SortKey,
  type TaskFilters,
} from "@/lib/thc/filters";
import { findBoardByParam } from "@/lib/thc/slug";
import type { Task } from "@/lib/thc/types";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/_authenticated/quadro/$boardId")({
  validateSearch: (search: Record<string, unknown>): { task?: string } =>
    typeof search["task"] === "string" ? { task: search["task"] as string } : {},
  head: () => ({
    meta: [
      { title: "Quadro — TH Flow" },
      {
        name: "description",
        content: "Kanban, lista e calendário das demandas do quadro na TH Flow.",
      },
      { property: "og:title", content: "Quadro — TH Flow" },
      { property: "og:description", content: "Gerencie demandas em Kanban, lista e calendário." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BoardPage,
});

const VIEWS = [
  { id: "kanban", label: "Quadros", icon: Columns3 },
  { id: "lista", label: "Lista", icon: List },
  { id: "calendario", label: "Calendário", icon: CalendarDays },
] as const;

function BoardPage() {
  const { boardId } = useParams({ from: "/_authenticated/quadro/$boardId" });
  const search = useSearch({ from: "/_authenticated/quadro/$boardId" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { projects, statuses, loading, profiles, tasks } = useWorkspace();
  const { userId, isGestor, profile } = useAuth();
  const { createTask } = useTaskMutations();
  const { addColumn } = useColumnMutations();
  const [view, setView] = useStoredState<(typeof VIEWS)[number]["id"]>("thc-board-view", "kanban");
  const [filters, setFilters] = useStoredState<TaskFilters>("thc-board-filtros", DEFAULT_FILTERS);
  const [sort, setSort] = useStoredState<SortKey>("thc-board-sort", "padrao");
  const [open, setOpen] = useState<Task | null>(null);
  const [novoQuadro, setNovoQuadro] = useState(false);
  const [nomeQuadro, setNomeQuadro] = useState("");
  const [busca, setBusca] = useState("");
  const celular = useIsMobile();

  // O parâmetro pode ser um slug amigável ou um UUID (links antigos continuam válidos).
  const board = findBoardByParam(projects, profiles, decodeURIComponent(boardId));
  const boardTasks = board ? tasksForBoard(board, tasks) : [];
  const doneKeys = doneKeysOf(statuses);
  // Entregues há mais de 60 dias ficam arquivadas: só aparecem quando há busca.
  const visiveis = ocultarArquivadas(
    filterTasks(boardTasks, filters, doneKeys, userId),
    doneKeys,
    busca,
  );
  const current = open ? (tasks.find((t) => t.id === open.id) ?? null) : null;

  // Deep link: /quadro/:id?task=<uuid> abre o modal da tarefa automaticamente.
  useEffect(() => {
    if (!search.task) return;
    const alvo = tasks.find((t) => t.id === search.task);
    if (alvo) setOpen(alvo);
  }, [search.task, tasks]);

  if (!board) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-muted-foreground">
        {loading ? "Carregando quadro…" : "Quadro não encontrado."}
      </div>
    );
  }

  const novaTarefa = async () => {
    const t = await createTask.mutateAsync({
      titulo: "Nova tarefa",
      status: statuses[0]?.chave ?? "backlog",
      board_id: board.id,
      ...(board.kind === "mae" ? { is_master: true } : { projeto_id: board.id }),
      ...(board.kind === "individual" && board.owner_id
        ? { usuario_id: [board.owner_id] }
        : board.kind === "departamento" && board.responsaveis_padrao?.length
          ? { usuario_id: board.responsaveis_padrao }
          : {}),
    });
    setOpen(t);
  };

  const criarColuna = async () => {
    const label = nomeQuadro.trim();
    if (!label) return;
    try {
      // Quadro Mãe grava em `statuses` (global); demais quadros em `project_columns` (local).
      await addColumn.mutateAsync({ board, label, posicao: 100 });
      setNomeQuadro("");
      setNovoQuadro(false);
      void qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar a coluna.");
    }
  };

  const fechar = () => {
    setOpen(null);
    if (search.task)
      void navigate({ to: "/quadro/$boardId", params: { boardId }, search: {} as never });
  };

  return (
    <div className="flex h-full flex-col">
      <header className="px-4 pb-3 pt-3 md:px-6 md:py-5">
        <div className="flex flex-wrap items-center justify-between gap-3 md:gap-4">
          <div className="min-w-0 flex-1">
            {board.kind !== "individual" && (
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground max-md:hidden">
                {board.kind === "mae" ? "Operação Geral" : "Projeto do Departamento"}
              </p>
            )}
            <h1 className="truncate pb-[0.12em] text-[24px] font-light leading-[1.15] tracking-[-0.02em] md:mt-1 md:text-[44px]">
              {/* Quadro pessoal: saudação com o nome de quem está logado. */}
              {board.kind === "individual" && board.owner_id === userId && profile?.nome
                ? `Olá, ${profile.nome.split(" ")[0]}`
                : boardLabel(board, profiles)}
            </h1>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
            <BotaoAtualizar className="max-md:size-[46px]" />
            <div className="grid min-w-0 flex-1 grid-cols-3 items-center gap-0.5 rounded-full border border-[var(--glass-border)] bg-surface p-1 md:flex md:w-auto md:flex-none">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setView(v.id)}
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] fluid max-md:h-9 max-md:px-2",
                    view === v.id
                      ? "bg-selected text-selected-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <v.icon className="size-4" /> {v.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => void novaTarefa()}
              className="hidden h-10 items-center md:inline-flex gap-1.5 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground shadow-[var(--shadow-soft)] fluid hover:opacity-90"
            >
              <Plus className="size-5" /> Tarefa
            </button>
            {isGestor && (
              <button
                onClick={() => setNovoQuadro((v) => !v)}
                className="hidden h-10 items-center gap-1.5 rounded-full border border-[var(--glass-border)] bg-surface px-4 text-[13px] font-medium text-foreground fluid hover:bg-surface-2 md:inline-flex"
              >
                <LayoutGrid className="size-4" /> + Coluna
              </button>
            )}
          </div>
        </div>

        {novoQuadro && (
          <div className="mt-3 flex items-center gap-2">
            <input
              autoFocus
              value={nomeQuadro}
              onChange={(e) => setNomeQuadro(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void criarColuna()}
              placeholder="Nome da nova coluna"
              className="w-[280px] rounded-md border border-border bg-surface px-3 py-2 text-[12.5px] outline-none focus:border-primary"
            />
            <button
              onClick={() => void criarColuna()}
              className="rounded-full bg-primary font-semibold px-3 py-2 text-[12.5px] text-primary-foreground fluid hover:opacity-90"
            >
              Criar coluna
            </button>
            <button
              onClick={() => setNovoQuadro(false)}
              className="rounded-md border border-border px-3 py-2 text-[12.5px] fluid hover:bg-surface"
            >
              Cancelar
            </button>
          </div>
        )}

        {/* Celular: uma linha só com + Tarefa, busca e os ícones de filtro e ordenação */}
        <div className="mt-2.5 flex items-center justify-between gap-2 md:mt-3 md:flex-wrap">
          <button
            onClick={() => void novaTarefa()}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-1 rounded-full bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground shadow-[var(--shadow-soft)] fluid active:opacity-90 md:hidden"
          >
            <Plus className="size-5" /> Tarefa
          </button>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 md:flex-none">
            <div className="relative w-full md:w-auto">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder={celular ? "Buscar tarefa" : "Buscar tarefa específica..."}
                className="h-10 w-full rounded-full border border-[var(--glass-border)] bg-surface pr-3 pl-10 text-[12px] text-foreground outline-none transition-colors focus:border-primary/50 md:h-9 md:w-64"
              />
              {busca && (
                <button
                  onClick={() => setBusca("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  Limpar
                </button>
              )}
            </div>
            {view !== "calendario" && (
              <div className="flex min-w-0 items-center gap-1.5 max-md:hidden">
                <span className="text-[12px] text-muted-foreground max-md:hidden">
                  Filtrar por:
                </span>
                <FiltersBar filters={filters} onChange={setFilters} />
              </div>
            )}
          </div>
          {view !== "calendario" && (
            <div className="flex shrink-0 items-center gap-2 md:hidden">
              <BandejaFiltros filters={filters} onChange={setFilters} />
              <BandejaOrdem sort={sort} onChange={setSort} />
            </div>
          )}
          {view !== "calendario" && (
            <label className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground max-md:hidden">
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
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden rise-in">
        {view === "kanban" && (
          <KanbanView board={board} tasks={visiveis} onOpen={setOpen} sort={sort} busca={busca} />
        )}
        {view === "lista" && (
          <ListView board={board} tasks={visiveis} onOpen={setOpen} busca={busca} />
        )}
        {view === "calendario" && (
          <CalendarView
            tasks={visiveis}
            onOpen={setOpen}
            busca={busca}
            filters={filters}
            onFiltersChange={setFilters}
            onCreateTask={async (dateISO, titulo) => {
              const t = await createTask.mutateAsync({
                titulo: titulo?.trim() || "Nova tarefa",
                status: statuses[0]?.chave ?? "backlog",
                board_id: board.id,
                data_vencimento: dateISO,
                ...(board.kind === "mae" ? { is_master: true } : { projeto_id: board.id }),
                ...(board.kind === "individual" && board.owner_id
                  ? { usuario_id: [board.owner_id] }
                  : board.kind === "departamento" && board.responsaveis_padrao?.length
                    ? { usuario_id: board.responsaveis_padrao }
                    : {}),
              });
              if (!titulo?.trim()) setOpen(t);
            }}
          />
        )}
      </div>

      <TaskModal task={current} onClose={fechar} />
    </div>
  );
}

const bandejaBotao =
  "relative grid size-10 shrink-0 place-items-center rounded-full border border-[var(--glass-border)] bg-surface text-foreground shadow-[var(--shadow-soft)] fluid data-[state=open]:bg-selected data-[state=open]:text-selected-foreground";
const bandejaItem =
  "flex h-11 w-full items-center justify-between gap-3 rounded-[14px] px-3 text-left text-[13.5px] fluid active:bg-surface-2";

/** Filtro de exibição recolhido num ícone (celular). */
function BandejaFiltros({
  filters,
  onChange,
}: {
  filters: TaskFilters;
  onChange: (f: TaskFilters) => void;
}) {
  const ativos = (filters.quick !== "todas" ? 1 : 0) + (filters.onlyMine ? 1 : 0);
  return (
    <Popover>
      <PopoverTrigger aria-label="Filtrar tarefas" className={bandejaBotao}>
        <Filter className="size-5" />
        {ativos > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid size-[18px] place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
            {ativos}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[260px] rounded-[22px] border-[var(--glass-border)] p-2"
      >
        <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Exibir
        </p>
        {QUICK_OPTIONS.map((o) => (
          <button
            key={o.id}
            onClick={() => onChange({ ...filters, quick: o.id })}
            className={bandejaItem}
          >
            {o.label}
            {filters.quick === o.id && <Check className="size-5 text-primary-ink" />}
          </button>
        ))}
        <div className="mx-3 my-1 h-px bg-border" />
        <button
          onClick={() => onChange({ ...filters, onlyMine: !filters.onlyMine })}
          className={bandejaItem}
        >
          <span className="inline-flex items-center gap-2">
            <UserCheck className="size-4" /> Só minhas tarefas
          </span>
          {filters.onlyMine && <Check className="size-5 text-primary-ink" />}
        </button>
      </PopoverContent>
    </Popover>
  );
}

/** Ordenação recolhida num ícone (celular). */
function BandejaOrdem({ sort, onChange }: { sort: SortKey; onChange: (s: SortKey) => void }) {
  const [aberto, setAberto] = useState(false);
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger aria-label="Ordenar tarefas" className={bandejaBotao}>
        <ArrowUpDown className="size-5" />
        {sort !== "padrao" && (
          <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-primary ring-2 ring-surface" />
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[260px] rounded-[22px] border-[var(--glass-border)] p-2"
      >
        <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Ordenar por
        </p>
        {SORT_OPTIONS.map((o) => (
          <button
            key={o.id}
            onClick={() => {
              onChange(o.id);
              setAberto(false);
            }}
            className={bandejaItem}
          >
            {o.label}
            {sort === o.id && <Check className="size-5 text-primary-ink" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
