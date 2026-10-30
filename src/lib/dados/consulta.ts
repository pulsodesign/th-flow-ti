/**
 * Montador de consultas usado pelo app inteiro, no navegador e no servidor.
 *
 * Ele só descreve a consulta (tabela, colunas, filtros, ordem). Quem executa é
 * um "executor": no navegador, a rota /api/dados; no servidor, o PostgreSQL
 * direto. O SQL é sempre gerado no servidor, com parâmetros, a partir de nomes
 * de tabela e coluna validados contra o próprio banco.
 */

export type Operador = "eq" | "neq" | "in" | "is" | "lt" | "lte" | "gt" | "gte";

export type Filtro = { coluna: string; op: Operador; negar?: boolean | undefined; valor: unknown };

export type Ordem = { coluna: string; asc: boolean; nullsFirst?: boolean | undefined };

export type Consulta = {
  tabela: string;
  acao: "select" | "insert" | "update" | "upsert" | "delete";
  /** Colunas devolvidas ("*" ou lista separada por vírgula). Vazio = não devolve nada. */
  colunas?: string | undefined;
  valores?: Record<string, unknown> | Record<string, unknown>[] | undefined;
  conflito?: string | undefined;
  ignorarDuplicados?: boolean | undefined;
  filtros: Filtro[];
  ordem: Ordem[];
  limite?: number | undefined;
  unico?: "single" | "maybeSingle" | undefined;
};

export type ChamadaRpc = { funcao: string; argumentos: Record<string, unknown> };

export type ErroDados = {
  message: string;
  code?: string | undefined;
  details?: string | null | undefined;
  hint?: string | null | undefined;
};

import type { NomeTabela, Tabelas } from "./tipos";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Resultado<T = any> = {
  data: T;
  error: ErroDados | null;
  count: null;
  status: number;
  statusText: string;
};

export type Executor = {
  consulta: (c: Consulta) => Promise<{ data: unknown; error: ErroDados | null }>;
  rpc: (r: ChamadaRpc) => Promise<{ data: unknown; error: ErroDados | null }>;
};

function resultado<T>(data: T, error: ErroDados | null): Resultado<T> {
  return {
    data,
    error,
    count: null,
    status: error ? 400 : 200,
    statusText: error ? "Bad Request" : "OK",
  };
}

/** Aplica single()/maybeSingle() sobre a lista devolvida pelo servidor. */
function ajustarUnico(c: Consulta, data: unknown, error: ErroDados | null): Resultado {
  if (error || !c.unico) return resultado(data, error);
  const linhas = Array.isArray(data) ? data : [];
  if (linhas.length === 1) return resultado(linhas[0], null);
  if (linhas.length === 0 && c.unico === "maybeSingle") return resultado(null, null);
  return resultado(null, {
    code: "resultado_nao_unico",
    message: "Era esperada exatamente uma linha.",
    details: `A consulta devolveu ${linhas.length} linhas.`,
  });
}

export class ConsultaBuilder<R, T = R[]> implements PromiseLike<Resultado<T>> {
  private c: Consulta;

  constructor(
    private executor: Executor,
    tabela: string,
  ) {
    this.c = { tabela, acao: "select", filtros: [], ordem: [] };
  }

  select(colunas = "*") {
    if (this.c.acao === "select") this.c.colunas = colunas;
    else this.c.colunas = colunas; // depois de insert/update/upsert/delete: devolve as linhas
    return this as unknown as ConsultaBuilder<R>;
  }

  insert(valores: Record<string, unknown> | Record<string, unknown>[]) {
    this.c.acao = "insert";
    this.c.valores = valores;
    this.c.colunas = undefined;
    return this;
  }

  upsert(
    valores: Record<string, unknown> | Record<string, unknown>[],
    opcoes?: { onConflict?: string; ignoreDuplicates?: boolean },
  ) {
    this.c.acao = "upsert";
    this.c.valores = valores;
    this.c.conflito = opcoes?.onConflict;
    this.c.ignorarDuplicados = opcoes?.ignoreDuplicates;
    this.c.colunas = undefined;
    return this;
  }

  update(valores: Record<string, unknown>) {
    this.c.acao = "update";
    this.c.valores = valores;
    this.c.colunas = undefined;
    return this;
  }

  delete() {
    this.c.acao = "delete";
    this.c.colunas = undefined;
    return this;
  }

  private filtro(coluna: string, op: Operador, valor: unknown, negar = false) {
    this.c.filtros.push({ coluna, op, valor, negar });
    return this;
  }

  eq(coluna: string, valor: unknown) {
    return this.filtro(coluna, "eq", valor);
  }
  neq(coluna: string, valor: unknown) {
    return this.filtro(coluna, "neq", valor);
  }
  in(coluna: string, valores: readonly unknown[]) {
    return this.filtro(coluna, "in", [...valores]);
  }
  is(coluna: string, valor: null | boolean) {
    return this.filtro(coluna, "is", valor);
  }
  lt(coluna: string, valor: unknown) {
    return this.filtro(coluna, "lt", valor);
  }
  lte(coluna: string, valor: unknown) {
    return this.filtro(coluna, "lte", valor);
  }
  gt(coluna: string, valor: unknown) {
    return this.filtro(coluna, "gt", valor);
  }
  gte(coluna: string, valor: unknown) {
    return this.filtro(coluna, "gte", valor);
  }
  not(coluna: string, op: Operador, valor: unknown) {
    return this.filtro(coluna, op, valor, true);
  }

  order(coluna: string, opcoes?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.c.ordem.push({ coluna, asc: opcoes?.ascending ?? true, nullsFirst: opcoes?.nullsFirst });
    return this;
  }

  limit(n: number) {
    this.c.limite = n;
    return this;
  }

  single() {
    this.c.unico = "single";
    return this as unknown as ConsultaBuilder<R, R>;
  }

  maybeSingle() {
    this.c.unico = "maybeSingle";
    return this as unknown as ConsultaBuilder<R, R | null>;
  }

  async executar(): Promise<Resultado<T>> {
    try {
      const { data, error } = await this.executor.consulta(this.c);
      return ajustarUnico(this.c, data, error) as Resultado<T>;
    } catch (e) {
      return resultado(null as T, { message: e instanceof Error ? e.message : String(e) });
    }
  }

  then<R1 = Resultado<T>, R2 = never>(
    onfulfilled?: ((value: Resultado<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.executar().then(onfulfilled, onrejected);
  }
}

/** Cliente de dados: `db.from("tasks").select("*")`, `db.rpc("is_gestor")`. */
export function criarClienteDados(executor: Executor) {
  return {
    from: <K extends NomeTabela>(tabela: K) => new ConsultaBuilder<Tabelas[K]>(executor, tabela),
    rpc: async (funcao: string, argumentos: Record<string, unknown> = {}): Promise<Resultado> => {
      try {
        const { data, error } = await executor.rpc({ funcao, argumentos });
        return resultado(data, error);
      } catch (e) {
        return resultado(null, { message: e instanceof Error ? e.message : String(e) });
      }
    },
  };
}

export type ClienteDados = ReturnType<typeof criarClienteDados>;
