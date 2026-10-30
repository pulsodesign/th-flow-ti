import { useRef, useState } from "react";
import { GripVertical, Palette, Pencil, Plus, RotateCcw, Star, Trash2 } from "@/components/ui/icon";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/dados/cliente";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TaskCard } from "@/components/thc/TaskCard";
import { boardColumns, useColumnMutations, useTaskMutations, useWorkspace } from "@/lib/thc/store";
import { sortTasks, type SortKey } from "@/lib/thc/filters";
import { useAuth } from "@/lib/thc/auth";
import { EVENT_STATUS_KEY, TAG_COLORS, type Project, type Task } from "@/lib/thc/types";
import { cn } from "@/lib/utils";
import { rodaHorizontal } from "@/lib/thc/roda";

/** Ordem fixa da coluna de entrega: mais recente primeiro; sem data vai para o fim. */
function ordemEntregue(tasks: Task[]) {
  return [...tasks].sort((a, b) => {
    if (!a.concluida_em && !b.concluida_em) return 0;
    if (!a.concluida_em) return 1;
    if (!b.concluida_em) return -1;
    return b.concluida_em.localeCompare(a.concluida_em);
  });
}

const CORES_COLUNA = ["oklch(0.68 0.017 260)", "oklch(0.6 0.05 260)", ...TAG_COLORS];

export function KanbanView({
  board,
  tasks,
  onOpen,
  sort = "padrao",
  busca = "",
}: {
  board: Project;
  tasks: Task[];
  onOpen: (t: Task) => void;
  sort?: SortKey;
  busca?: string;
}) {
  const { statuses, columns, columnOrder, profiles } = useWorkspace();
  const { isGestor } = useAuth();
  const { createTask, updateTask } = useTaskMutations();
  const {
    addColumn: addColumnMutation,
    reorderColumns,
    resetColumnOrder,
    deleteColumn,
    setColumnColor,
  } = useColumnMutations();
  const qc = useQueryClient();
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  // Card alvo do hover durante o arrasto (para reordenar dentro da coluna).
  const [overCard, setOverCard] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newColumn, setNewColumn] = useState(false);
  const [columnName, setColumnName] = useState("");

  // Drag-and-drop do CABEÇALHO das colunas (reordenar), separado do drag dos cards.
  const [colDrag, setColDrag] = useState<string | null>(null);
  const [colOver, setColOver] = useState<string | null>(null);

  // Obtém as colunas padrão do quadro
  const rawCols = boardColumns(board.id, statuses, columns, columnOrder);
  const temOrdemPropria = columnOrder.some((o) => o.project_id === board.id);

  // A coluna de Eventos é global: garantimos que ela exista em TODOS os quadros,
  // já que eventos cadastrados no Gestão de Demandas aparecem para todo mundo.
  const cols = [...rawCols];
  const hasEventos = cols.some((c) => c.chave === EVENT_STATUS_KEY || c.chave === "eventos");
  if (!hasEventos) {
    const statusEvento = statuses.find(
      (s) => s.chave === EVENT_STATUS_KEY || s.chave === "eventos",
    );
    cols.push({
      chave: statusEvento?.chave ?? EVENT_STATUS_KEY,
      label: statusEvento?.label ?? "Eventos",
      cor: statusEvento?.cor ?? "oklch(0.78 0.16 70)",
      posicao: 999,
      custom: false,
      id: statusEvento?.id ?? "fallback-eventos",
    });
  }

  // Filtra as tarefas pelo texto inserido (título, área, solicitante ou tags)
  const tarefasFiltradas = tasks.filter((t) => {
    if (!busca.trim()) return true;
    const termo = busca.toLowerCase();
    const tituloMatch = t.titulo?.toLowerCase().includes(termo);
    const areaMatch = t.area?.toLowerCase().includes(termo);
    const solicitanteMatch = t.solicitante?.toLowerCase().includes(termo);
    const tagMatch = (t.tags ?? []).some((tag) => tag.nome.toLowerCase().includes(termo));
    return tituloMatch || areaMatch || solicitanteMatch || tagMatch;
  });

  const doneKeys = statuses.filter((s) => s.is_done).map((s) => s.chave);

  const drop = (chave: string) => {
    setOver(null);
    setOverCard(null);
    const task = tasks.find((t) => t.id === drag);
    setDrag(null);
    if (!task || task.status === chave) return;
    const done = statuses.find((s) => s.chave === chave)?.is_done;
    updateTask.mutate({
      id: task.id,
      previous: task,
      patch: { status: chave, concluida_em: done ? new Date().toISOString() : null },
    });
  };

  /** Reordena um card DENTRO da mesma coluna: solta-o antes do card alvo e grava o
   * novo `ordem` de todas as tarefas da coluna (persistente e compartilhado entre
   * os membros). Só funciona com a ordenação "Ordem do quadro" ativa. */
  const dropOnCard = async (chave: string, targetId: string) => {
    setOver(null);
    setOverCard(null);
    const task = tasks.find((t) => t.id === drag);
    setDrag(null);
    if (!task || task.id === targetId) return;

    // Mudou de coluna? Delega ao fluxo normal de troca de status.
    if (task.status !== chave) {
      const done = statuses.find((s) => s.chave === chave)?.is_done;
      updateTask.mutate({
        id: task.id,
        previous: task,
        patch: { status: chave, concluida_em: done ? new Date().toISOString() : null },
      });
      return;
    }

    // Coluna de entrega não aceita reordenação manual (ordem fixa por entrega).
    if (doneKeys.includes(chave)) return;

    if (sort !== "padrao") {
      toast.info('Para reorganizar manualmente, use a ordenação "Ordem do quadro".');
      return;
    }

    const colTasks = sortTasks(
      tasks.filter((t) => t.status === chave),
      "padrao",
      profiles,
    ).filter((t) => t.id !== task.id);
    const alvoIdx = colTasks.findIndex((t) => t.id === targetId);
    if (alvoIdx === -1) return;
    const novaOrdem = [...colTasks.slice(0, alvoIdx), task, ...colTasks.slice(alvoIdx)];

    // Atualização otimista no cache do workspace.
    const key = ["thc-workspace"];
    const snapshot = qc.getQueryData<{ tasks: Task[] }>(key);
    if (snapshot) {
      const ordens = new Map(novaOrdem.map((t, i) => [t.id, i]));
      qc.setQueryData(key, {
        ...snapshot,
        tasks: snapshot.tasks.map((t) =>
          ordens.has(t.id) ? { ...t, ordem: ordens.get(t.id)! } : t,
        ),
      });
    }

    // Grava apenas as tarefas cuja posição mudou.
    const mudancas = novaOrdem.filter((t, i) => t.ordem !== i);
    try {
      for (const t of mudancas) {
        const { error } = await db
          .from("tasks")
          .update({ ordem: novaOrdem.indexOf(t) })
          .eq("id", t.id);
        if (error) throw error;
      }
    } catch {
      toast.error("Não foi possível salvar a nova ordem.");
    }
    void qc.invalidateQueries({ queryKey: key });
  };

  /** Soltar no fim da coluna (área vazia abaixo dos cards) com a ordenação manual. */
  const dropAtEnd = async (chave: string) => {
    const task = tasks.find((t) => t.id === drag);
    if (!task || task.status !== chave || sort !== "padrao" || doneKeys.includes(chave)) {
      return drop(chave);
    }
    setOver(null);
    setOverCard(null);
    setDrag(null);
    const colTasks = tasks.filter((t) => t.status === chave);
    const maxOrdem = Math.max(-1, ...colTasks.map((t) => t.ordem));
    if (task.ordem === maxOrdem) return;
    updateTask.mutate({ id: task.id, previous: task, patch: { ordem: maxOrdem + 1 } });
  };

  /** Solta o cabeçalho arrastado na posição do cabeçalho de destino: reordena TODAS as
   * colunas do quadro atual e salva a sequência como preferência PESSOAL do usuário
   * logado — outros membros continuam vendo a ordem deles. */
  const dropColumn = (targetChave: string) => {
    setColOver(null);
    const draggedChave = colDrag;
    setColDrag(null);
    if (!draggedChave || draggedChave === targetChave) return;

    const semArrastada = cols.filter((c) => c.chave !== draggedChave);
    const alvoIdx = semArrastada.findIndex((c) => c.chave === targetChave);
    if (alvoIdx === -1) return;
    const arrastada = cols.find((c) => c.chave === draggedChave);
    if (!arrastada) return;

    const novaOrdem = [
      ...semArrastada.slice(0, alvoIdx),
      arrastada,
      ...semArrastada.slice(alvoIdx),
    ];

    reorderColumns.mutate({
      board,
      ordem: novaOrdem
        // Ignora o fallback temporário que não existe no banco
        .filter((c) => c.id !== "fallback-eventos")
        .map((c) => ({ chave: c.chave, custom: c.custom })),
    });
  };

  /** Volta este quadro para a ordem padrão de colunas (apaga só a preferência do usuário). */
  const restaurarOrdem = async () => {
    try {
      await resetColumnOrder.mutateAsync({ board });
      toast.success("Ordem padrão restaurada.");
    } catch {
      toast.error("Não foi possível restaurar a ordem padrão.");
    }
  };

  // Trava contra duplo disparo: Enter e blur do textarea chamam addTask; sem a
  // trava, os dois eventos criavam a mesma tarefa duas vezes (título duplicado).
  const salvandoRef = useRef(false);
  const addTask = async (chave: string) => {
    const titulo = draft.trim();
    if (!titulo || salvandoRef.current) return;
    salvandoRef.current = true;
    // Limpa e fecha o campo ANTES de gravar, para o blur não disparar de novo.
    setDraft("");
    setAdding(null);
    try {
      await createTask.mutateAsync({
        titulo,
        status: chave,
        board_id: board.id,
        ...(board.kind === "mae" ? { is_master: true } : { projeto_id: board.id }),
        ...(board.kind === "individual" && board.owner_id ? { usuario_id: [board.owner_id] } : {}),
      });
    } finally {
      salvandoRef.current = false;
    }
  };

  /** Roteia automaticamente: coluna criada no Quadro Mãe vira status global (espelha
   * em todos os quadros); em qualquer outro quadro, fica local (só ali). */
  const addColumn = async () => {
    const label = columnName.trim();
    if (!label) return;
    try {
      await addColumnMutation.mutateAsync({
        board,
        label,
        posicao: (cols.at(-1)?.posicao ?? 0) + 10,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a coluna.");
      return;
    }
    setColumnName("");
    setNewColumn(false);
    void qc.invalidateQueries();
  };

  /** Exclui coluna: global (statuses) no Quadro Mãe, local (project_columns) nos demais. */
  const removeColumn = async (id: string, custom: boolean, label: string) => {
    if (!custom && !window.confirm(`Excluir o status global "${label}" de todos os quadros?`))
      return;
    try {
      await deleteColumn.mutateAsync({ id, custom });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir a coluna.");
      return;
    }
    void qc.invalidateQueries();
  };

  const changeColor = async (id: string, custom: boolean, cor: string) => {
    if (id === "fallback-eventos") return;
    try {
      await setColumnColor.mutateAsync({ id, custom, cor });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível alterar a cor.");
      return;
    }
    void qc.invalidateQueries();
  };

  const renameGlobal = async (id: string, atual: string) => {
    if (id === "fallback-eventos") return;
    const label = window.prompt("Novo nome do status global", atual);
    if (!label?.trim()) return;
    const { error } = await db.from("statuses").update({ label: label.trim() }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void qc.invalidateQueries();
  };

  return (
    <div className="flex h-full flex-col">
      <div
        onWheel={rodaHorizontal}
        className="kanban-scroll flex h-full min-h-0 snap-x snap-mandatory gap-4 overflow-x-auto px-3 pt-1 pb-4 md:snap-none md:px-6"
      >
        {cols.map((col) => {
          const doColuna = tarefasFiltradas.filter((t) => t.status === col.chave);
          // Coluna de entrega tem ordem fixa: a última entregue fica no topo.
          const items = doneKeys.includes(col.chave)
            ? ordemEntregue(doColuna)
            : sortTasks(doColuna, sort, profiles);
          const estaAdicionando = adding === col.chave;
          const isHovered = over === col.chave;

          return (
            <div
              key={col.chave}
              className="flex min-h-0 w-[85vw] max-w-[340px] shrink-0 snap-center flex-col gap-3 md:w-[330px] md:max-w-none md:snap-start"
              onDragOver={(e) => {
                e.preventDefault();
                setOver(col.chave);
              }}
              onDragLeave={() => setOver((o) => (o === col.chave ? null : o))}
              onDrop={() => void dropAtEnd(col.chave)}
            >
              {/* Bloco 1: Título da Coluna Separado — arrastável para reordenar */}
              <header
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  setColDrag(col.chave);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setColOver(col.chave);
                }}
                onDragLeave={() => setColOver((o) => (o === col.chave ? null : o))}
                onDrop={(e) => {
                  e.stopPropagation();
                  dropColumn(col.chave);
                }}
                className={cn(
                  "glass flex h-[52px] cursor-grab items-center justify-between gap-2 rounded-full pl-3 pr-3.5 transition-colors active:cursor-grabbing",
                  colOver === col.chave &&
                    colDrag !== col.chave &&
                    "border-primary/60 ring-1 ring-primary/50",
                  colDrag === col.chave && "opacity-40",
                )}
              >
                <span className="flex min-w-0 items-center gap-2 text-foreground">
                  <GripVertical className="size-4 shrink-0 text-muted-foreground/50" />
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: col.cor }}
                  />
                  <span className="max-w-[150px] truncate text-[15px] font-medium text-foreground">
                    {col.label}
                  </span>
                  {col.custom && (
                    <span title="Coluna pessoal" className="shrink-0">
                      <Star className="size-4 text-muted-foreground/60" />
                    </span>
                  )}
                  <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    {items.length}
                  </span>
                </span>

                <span className="flex shrink-0 items-center gap-1">
                  <Popover>
                    <PopoverTrigger
                      aria-label={`Cor da coluna ${col.label}`}
                      className="rounded-full p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                    >
                      <Palette className="size-[18px]" />
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-auto p-2">
                      <div className="grid grid-cols-5 gap-1.5">
                        {CORES_COLUNA.map((cor) => (
                          <button
                            key={cor}
                            onClick={() => void changeColor(col.id, col.custom, cor)}
                            aria-label={`Aplicar cor ${cor}`}
                            className={cn(
                              "size-5 rounded-full border border-border/60 transition-transform hover:scale-110",
                              col.cor === cor &&
                                "ring-2 ring-primary ring-offset-1 ring-offset-popover",
                            )}
                            style={{ background: cor }}
                          />
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  {(col.custom || (board.kind === "mae" && isGestor)) &&
                    col.id !== "fallback-eventos" && (
                      <button
                        onClick={() => void removeColumn(col.id, col.custom, col.label)}
                        aria-label={`Excluir coluna ${col.label}`}
                        className="rounded-full p-1 text-muted-foreground hover:bg-surface-2 hover:text-destructive"
                      >
                        <Trash2 className="size-[18px]" />
                      </button>
                    )}
                  {!col.custom && isGestor && col.id !== "fallback-eventos" && (
                    <Pencil
                      onClick={() => void renameGlobal(col.id, col.label)}
                      aria-label={`Renomear ${col.label}`}
                      className="size-[18px] cursor-pointer text-muted-foreground hover:text-foreground"
                    />
                  )}
                  <button
                    onClick={() => setAdding(col.chave)}
                    aria-label={`Nova tarefa em ${col.label}`}
                    className="rounded-full p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                  >
                    <Plus className="size-[18px]" />
                  </button>
                </span>
              </header>

              {/* Bloco 2: Container dos Cards e Botão de Adicionar */}
              <div
                className={cn(
                  "flex h-fit min-h-0 flex-col rounded-[28px] border border-[var(--glass-border)] bg-surface/50 p-2.5 transition-all fluid",
                  isHovered && "border-primary/50 bg-primary/5 ring-1 ring-primary/50",
                )}
              >
                {/* Lista de cards */}
                <div className="flex min-h-0 flex-col space-y-2.5 overflow-y-auto overscroll-contain pr-0.5">
                  {items.map((t) => (
                    <div
                      key={t.id}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setOverCard(t.id);
                      }}
                      onDragLeave={() => setOverCard((o) => (o === t.id ? null : o))}
                      onDrop={(e) => {
                        e.stopPropagation();
                        void dropOnCard(col.chave, t.id);
                      }}
                      className={cn(
                        "rounded-[22px] transition-all",
                        overCard === t.id &&
                          drag &&
                          drag !== t.id &&
                          "ring-1 ring-primary/50 -translate-y-0.5",
                      )}
                    >
                      <TaskCard
                        task={t}
                        profiles={profiles}
                        statuses={statuses}
                        dragging={drag === t.id}
                        onDragStart={() => setDrag(t.id)}
                        onOpen={() => onOpen(t)}
                      />
                    </div>
                  ))}

                  {estaAdicionando && (
                    <textarea
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={() => void addTask(col.chave)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void addTask(col.chave);
                        }
                        if (e.key === "Escape") setAdding(null);
                      }}
                      placeholder="Título da tarefa…"
                      className="w-full resize-none rounded-[20px] border border-primary/50 bg-tile p-3.5 text-[13px] outline-none shadow-sm"
                      rows={2}
                    />
                  )}
                </div>

                {/* Botão de adicionar no rodapé do container dos cards */}
                {!estaAdicionando && (
                  <button
                    onClick={() => setAdding(col.chave)}
                    className="mt-2.5 flex h-11 w-full items-center justify-center gap-1.5 rounded-[18px] border-[1.5px] border-dashed border-border text-[12.5px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                  >
                    <Plus className="size-3.5" /> Adicionar uma tarefa
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Opção para Nova Coluna — local (fora do Quadro Mãe) */}
        {board.kind !== "mae" && (
          <div className="w-[70vw] max-w-[220px] shrink-0 snap-start md:w-[220px]">
            {newColumn ? (
              <input
                autoFocus
                value={columnName}
                onChange={(e) => setColumnName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void addColumn()}
                onBlur={() => void addColumn()}
                placeholder="Nome da coluna"
                className="w-full rounded-full border border-primary/50 bg-tile px-4 py-3 text-[12.5px] outline-none shadow-sm"
              />
            ) : (
              <button
                onClick={() => setNewColumn(true)}
                className="flex h-[52px] w-full items-center gap-2 rounded-full border-[1.5px] border-dashed border-border px-4 text-[12.5px] text-muted-foreground fluid hover:border-primary/50 hover:text-foreground"
              >
                <Plus className="size-3.5" /> Coluna personalizada
              </button>
            )}
          </div>
        )}

        {/* Opção para Novo Status — global, só no Quadro Mãe (espelha em todos os quadros) */}
        {board.kind === "mae" && (
          <div className="w-[70vw] max-w-[220px] shrink-0 snap-start md:w-[220px]">
            {newColumn ? (
              <input
                autoFocus
                value={columnName}
                onChange={(e) => setColumnName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void addColumn()}
                onBlur={() => void addColumn()}
                placeholder="Nome do status (espelha em todos os quadros)"
                className="w-full rounded-full border border-primary/50 bg-tile px-4 py-3 text-[12.5px] outline-none shadow-sm"
              />
            ) : (
              <button
                onClick={() => setNewColumn(true)}
                className="flex h-[52px] w-full items-center gap-2 rounded-full border-[1.5px] border-dashed border-border px-4 text-[12.5px] text-muted-foreground fluid hover:border-primary/50 hover:text-foreground"
              >
                <Plus className="size-3.5" /> Novo status (todos os quadros)
              </button>
            )}
          </div>
        )}

        {/* Só aparece se ESTE usuário já personalizou a ordem deste quadro */}
        {temOrdemPropria && (
          <div className="w-[70vw] max-w-[220px] shrink-0 snap-start md:w-[220px]">
            <button
              onClick={() => void restaurarOrdem()}
              className="flex h-[52px] w-full items-center gap-2 rounded-full border-[1.5px] border-dashed border-border px-4 text-[12.5px] text-muted-foreground fluid hover:border-primary/50 hover:text-foreground"
            >
              <RotateCcw className="size-3.5" /> Restaurar ordem padrão
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
