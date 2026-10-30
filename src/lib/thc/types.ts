export type Role = "gestor" | "membro";
export type Priority = "baixa" | "media" | "alta" | "urgente";
export const PRIORITIES: { id: Priority; label: string; color: string }[] = [
  { id: "baixa", label: "Baixa", color: "#9a9cb0" },
  { id: "media", label: "Média", color: "#7abba2" },
  { id: "alta", label: "Alta", color: "#eab343" },
  { id: "urgente", label: "Urgente", color: "#d0574a" },
];
export type Profile = {
  id: string;
  nome: string;
  email?: string;
  cargo: string;
  foto_perfil: string | null;
  cor: string;
};
export const EVENT_STATUS_KEY = "evento";
export type Status = {
  id: string;
  chave: string;
  label: string;
  cor: string;
  posicao: number;
  is_done: boolean;
};
export type ProjectKind = "mae" | "departamento" | "individual";
export type Project = {
  id: string;
  nome: string;
  kind: ProjectKind;
  descricao: string;
  icon: string;
  owner_id: string | null;
  posicao: number;
  responsaveis_padrao?: string[];
};
export type ProjectColumn = {
  id: string;
  project_id: string;
  chave: string;
  label: string;
  cor: string;
  posicao: number;
};
/** Sobrescreve, apenas para um quadro específico, a posição de uma coluna global
 * (statuses). Não existe registro aqui = o quadro usa a posição global normal. */
export type BoardStatusOrder = {
  project_id: string;
  status_chave: string;
  posicao: number;
};
/** Preferência PESSOAL de ordem das colunas de um quadro. Cada usuário tem a sua;
 * sem registros aqui, o quadro usa a ordem padrão (statuses/project_columns). */
export type UserColumnOrder = {
  user_id: string;
  project_id: string;
  column_chave: string;
  posicao: number;
};
export type Subtask = { id: string; title: string; done: boolean };
export type TaskTag = { nome: string; cor: string };
export type Anexo = {
  nome: string;
  url: string;
  path: string;
  tipo: string;
  tamanho: number;
};
export const MAX_TAGS = 5;
export type Task = {
  id: string;
  projeto_id: string | null;
  board_id: string | null;
  usuario_id: string[];
  titulo: string;
  descricao: string;
  status: string;
  prioridade: Priority;
  data_inicio: string | null;
  evento_inicio?: string | null;
  data_vencimento: string | null;
  tag: string | null;
  cor_da_tag: string | null;
  tags: TaskTag[];
  anexos: Anexo[];
  is_master: boolean;
  subtarefas: Subtask[];
  criador_id: string | null;
  concluida_em: string | null;
  deletada_em?: string | null;
  ordem: number;
  created_at?: string;
  versao: number | null;
  area: string | null;
  solicitante: string | null;
  is_completed: boolean;
  recorrencia?: Recorrencia;
  serie_id?: string | null;
  serie_indice?: number | null;
  serie_total?: number | null;
  serie_status_inicial?: string | null;
  /** Lembrete às 9h no dia da tarefa (entrega, ou início do evento). */
  lembrete?: boolean;
};
export type Recorrencia = "nenhuma" | "mensal" | "mensal_3" | "mensal_6";
/** `meses` = quantas ocorrências existem no total; "mensal" não tem fim (null). */
export const RECORRENCIAS: { id: Recorrencia; label: string; meses: number | null }[] = [
  { id: "nenhuma", label: "Não repetir", meses: 1 },
  { id: "mensal", label: "Todo mês, sem data para acabar", meses: null },
  { id: "mensal_3", label: "Todo mês, por 3 meses", meses: 3 },
  { id: "mensal_6", label: "Todo mês, por 6 meses", meses: 6 },
];
/** Soma `n` meses a uma data ISO mantendo o mesmo dia (ou o último dia, em meses mais curtos). */
export function addMesesISO(iso: string, n: number) {
  const [a, m, d] = iso.split("-").map(Number) as [number, number, number];
  const alvo = new Date(a, m - 1 + n, 1);
  const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  const dia = Math.min(d, ultimoDia);
  return `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}
export type RequestOptionTipo = "area" | "solicitante";
export type RequestOption = {
  id: string;
  tipo: RequestOptionTipo;
  nome: string;
  created_by: string | null;
};
export type ActivityLog = {
  id: string;
  task_id: string | null;
  user_id: string | null;
  kind: string;
  body: string;
  mentions: string[];
  anexos: Anexo[];
  created_at: string;
  edited_at?: string | null;
};
export type AppNotification = {
  id: string;
  user_id: string;
  task_id: string | null;
  tipo: string;
  titulo: string;
  body: string;
  lida: boolean;
  nivel?: "alta" | "media" | "baixa";
  created_at: string;
};
export const TAG_COLORS = [
  "oklch(0.625 0.169 133.5)",
  "oklch(0.7 0.15 160)",
  "oklch(0.78 0.15 78)",
  "oklch(0.66 0.13 330)",
  "oklch(0.68 0.14 40)",
  "oklch(0.7 0.1 300)",
  "oklch(0.741 0.076 168.1)",
  "oklch(0.62 0.2 22)",
];
export function initialsOf(nome: string) {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
export function isEventTask(status: string) {
  return status === EVENT_STATUS_KEY;
}
function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** Fim efetivo de um evento (data final ou, na falta dela, o início). */
export function fimEvento(t: Pick<Task, "data_vencimento" | "evento_inicio">) {
  return t.data_vencimento ?? t.evento_inicio ?? null;
}
/** Evento encerrado: já concluído ou cujo último dia já passou. */
export function isEventoEncerrado(t: Task) {
  if (!isEventTask(t.status)) return false;
  if (t.concluida_em) return true;
  const fim = fimEvento(t);
  return !!fim && fim < hojeISO();
}
/** A tarefa ocupa o dia `iso` no calendário? Eventos ocupam todo o período. */
export function taskOnDay(t: Task, iso: string) {
  if (isEventTask(t.status) && t.evento_inicio) {
    const fim = t.data_vencimento ?? t.evento_inicio;
    return iso >= t.evento_inicio && iso <= fim;
  }
  return t.data_vencimento === iso;
}
