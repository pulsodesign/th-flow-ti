import { useCallback, useEffect, useState } from "react";
import type { Profile, Status, Task } from "./types";

export type QuickFilter = "todas" | "abertas" | "concluidas";

export type TaskFilters = { quick: QuickFilter; onlyMine: boolean };

export const DEFAULT_FILTERS: TaskFilters = { quick: "todas", onlyMine: false };

export const QUICK_OPTIONS: { id: QuickFilter; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "abertas", label: "Tarefas por concluir" },
  { id: "concluidas", label: "Tarefas concluídas" },
];

export type SortKey = "padrao" | "conclusao" | "responsavel" | "criador" | "entrega" | "urgencia";

export const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: "padrao", label: "Ordem do quadro" },
  { id: "conclusao", label: "Data de conclusão" },
  { id: "responsavel", label: "Responsável" },
  { id: "criador", label: "Criador" },
  { id: "entrega", label: "Data de entrega" },
  { id: "urgencia", label: "Urgência" },
];

export function doneKeysOf(statuses: Status[]) {
  return statuses.filter((s) => s.is_done).map((s) => s.chave);
}

export function filterTasks(
  tasks: Task[],
  filters: TaskFilters,
  doneKeys: string[],
  userId: string | null,
) {
  return tasks.filter((t) => {
    const concluida = doneKeys.includes(t.status) || !!t.concluida_em;
    if (filters.quick === "abertas" && concluida) return false;
    if (filters.quick === "concluidas" && !concluida) return false;
    if (filters.onlyMine && (!userId || !t.usuario_id.includes(userId))) return false;
    return true;
  });
}

/** Dias que uma tarefa pode ficar na coluna de entrega (status is_done) antes de
 * ser arquivada. Arquivada = some do quadro e só aparece pela busca. */
export const DIAS_ATE_ARQUIVAR = 60;

export function isArquivada(t: Task, doneKeys: string[], agora = Date.now()) {
  if (!doneKeys.includes(t.status) || !t.concluida_em) return false;
  return agora - new Date(t.concluida_em).getTime() > DIAS_ATE_ARQUIVAR * 864e5;
}

/** Esconde as tarefas arquivadas, exceto quando há texto na busca. */
export function ocultarArquivadas(tasks: Task[], doneKeys: string[], busca: string) {
  if (busca.trim()) return tasks;
  const agora = Date.now();
  return tasks.filter((t) => !isArquivada(t, doneKeys, agora));
}

const texto = (v: string | null | undefined) => (v ?? "").toLocaleLowerCase("pt-BR");
const dataAsc = (a: string | null | undefined, b: string | null | undefined) => {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
};

const PRIORITY_RANK: Record<string, number> = {
  urgente: 0,
  alta: 1,
  media: 2,
  baixa: 3,
};

export function sortTasks(tasks: Task[], sort: SortKey, profiles: Profile[]) {
  const nome = (id: string | null | undefined) =>
    texto(profiles.find((p) => p.id === id)?.nome ?? "");
  const list = [...tasks];
  switch (sort) {
    case "conclusao":
      return list.sort((a, b) => dataAsc(b.concluida_em, a.concluida_em));
    case "responsavel":
      return list.sort((a, b) => nome(a.usuario_id[0]).localeCompare(nome(b.usuario_id[0])));
    case "criador":
      return list.sort((a, b) => nome(a.criador_id).localeCompare(nome(b.criador_id)));
    case "entrega":
      return list.sort((a, b) => dataAsc(a.data_vencimento, b.data_vencimento));
    case "urgencia":
      return list.sort(
        (a, b) => (PRIORITY_RANK[a.prioridade] ?? 99) - (PRIORITY_RANK[b.prioridade] ?? 99),
      );
    default:
      return list.sort((a, b) => a.ordem - b.ordem);
  }
}

/** Estado persistido em localStorage (preferências de visualização). */
export function useStoredState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setValue(JSON.parse(raw) as T);
    } catch {
      /* ignora preferências inválidas */
    }
  }, [key]);

  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* storage indisponível */
      }
    },
    [key],
  );

  return [value, update] as const;
}

/** Busca textual compartilhada (Kanban, Lista e Calendário). */
export function matchBusca(t: Task, busca: string) {
  const termo = busca.trim().toLowerCase();
  if (!termo) return true;
  return (
    !!t.titulo?.toLowerCase().includes(termo) ||
    !!t.area?.toLowerCase().includes(termo) ||
    !!t.solicitante?.toLowerCase().includes(termo) ||
    (t.tags ?? []).some((tag) => tag.nome.toLowerCase().includes(termo))
  );
}
