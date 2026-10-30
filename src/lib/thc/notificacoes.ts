/** Tipos de notificação, nível de importância de cada um e textos padrão. */

export type NivelNotificacao = "alta" | "media" | "baixa";

export type TipoNotificacao =
  | "atribuicao"
  | "mencao"
  | "comentario"
  | "status"
  | "conclusao"
  | "entrega"
  | "data"
  | "atualizacao"
  | "curtida"
  | "lembrete";

export const NIVEIS: { id: NivelNotificacao; label: string; classe: string }[] = [
  { id: "alta", label: "Alta", classe: "bg-destructive" },
  { id: "media", label: "Média", classe: "bg-warning" },
  { id: "baixa", label: "Baixa", classe: "bg-muted-foreground/50" },
];

export const TIPOS_NOTIFICACAO: {
  id: TipoNotificacao;
  label: string;
  exemplo: string;
  nivel: NivelNotificacao;
}[] = [
  {
    id: "lembrete",
    label: "Lembrete do dia da tarefa (9h)",
    exemplo: "Lembrete: hoje é o dia da tarefa",
    nivel: "alta",
  },
  {
    id: "atribuicao",
    label: "Marcaram você em uma tarefa",
    exemplo: "Adja marcou você na tarefa",
    nivel: "alta",
  },
  {
    id: "mencao",
    label: "Mencionaram você em um comentário",
    exemplo: "Adja mencionou você nos comentários",
    nivel: "alta",
  },
  {
    id: "data",
    label: "Data da tarefa alterada",
    exemplo: "A data da tarefa foi atualizada por Adja",
    nivel: "alta",
  },
  {
    id: "comentario",
    label: "Comentário em tarefa sua",
    exemplo: "Adja adicionou um comentário na tarefa",
    nivel: "media",
  },
  {
    id: "status",
    label: "Mudança de status",
    exemplo: "Tarefa foi movida para Em andamento por Adja",
    nivel: "media",
  },
  {
    id: "conclusao",
    label: "Tarefa concluída",
    exemplo: "Tarefa foi concluída por Adja",
    nivel: "media",
  },
  {
    id: "entrega",
    label: "Tarefa entregue",
    exemplo: "Tarefa foi entregue por Adja",
    nivel: "media",
  },
  {
    id: "atualizacao",
    label: "Outras alterações na tarefa",
    exemplo: "Adja alterou a descrição",
    nivel: "baixa",
  },
  {
    id: "curtida",
    label: "Curtiram seu comentário",
    exemplo: "Adja curtiu seu comentário",
    nivel: "baixa",
  },
];

export const TODOS_TIPOS = TIPOS_NOTIFICACAO.map((t) => t.id);

export function nivelDoTipo(tipo: string): NivelNotificacao {
  return TIPOS_NOTIFICACAO.find((t) => t.id === tipo)?.nivel ?? "media";
}
