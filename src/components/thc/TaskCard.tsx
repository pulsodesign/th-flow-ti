import {
  Calendar,
  CalendarDays,
  CheckCircle2,
  Circle,
  MessageSquare,
  Pencil,
  Repeat,
  User,
} from "@/components/ui/icon";
import { Avatar, PriorityBadge, ProgressBar, TagChip } from "@/components/thc/atoms";
import { isEventTask, type Profile, type Status, type Task } from "@/lib/thc/types";
import { formatDate, isOverdue, progress } from "@/lib/thc/utils";
import { cn } from "@/lib/utils";
import { useTaskMutations } from "@/lib/thc/store";

export function TaskCard({
  task,
  profiles,
  statuses,
  onOpen,
  onDragStart,
  dragging,
}: {
  task: Task;
  profiles: Profile[];
  statuses: Status[];
  onOpen: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  dragging?: boolean;
}) {
  const { updateTask } = useTaskMutations();
  const pr = progress(task);
  const overdue = isOverdue(task, statuses);

  // "inEntregue": a tarefa está na coluna de conclusão (status is_done). Esse é o
  // único caso que recebe o visual forte (opaco + tachado).
  const inEntregue = statuses.find((s) => s.chave === task.status)?.is_done ?? false;
  // "ticked": marcação de conclusão independente, alternada pelo checkbox. Não move
  // a tarefa de coluna — apenas liga o ícone verde de check.
  const ticked = !!task.is_completed;
  const showCheck = ticked || inEntregue;
  // Grayscale aplicado apenas no conteúdo (não no ícone de check) para cards tickados
  // fora da coluna "Entregue". O filtro CSS grayscale no pai afeta todos os filhos,
  // então aplicamos individualmente nas seções, deixando o checkbox de fora.
  const tickedGray = !inEntregue && ticked ? "grayscale" : undefined;

  const isEvento = isEventTask(task.status);
  const assignees = task.usuario_id.map((id) => profiles.find((p) => p.id === id) ?? null);
  const hasAssignees = assignees.some(Boolean);
  const hasDate = !!task.data_vencimento;

  /** Tick independente: altera apenas a marcação de conclusão (is_completed), sem
   * mover a tarefa para a coluna "Entregue". A tarefa permanece onde está. */
  const handleToggleDone = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateTask.mutate({
      id: task.id,
      previous: task,
      patch: { is_completed: !task.is_completed },
    });
  };

  return (
    <article
      draggable
      onDragStart={onDragStart}
      onClick={onOpen}
      className={cn(
        "group relative flex cursor-pointer flex-col rounded-[22px] p-4 shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5",
        // Estilo específico para a coluna de Eventos (mantém o tom âmbar)
        isEvento
          ? "border border-event/40 bg-event/10 hover:border-event/60"
          : // Padrão unificado para todos os outros cards: sem traçado fixo, borda sutil apenas ao passar o mouse
            "border border-[var(--glass-border)] bg-tile hover:shadow-[var(--shadow-lift)]",
        dragging && "opacity-40",
        // Visual forte (opaco + sem cor) EXCLUSIVO da coluna "Entregue".
        inEntregue && "opacity-50 grayscale",
        // Tick em coluna anterior: apenas 45% opacidade. O grayscale vai nas seções internas.
        !inEntregue && ticked && "opacity-45",
      )}
    >
      {/* CAMPOS: Prioridade, Área, Tags, Mãe, Versão */}
      <div className="flex items-start gap-2">
        <div className={cn("flex min-w-0 flex-1 flex-wrap items-center gap-1.5", tickedGray)}>
          <PriorityBadge priority={task.prioridade} />
          {task.area && (
            <span className="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-1 text-[10.5px] font-medium leading-none text-foreground">
              {task.area}
            </span>
          )}
          {(task.tags ?? []).map((tg, i) => (
            <TagChip key={`${tg.nome}-${i}`} label={tg.nome} color={tg.cor} />
          ))}
          {task.versao != null && (
            <span
              title={`Versão V${task.versao}`}
              className={cn(
                "inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold leading-none",
                task.versao === 6
                  ? "bg-destructive/15 text-destructive"
                  : "bg-surface-2 text-muted-foreground",
              )}
            >
              V{task.versao}
            </span>
          )}
        </div>
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          title="Editar tarefa"
          aria-label="Editar tarefa"
          className="-mr-1 -mt-1 shrink-0 rounded-full p-1 text-muted-foreground opacity-0 transition-opacity duration-150 hover:bg-surface-2 hover:text-foreground group-hover:opacity-100 [@media(hover:none)]:opacity-60"
        >
          <Pencil className="size-3.5" />
        </button>
      </div>

      {/* LINHA: Checkbox / Ícone Evento + Título */}
      <div className="mt-3 flex w-full items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          {isEvento ? (
            <span
              title="Evento"
              className="mt-0.5 inline-flex shrink-0 items-center justify-center text-event-foreground"
            >
              <CalendarDays className="size-5" />
            </span>
          ) : (
            <button
              type="button"
              tabIndex={-1}
              onClick={handleToggleDone}
              title={showCheck ? "Concluída" : "Marcar como concluída"}
              aria-label={showCheck ? "Concluída" : "Marcar como concluída"}
              className={cn(
                "mt-0.5 shrink-0 rounded-full transition-colors",
                showCheck ? "text-success" : "text-muted-foreground hover:text-success",
              )}
            >
              {showCheck ? (
                <span className="inline-flex items-center justify-center rounded-full bg-success/20">
                  <CheckCircle2 className="size-5" />
                </span>
              ) : (
                <Circle className="size-5" />
              )}
            </button>
          )}

          <div className={cn("min-w-0 pt-0.5", tickedGray)}>
            <p
              className={cn(
                "text-[14.5px] font-medium leading-snug text-foreground",
                // Tachado EXCLUSIVO da coluna "Entregue" (tick em outra coluna mantém texto normal).
                inEntregue && "text-muted-foreground line-through",
                isEvento && "text-event-foreground font-semibold",
              )}
            >
              {task.titulo}
            </p>
          </div>
        </div>
      </div>

      {/* SUBTAREFAS */}
      {pr && (
        <div className={cn("mt-3.5 pl-[30px]", tickedGray)}>
          <div className="mb-2 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
            <span>Subtarefas</span>
            <span>
              {pr.done}/{pr.total} · {pr.pct}%
            </span>
          </div>
          <ProgressBar pct={pr.pct} />
        </div>
      )}

      {/* RODAPÉ: Responsável + Data + Descrição */}
      <div
        className={cn(
          "mt-4 flex items-center gap-2 border-t border-dashed border-border pt-3.5 text-xs text-muted-foreground",
          tickedGray,
        )}
      >
        {hasAssignees ? (
          <span className="flex -space-x-1.5">
            {assignees
              .filter(Boolean)
              .slice(0, 3)
              .map((u) => (
                <Avatar
                  key={(u as Profile).id}
                  user={u}
                  size={26}
                  className="ring-2 ring-[var(--tile)]"
                />
              ))}
            {assignees.filter(Boolean).length > 3 && (
              <span
                className="inline-flex items-center justify-center rounded-full bg-surface-2 text-[10px] font-semibold text-foreground ring-2 ring-[var(--tile)]"
                style={{ width: 26, height: 26 }}
              >
                +{assignees.filter(Boolean).length - 3}
              </span>
            )}
          </span>
        ) : (
          <span className="flex size-[26px] items-center justify-center rounded-full border border-dashed border-border bg-muted">
            <User className="size-3 text-muted-foreground" />
          </span>
        )}

        {hasDate ? (
          <span
            className={cn(
              "ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium",
              overdue && !inEntregue
                ? "bg-destructive/12 text-destructive"
                : "bg-surface-2 text-muted-foreground",
              isEvento && "text-event-foreground",
            )}
          >
            <Calendar className="size-3.5" />
            {isEvento && task.evento_inicio && task.evento_inicio !== task.data_vencimento
              ? `${formatDate(task.evento_inicio)} – ${formatDate(task.data_vencimento)}`
              : formatDate(task.data_vencimento)}
          </span>
        ) : (
          <span
            title="Definir data de conclusão"
            className="ml-auto flex size-[26px] items-center justify-center rounded-full border border-dashed border-border opacity-0 transition-opacity group-hover:opacity-100"
          >
            <Calendar className="size-3 text-muted-foreground" />
          </span>
        )}

        {task.serie_id && (
          <span
            className="flex items-center"
            title={`Repete todo mês${task.serie_indice && task.serie_total ? ` (${task.serie_indice} de ${task.serie_total})` : ""}`}
          >
            <Repeat className="size-4 text-muted-foreground" />
          </span>
        )}

        {task.descricao && (
          <span className="flex items-center">
            <MessageSquare className="size-4 text-muted-foreground" />
          </span>
        )}
      </div>
    </article>
  );
}
