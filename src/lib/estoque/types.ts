export const TAMANHOS = ["P", "M", "G", "GG", "EG", "EGG"] as const;
export type Tamanho = (typeof TAMANHOS)[number];

/** Estoques físicos fixos disponíveis para seleção. */
export const ESTOQUES_FIXOS = ["TH interno", "Motivia"] as const;

/** Item é considerado "estoque baixo" apenas quando zerado. */
export const ESTOQUE_BAIXO = 0;

export type EstoqueItem = {
  id: string;
  nome: string;
  foto_url: string | null;
  cor: string | null;
  locais: string[];
  tem_variacao_tamanho: boolean;
  quantidade: number | null;
  created_by: string | null;
  created_at: string;
  deletado_em: string | null;
};

export type EstoqueVariacao = {
  id: string;
  item_id: string;
  tamanho: Tamanho;
  quantidade: number;
};

export type EstoqueMovimentacao = {
  id: string;
  item_id: string;
  variacao_id: string | null;
  tipo: "entrada" | "saida";
  quantidade: number;
  observacao: string | null;
  user_id: string | null;
  created_at: string;
};

export type EstoqueComentario = {
  id: string;
  item_id: string;
  user_id: string | null;
  body: string;
  mentions: string[];
  created_at: string;
};

/** Soma total de um item (variações ou quantidade única). */
export function totalDoItem(item: EstoqueItem, variacoes: EstoqueVariacao[]) {
  if (!item.tem_variacao_tamanho) return item.quantidade ?? 0;
  return variacoes
    .filter((v) => v.item_id === item.id)
    .reduce((acc, v) => acc + (v.quantidade ?? 0), 0);
}

export type Periodo = "semana" | "mes" | "ano" | "data";

/** Início do intervalo do filtro de período. */
export function inicioPeriodo(periodo: Periodo, data?: string): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (periodo === "semana") d.setDate(d.getDate() - 6);
  else if (periodo === "mes") d.setDate(1);
  else if (periodo === "ano") {
    d.setMonth(0);
    d.setDate(1);
  } else if (data) return new Date(`${data}T00:00:00`);
  return d;
}

export function fimPeriodo(periodo: Periodo, data?: string): Date {
  if (periodo === "data" && data) return new Date(`${data}T23:59:59`);
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}
