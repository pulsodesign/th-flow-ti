import { useRef, useState, type WheelEvent } from "react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Filter,
  Flag,
  Plus,
  User,
} from "@/components/ui/icon";
import { useHolidays } from "@/lib/thc/holidays";
import { useTaskMutations, useWorkspace } from "@/lib/thc/store";
import { DEFAULT_FILTERS, matchBusca, useStoredState, type TaskFilters } from "@/lib/thc/filters";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isEventTask, taskOnDay, type Task, type Profile } from "@/lib/thc/types";
import { addDaysISO, diffDays, todayISO } from "@/lib/thc/utils";
import { Avatar } from "@/components/thc/atoms";
import { cn } from "@/lib/utils";

/** Semana começa na segunda — sábado e domingo ficam condensados no fim. */
const WEEK = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Segunda-feira da semana da data informada. */
function mondayOf(date: Date) {
  const d = new Date(date);
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Componente auxiliar interno para renderizar o avatar ou as iniciais (fallback) */
function TaskAssigneeAvatars({ task, profiles }: { task: Task; profiles: Profile[] }) {
  // Se for uma tarefa da coluna de eventos, não exibe avatares
  if (isEventTask(task.status)) return null;

  const assignees = (task.usuario_id ?? [])
    .map((id) => profiles.find((p) => p.id === id))
    .filter(Boolean) as Profile[];

  if (!assignees.length) {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-border bg-muted shrink-0">
        <User className="size-2.5 text-muted-foreground" />
      </span>
    );
  }

  return (
    <div className="flex -space-x-1.5 shrink-0 items-center">
      {assignees.slice(0, 2).map((p) => (
        <Avatar key={p.id} user={p} size={20} className="ring-2 ring-[var(--tile)]" />
      ))}
      {assignees.length > 2 && (
        <span className="flex size-5 items-center justify-center rounded-full bg-surface-2 text-[9px] font-medium text-foreground ring-1 ring-card">
          +{assignees.length - 2}
        </span>
      )}
    </div>
  );
}

export function CalendarView({
  tasks: tasksTodas,
  onOpen,
  onCreateTask,
  filters = DEFAULT_FILTERS,
  busca = "",
  onFiltersChange,
}: {
  tasks: Task[];
  onOpen: (t: Task) => void;
  onCreateTask?: (dateISO: string, title?: string) => void;
  filters?: TaskFilters;
  busca?: string;
  onFiltersChange?: (f: TaskFilters) => void;
}) {
  const { createTask, updateTask } = useTaskMutations();
  const { statuses, profiles } = useWorkspace();
  const [modo, setModo] = useStoredState<"mes" | "semana">("thc-calendario-modo", "mes");
  const [cursor, setCursor] = useState(() => new Date());
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [expandidos, setExpandidos] = useState<string[]>([]);
  const [filtrosAberto, setFiltrosAberto] = useState(false);
  // Celular, visão Mês: dia tocado na grade (null mostra a agenda do mês inteiro)
  const [diaSel, setDiaSel] = useState<string | null>(null);

  // Estados para criação rápida de tarefa no dia
  const [addingDate, setAddingDate] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const tasks = tasksTodas.filter((t) => matchBusca(t, busca));
  const semData = tasks.filter((t) => !t.data_vencimento).length;

  const dias = (() => {
    if (modo === "semana") {
      const start = mondayOf(cursor);
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return { date: d, iso: isoOf(d), inMonth: true };
      });
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = mondayOf(first);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return { date: d, iso: isoOf(d), inMonth: d.getMonth() === cursor.getMonth() };
    });
  })();

  // Feriados (referência visual — nunca viram tarefas no Kanban)
  const feriados = useHolidays([...new Set(dias.map((d) => d.date.getFullYear()))]);

  const fimDeSemana = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
  const expandido = (iso: string) => expandidos.includes(iso);

  const colunas = `repeat(5, minmax(0, 1fr)) ${
    dias.some((d) => d.date.getDay() === 6 && expandido(d.iso))
      ? "minmax(0,1fr)"
      : "minmax(0,0.55fr)"
  } ${
    dias.some((d) => d.date.getDay() === 0 && expandido(d.iso))
      ? "minmax(0,1fr)"
      : "minmax(0,0.55fr)"
  }`;

  const mover = (delta: number) => {
    setDiaSel(null);
    if (modo === "semana") {
      const d = new Date(cursor);
      d.setDate(d.getDate() + delta * 7);
      setCursor(d);
    } else {
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
    }
  };

  const drop = async (iso: string) => {
    setOver(null);
    const task = tasks.find((t) => t.id === drag);
    setDrag(null);
    if (!task || task.data_vencimento === iso) return;
    const patch: Partial<Task> = { data_vencimento: iso };
    if (isEventTask(task.status)) {
      // Evento: move o período inteiro, mantendo a duração (o dia solto vira o início).
      if (task.evento_inicio) {
        const dur = diffDays(task.evento_inicio, task.data_vencimento ?? task.evento_inicio);
        patch.evento_inicio = iso;
        patch.data_vencimento = addDaysISO(iso, dur);
      }
    } else if (task.data_inicio && task.data_vencimento) {
      const dur = diffDays(task.data_inicio, task.data_vencimento);
      patch.data_inicio = addDaysISO(iso, -dur);
    }
    await updateTask.mutateAsync({ id: task.id, previous: task, patch });
  };

  const handleConfirmAdd = async (iso: string) => {
    if (addingDate !== iso) return;
    const titulo = draft.trim();
    setAddingDate(null);
    setDraft("");

    if (!titulo) return;

    if (onCreateTask) {
      onCreateTask(iso, titulo);
    } else {
      const statusInicial = statuses[0]?.chave ?? "backlog";
      await createTask.mutateAsync({
        titulo,
        data_vencimento: iso,
        status: statusInicial,
      });
    }
  };

  /** Tick independente: alterna apenas is_completed, sem mover a tarefa de coluna. */
  const toggleDone = async (t: Task) => {
    if (isEventTask(t.status)) return;
    await updateTask.mutateAsync({
      id: t.id,
      previous: t,
      patch: { is_completed: !t.is_completed },
    });
  };

  const bruto =
    modo === "semana"
      ? `Semana de ${mondayOf(cursor).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}`
      : cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const titulo = bruto.charAt(0).toUpperCase() + bruto.slice(1);

  // Swipe horizontal (mobile) para navegar entre períodos
  const touchX = useRef<number | null>(null);
  const wheelLock = useRef(0);
  const onWheel = (e: WheelEvent) => {
    if (Math.abs(e.deltaY) < 8) return;
    // Se o cursor está sobre a lista de tarefas de um dia que ainda pode rolar
    // na direção do gesto, deixe a rolagem vertical interna acontecer em vez
    // de trocar de mês/semana.
    let el = e.target as HTMLElement | null;
    while (el && el !== e.currentTarget) {
      if (el.getAttribute?.("data-cal-scroll") === "1") {
        const canDown = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
        const canUp = el.scrollTop > 0;
        if (e.deltaY > 0 && canDown) return;
        if (e.deltaY < 0 && canUp) return;
        break;
      }
      el = el.parentElement;
    }
    const agora = Date.now();
    if (agora - wheelLock.current < 320) return;
    wheelLock.current = agora;
    mover(e.deltaY > 0 ? 1 : -1);
  };

  const filtrosAtivos = (filters.quick !== "todas" ? 1 : 0) + (filters.onlyMine ? 1 : 0);

  return (
    <div className="flex h-full flex-col px-3 pb-4 pt-1 md:px-6 md:py-5">
      {/* Toolbar superior */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            aria-label={modo === "semana" ? "Semana anterior" : "Mês anterior"}
            onClick={() => mover(-1)}
            className="grid size-9 place-items-center rounded-full border border-[var(--glass-border)] bg-surface transition-colors hover:bg-surface-2"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="h-9 rounded-full border border-[var(--glass-border)] bg-surface px-4 text-[13px] transition-colors hover:bg-surface-2"
          >
            Hoje
          </button>
          <button
            aria-label={modo === "semana" ? "Próxima semana" : "Próximo mês"}
            onClick={() => mover(1)}
            className="grid size-9 place-items-center rounded-full border border-[var(--glass-border)] bg-surface transition-colors hover:bg-surface-2"
          >
            <ChevronRight className="size-5" />
          </button>
          <h2 className="ml-3 text-[22px] font-light tracking-[-0.01em] max-md:ml-1.5 max-md:text-[19px]">
            {titulo}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="mr-1 flex items-center gap-0.5 rounded-full border border-[var(--glass-border)] bg-surface p-1">
            {(["mes", "semana"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setModo(m)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-[12px] transition-colors max-md:h-9",
                  modo === m
                    ? "bg-selected text-selected-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "mes" ? "Mês" : "Semana"}
              </button>
            ))}
          </div>

          <span className="flex h-9 items-center rounded-full border border-[var(--glass-border)] bg-surface px-4 text-[13px] text-foreground">
            Sem data ({semData})
          </span>

          <Popover open={filtrosAberto} onOpenChange={setFiltrosAberto}>
            <PopoverTrigger asChild>
              <button className="flex h-9 items-center gap-2 rounded-full border border-[var(--glass-border)] bg-surface px-4 text-[13px] transition-colors hover:bg-surface-2">
                <Filter className="size-4" /> Filtrar
                {filtrosAtivos > 0 && (
                  <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                    {filtrosAtivos}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-80 rounded-[22px] border border-border bg-popover p-4 text-foreground shadow-xl"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold">Filtros</p>
                <button
                  onClick={() => onFiltersChange?.(DEFAULT_FILTERS)}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Apagar
                </button>
              </div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Filtros rápidos</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() =>
                    onFiltersChange?.({
                      ...filters,
                      quick: filters.quick === "abertas" ? "todas" : "abertas",
                    })
                  }
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] transition-colors",
                    filters.quick === "abertas"
                      ? "border-transparent bg-selected text-selected-foreground"
                      : "border-border text-foreground hover:border-muted-foreground/50 hover:text-foreground",
                  )}
                >
                  <Check
                    className={cn(
                      "size-3",
                      filters.quick === "abertas" ? "text-current" : "text-muted-foreground",
                    )}
                  />
                  Tarefas por concluir
                </button>
                <button
                  onClick={() =>
                    onFiltersChange?.({
                      ...filters,
                      quick: filters.quick === "concluidas" ? "todas" : "concluidas",
                    })
                  }
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] transition-colors",
                    filters.quick === "concluidas"
                      ? "border-transparent bg-selected text-selected-foreground"
                      : "border-border text-foreground hover:border-muted-foreground/50 hover:text-foreground",
                  )}
                >
                  <Check
                    className={cn(
                      "size-3",
                      filters.quick === "concluidas" ? "text-current" : "text-muted-foreground",
                    )}
                  />
                  Tarefas concluídas
                  <ChevronDown className="size-3 text-muted-foreground" />
                </button>
                <button
                  onClick={() => onFiltersChange?.({ ...filters, onlyMine: !filters.onlyMine })}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] transition-colors",
                    filters.onlyMine
                      ? "border-transparent bg-selected text-selected-foreground"
                      : "border-border text-foreground hover:border-muted-foreground/50 hover:text-foreground",
                  )}
                >
                  <User className="size-3" />
                  Só as minhas tarefas
                </button>
              </div>
              <button className="mt-3 flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
                <Plus className="size-3.5" /> Adicionar filtro
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* MOBILE: visão agenda (dias com conteúdo empilhados) */}
      <div
        onTouchStart={(e) => {
          touchX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const inicio = touchX.current;
          const fim = e.changedTouches[0]?.clientX ?? null;
          touchX.current = null;
          if (inicio == null || fim == null) return;
          const delta = fim - inicio;
          if (Math.abs(delta) > 60) mover(delta < 0 ? 1 : -1);
        }}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto md:hidden"
      >
        {modo === "mes" && (
          <div className="rounded-[22px] border border-[var(--glass-border)] bg-tile p-2">
            <div className="grid grid-cols-7 pb-1 text-center text-[10.5px] font-medium text-muted-foreground">
              {WEEK.map((w) => (
                <span key={w}>{w.slice(0, 3)}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-0.5">
              {dias.map((c) => {
                const doDia = tasks.filter((t) => taskOnDay(t, c.iso));
                const feriado = (feriados.get(c.iso) ?? []).length > 0;
                const hoje = c.iso === todayISO();
                const sel = diaSel === c.iso;
                return (
                  <button
                    key={c.iso}
                    aria-label={c.date.toLocaleDateString("pt-BR", {
                      day: "numeric",
                      month: "long",
                    })}
                    aria-pressed={sel}
                    onClick={() => setDiaSel(sel ? null : c.iso)}
                    className={cn(
                      "flex h-12 flex-col items-center justify-start gap-1 rounded-[14px] pt-1.5 fluid",
                      sel && "bg-selected text-selected-foreground",
                      !c.inMonth && !sel && "opacity-35",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-6 place-items-center rounded-full text-[12.5px]",
                        hoje && !sel && "bg-primary font-semibold text-primary-foreground",
                        feriado && !hoje && !sel && "text-holiday",
                      )}
                    >
                      {c.date.getDate()}
                    </span>
                    <span className="flex h-1.5 items-center gap-[3px]">
                      {doDia.slice(0, 3).map((t) => (
                        <span
                          key={t.id}
                          className={cn(
                            "size-1.5 rounded-full",
                            isEventTask(t.status) ? "bg-event" : sel ? "bg-current" : "bg-primary",
                            t.is_completed && "opacity-40",
                          )}
                        />
                      ))}
                      {doDia.length > 3 && <span className="text-[9px] leading-none">+</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {dias
          .filter((c) =>
            diaSel && modo === "mes"
              ? c.iso === diaSel
              : (modo === "semana" || c.inMonth) &&
                (tasks.some((t) => taskOnDay(t, c.iso)) || (feriados.get(c.iso) ?? []).length),
          )
          .map((c) => {
            const doDia = tasks.filter((t) => taskOnDay(t, c.iso));
            return (
              <section
                key={c.iso}
                className="rounded-[20px] border border-[var(--glass-border)] bg-tile p-3"
              >
                <header className="mb-1.5 flex items-center justify-between">
                  <p
                    className={cn(
                      "text-[12px] font-semibold",
                      c.iso === todayISO() ? "text-primary-ink" : "text-foreground",
                    )}
                  >
                    {c.date.toLocaleDateString("pt-BR", {
                      weekday: "short",
                      day: "2-digit",
                      month: "short",
                    })}
                  </p>
                  <button
                    aria-label={`Nova tarefa em ${c.iso}`}
                    onClick={() => {
                      setAddingDate(c.iso);
                      setDraft("");
                    }}
                    className="rounded-full border border-border p-1 text-muted-foreground"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </header>

                {(feriados.get(c.iso) ?? []).map((f) => (
                  <div
                    key={f.name}
                    className="mb-1 flex items-center gap-1.5 rounded-full border border-holiday/25 bg-holiday/10 px-2.5 py-1 text-[11px] text-holiday-foreground"
                  >
                    <Flag className="size-3 shrink-0 text-holiday" />
                    <span className="truncate font-medium">{f.name}</span>
                  </div>
                ))}

                {doDia.map((t) => {
                  const inEntregue = statuses.find((s) => s.chave === t.status)?.is_done ?? false;
                  const ticked = !!t.is_completed;
                  const isEvento = isEventTask(t.status);
                  return (
                    <button
                      key={t.id}
                      onClick={() => onOpen(t)}
                      className={cn(
                        "mb-1 flex w-full items-center justify-between gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-left text-xs",
                        isEvento && "border-event/30 bg-event/15",
                        inEntregue && "opacity-60",
                        !inEntregue && ticked && "opacity-45",
                      )}
                    >
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate",
                          inEntregue && "line-through",
                          !inEntregue && ticked && "grayscale",
                        )}
                      >
                        {t.titulo}
                      </span>
                      <span className={cn(!inEntregue && ticked && "grayscale")}>
                        <TaskAssigneeAvatars task={t} profiles={profiles} />
                      </span>
                    </button>
                  );
                })}

                {addingDate === c.iso && (
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleConfirmAdd(c.iso);
                      }
                      if (e.key === "Escape") {
                        setAddingDate(null);
                        setDraft("");
                      }
                    }}
                    onBlur={() => void handleConfirmAdd(c.iso)}
                    placeholder="Nome da tarefa…"
                    className="mt-1 w-full rounded-full border border-primary/50 bg-surface px-3 py-1.5 text-xs outline-none"
                  />
                )}
              </section>
            );
          })}

        {!(diaSel && modo === "mes") &&
          !dias.some(
            (c) =>
              (modo === "semana" || c.inMonth) &&
              (tasks.some((t) => taskOnDay(t, c.iso)) || (feriados.get(c.iso) ?? []).length),
          ) && (
            <p className="px-1 py-8 text-center text-[12px] text-muted-foreground">
              Nenhuma tarefa neste período.
            </p>
          )}
      </div>

      <div
        className="hidden gap-px text-[11px] text-muted-foreground md:grid"
        style={{ gridTemplateColumns: colunas }}
      >
        {WEEK.map((w, i) => (
          <div key={w} className={cn("px-3 pb-2 text-[12px] font-medium", i >= 5 && "opacity-45")}>
            {w}
          </div>
        ))}
      </div>

      <div
        onWheel={onWheel}
        className="glass hidden min-h-0 flex-1 gap-1.5 overflow-auto rounded-[28px] p-1.5 md:grid"
        style={{ gridTemplateColumns: colunas }}
      >
        {dias.map((c) => {
          const fds = fimDeSemana(c.date);
          const doDia = tasks.filter((t) => taskOnDay(t, c.iso));
          return (
            <div
              key={c.iso}
              onClick={() => {
                if (fds) {
                  setExpandidos((l) =>
                    l.includes(c.iso) ? l.filter((x) => x !== c.iso) : [...l, c.iso],
                  );
                }
                setAddingDate(c.iso);
                setDraft("");
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(c.iso);
              }}
              onDragLeave={() => setOver((o) => (o === c.iso ? null : o))}
              onDrop={() => void drop(c.iso)}
              className={cn(
                "flex flex-col rounded-[18px] border border-[var(--glass-border)] bg-tile p-2 fluid cursor-pointer overflow-hidden transition-colors hover:border-primary/40",
                modo === "semana" ? "min-h-[280px]" : "min-h-[96px]",
                fds && "cal-hatch",
                !c.inMonth && "opacity-60",
                over === c.iso && "border-primary/60 bg-primary/10",
              )}
            >
              <p
                className={cn(
                  "grid size-6 place-items-center rounded-full text-[12px]",
                  c.iso === todayISO()
                    ? "bg-primary font-semibold text-primary-foreground"
                    : c.inMonth
                      ? "text-foreground/80"
                      : "text-muted-foreground/60",
                )}
              >
                {c.date.getDate()}
              </p>

              <div
                data-cal-scroll="1"
                className="cal-thin-scroll mt-1 flex-1 min-h-0 space-y-1 overflow-y-auto pr-0.5"
              >
                {(feriados.get(c.iso) ?? []).map((f) => (
                  <div
                    key={f.name}
                    title={`Feriado ${f.scope}: ${f.name}`}
                    className="mb-1 flex w-full items-center gap-1.5 truncate rounded-full border border-holiday/25 bg-holiday/10 px-2.5 py-1 text-[11px] text-holiday-foreground"
                  >
                    <Flag className="size-3 shrink-0 text-holiday" />
                    <span className="truncate font-medium">{f.name}</span>
                  </div>
                ))}

                {doDia.map((t) => {
                  const inEntregue = statuses.find((s) => s.chave === t.status)?.is_done ?? false;
                  const ticked = !!t.is_completed;
                  const showCheck = ticked || inEntregue;
                  const tickedGray = !inEntregue && ticked ? "grayscale" : undefined;
                  const isEvento = isEventTask(t.status);
                  return (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={() => setDrag(t.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(t);
                      }}
                      className={cn(
                        "group mb-1 flex w-full cursor-pointer items-center justify-between gap-1.5 truncate rounded-full border border-border bg-surface px-2.5 py-1 text-xs shadow-[var(--shadow-soft)] transition-all hover:border-muted-foreground/40",
                        isEvento && "border-event/30 bg-event/20 hover:border-event/50",
                        drag === t.id && "opacity-40",
                        inEntregue && "opacity-50 grayscale",
                        !inEntregue && ticked && "opacity-45",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-1.5 truncate">
                        {isEvento ? (
                          <span title="Evento" className="shrink-0 text-event-foreground">
                            <CalendarDays className="size-3.5" />
                          </span>
                        ) : (
                          <button
                            aria-label={showCheck ? "Reabrir tarefa" : "Concluir tarefa"}
                            onClick={(e) => {
                              e.stopPropagation();
                              void toggleDone(t);
                            }}
                            className={cn(
                              "shrink-0 transition-opacity",
                              showCheck
                                ? "text-success opacity-100"
                                : "text-muted-foreground opacity-0 hover:text-success group-hover:opacity-100",
                            )}
                          >
                            {showCheck ? (
                              <CheckCircle2 className="size-3.5" />
                            ) : (
                              <Circle className="size-3.5" />
                            )}
                          </button>
                        )}
                        <span
                          className={cn(
                            "truncate",
                            tickedGray,
                            inEntregue && "text-muted-foreground line-through",
                            isEvento && "text-event-foreground font-medium",
                          )}
                        >
                          {t.titulo}
                        </span>
                      </div>

                      {/* Exibição dos Avatares / Iniciais dos Responsáveis (Oculto automaticamente para eventos) */}
                      <span className={cn(tickedGray)}>
                        <TaskAssigneeAvatars task={t} profiles={profiles} />
                      </span>
                    </div>
                  );
                })}

                {/* Input rápido de nova tarefa */}
                {addingDate === c.iso && (
                  <div onClick={(e) => e.stopPropagation()} className="mt-1">
                    <input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleConfirmAdd(c.iso);
                        }
                        if (e.key === "Escape") {
                          setAddingDate(null);
                          setDraft("");
                        }
                      }}
                      onBlur={() => void handleConfirmAdd(c.iso)}
                      placeholder="Nome da tarefa…"
                      className="w-full rounded-full border border-primary/50 bg-surface px-2.5 py-1 text-xs text-foreground outline-none shadow-sm placeholder:text-muted-foreground/60"
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
