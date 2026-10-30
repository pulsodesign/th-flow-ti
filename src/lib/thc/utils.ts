import type { Status, Task } from "./types";

export const todayISO = () => new Date().toISOString().slice(0, 10);

export function formatDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "—";
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isDoneStatus(status: string, statuses: Status[]) {
  return statuses.find((s) => s.chave === status)?.is_done ?? false;
}

export function isOverdue(task: Task, statuses: Status[]) {
  return (
    !!task.data_vencimento &&
    !isDoneStatus(task.status, statuses) &&
    task.data_vencimento < todayISO()
  );
}

export function daysUntil(iso: string | null) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d).setHours(0, 0, 0, 0);
  const now = new Date().setHours(0, 0, 0, 0);
  return Math.round((target - now) / 86400000);
}

export function progress(task: Task) {
  const subs = task.subtarefas ?? [];
  if (!subs.length) return null;
  const done = subs.filter((s) => s.done).length;
  return { done, total: subs.length, pct: Math.round((done / subs.length) * 100) };
}

export function addDaysISO(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d!);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string) {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round(
    (new Date(by!, bm! - 1, bd!).getTime() - new Date(ay!, am! - 1, ad!).getTime()) / 86400000,
  );
}
