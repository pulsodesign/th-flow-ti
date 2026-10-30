import { useMemo, useState } from "react";
import { ArrowUpDown, ChevronDown } from "@/components/ui/icon";
import { AvatarGroup, PriorityBadge, TagChip } from "@/components/thc/atoms";
import { boardColumns, useTaskMutations, useWorkspace } from "@/lib/thc/store";
import type { Project, Task } from "@/lib/thc/types";
import { matchBusca } from "@/lib/thc/filters";
import { formatDate, isOverdue } from "@/lib/thc/utils";
import { cn } from "@/lib/utils";

type SortKey = "titulo" | "status" | "prioridade" | "data_vencimento";

export function ListView({
  board,
  tasks,
  onOpen,
  busca = "",
}: {
  board: Project | null;
  tasks: Task[];
  onOpen: (t: Task) => void;
  busca?: string;
}) {
  const { statuses, columns, profiles } = useWorkspace();
  const { updateTask } = useTaskMutations();
  const [sort, setSort] = useState<SortKey>("data_vencimento");
  const [asc, setAsc] = useState(true);
  // Card expandido na visão mobile
  const [expandido, setExpandido] = useState<string | null>(null);

  const cols = board
    ? boardColumns(board.id, statuses, columns)
    : boardColumns("", statuses, columns);

  const sorted = useMemo(() => {
    const arr = tasks.filter((t) => matchBusca(t, busca));
    arr.sort((a, b) => {
      const av = String(a[sort] ?? "");
      const bv = String(b[sort] ?? "");
      return asc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return arr;
  }, [tasks, sort, asc, busca]);

  const toggleSort = (k: SortKey) => {
    if (k === sort) setAsc((v) => !v);
    else {
      setSort(k);
      setAsc(true);
    }
  };

  const Th = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th className="px-3 py-2 text-left font-medium">
      <button
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {children}
        <ArrowUpDown className="size-3 opacity-50" />
      </button>
    </th>
  );

  return (
    <div className="h-full overflow-auto px-3 py-4 md:px-6 md:py-5">
      {/* MOBILE: cada linha vira um card empilhado */}
      <div className="space-y-2 md:hidden">
        {sorted.map((t) => {
          const done = statuses.find((s) => s.chave === t.status)?.is_done ?? false;
          const aberto = expandido === t.id;
          return (
            <div key={t.id} className="panel p-3">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => {
                    const target = done
                      ? (statuses[0]?.chave ?? "backlog")
                      : (statuses.find((s) => s.is_done)?.chave ?? "entregue");
                    void updateTask.mutateAsync({
                      id: t.id,
                      previous: t,
                      patch: {
                        status: target,
                        concluida_em: done ? null : new Date().toISOString(),
                      },
                    });
                  }}
                  className="mt-1 size-4 shrink-0 accent-[var(--color-primary)] max-md:size-5"
                />
                <button onClick={() => onOpen(t)} className="min-w-0 flex-1 text-left">
                  <span
                    className={cn(
                      "block text-[13px] font-medium",
                      done && "line-through opacity-60",
                    )}
                  >
                    {t.titulo}
                  </span>
                </button>
                <button
                  onClick={() => setExpandido(aberto ? null : t.id)}
                  aria-label={aberto ? "Recolher" : "Expandir"}
                  className="shrink-0 rounded-md border border-border p-1 text-muted-foreground"
                >
                  <ChevronDown
                    className={cn("size-3.5 transition-transform", aberto && "rotate-180")}
                  />
                </button>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px]">
                <PriorityBadge priority={t.prioridade} />
                <span
                  className={cn(
                    isOverdue(t, statuses) ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {formatDate(t.data_vencimento)}
                </span>
                <AvatarGroup
                  users={t.usuario_id.map((id) => profiles.find((p) => p.id === id) ?? null)}
                  size={20}
                />
              </div>

              {aberto && (
                <div className="mt-3 space-y-2 border-t border-border/70 pt-2">
                  <label className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
                    Status
                    <select
                      value={t.status}
                      onChange={(e) =>
                        void updateTask.mutateAsync({
                          id: t.id,
                          previous: t,
                          patch: { status: e.target.value },
                        })
                      }
                      className="rounded-md border border-border bg-surface px-2 py-1 text-[11.5px] outline-none"
                    >
                      {cols.map((c) => (
                        <option key={c.chave} value={c.chave}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {t.versao != null && (
                    <p className="text-[11.5px] text-muted-foreground">Versão: V{t.versao}</p>
                  )}
                  {!!(t.tags ?? []).length && (
                    <div className="flex flex-wrap gap-1.5">
                      {(t.tags ?? []).map((tg, i) => (
                        <TagChip key={`${tg.nome}-${i}`} label={tg.nome} color={tg.cor} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!sorted.length && (
          <p className="px-1 py-8 text-center text-[12.5px] text-muted-foreground">
            Nenhuma tarefa por aqui.
          </p>
        )}
      </div>

      {/* DESKTOP: tabela */}
      <div className="panel hidden overflow-hidden md:block">
        <table className="w-full text-[12.5px]">
          <thead className="bg-surface/70 text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
            <tr>
              <th className="w-9 px-3 py-2" />
              <Th k="titulo">Tarefa</Th>
              <Th k="status">Status</Th>
              <Th k="prioridade">Prioridade</Th>
              <Th k="data_vencimento">Entrega</Th>
              <th className="px-3 py-2 text-left font-medium">Responsáveis</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => {
              const done = statuses.find((s) => s.chave === t.status)?.is_done ?? false;
              return (
                <tr key={t.id} className="border-t border-border/70 hover:bg-surface/40">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={() => {
                        const target = done
                          ? (statuses[0]?.chave ?? "backlog")
                          : (statuses.find((s) => s.is_done)?.chave ?? "entregue");
                        void updateTask.mutateAsync({
                          id: t.id,
                          previous: t,
                          patch: {
                            status: target,
                            concluida_em: done ? null : new Date().toISOString(),
                          },
                        });
                      }}
                      className="size-3.5 accent-[var(--color-primary)]"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => onOpen(t)} className="text-left hover:text-primary-ink">
                      <span className={cn(done && "line-through opacity-60")}>{t.titulo}</span>
                      {t.versao != null && (
                        <span
                          className={cn(
                            "ml-2 inline-block align-middle rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                            t.versao === 6
                              ? "bg-destructive/15 text-destructive"
                              : "bg-surface text-muted-foreground",
                          )}
                        >
                          V{t.versao}
                        </span>
                      )}
                      {(t.tags ?? []).map((tg, i) => (
                        <span key={`${tg.nome}-${i}`} className="ml-2 inline-block align-middle">
                          <TagChip label={tg.nome} color={tg.cor} />
                        </span>
                      ))}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={t.status}
                      onChange={(e) =>
                        void updateTask.mutateAsync({
                          id: t.id,
                          previous: t,
                          patch: { status: e.target.value },
                        })
                      }
                      className="rounded-md border border-border bg-surface px-2 py-1 text-[11.5px] outline-none"
                    >
                      {cols.map((c) => (
                        <option key={c.chave} value={c.chave}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <PriorityBadge priority={t.prioridade} />
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2",
                      isOverdue(t, statuses) ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {formatDate(t.data_vencimento)}
                  </td>
                  <td className="px-3 py-2">
                    <AvatarGroup
                      users={t.usuario_id.map((id) => profiles.find((p) => p.id === id) ?? null)}
                      size={22}
                    />
                  </td>
                </tr>
              );
            })}
            {!sorted.length && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  Nenhuma tarefa por aqui.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
