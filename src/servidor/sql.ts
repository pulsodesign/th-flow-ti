import type pg from "pg";
import type { ChamadaRpc, Consulta, ErroDados, Filtro } from "@/lib/dados/consulta";
import { comoServidor } from "./banco";

/**
 * Converte a descrição de consulta (src/lib/dados/consulta.ts) em SQL com
 * parâmetros. Nomes de tabela e coluna só são aceitos se existirem no schema
 * public; valores sempre vão como parâmetros ($1, $2...), nunca no texto do SQL.
 */

type Coluna = { tipo: string; array: boolean };
type Tabela = { colunas: Map<string, Coluna>; chave: string[] };

let catalogo: Promise<Map<string, Tabela>> | undefined;

function carregarCatalogo() {
  catalogo ??= comoServidor(async (c) => {
    const { rows: cols } = await c.query<{ tabela: string; coluna: string; tipo: string }>(
      `SELECT c.table_name AS tabela, c.column_name AS coluna, c.udt_name AS tipo
         FROM information_schema.columns c
         JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
        WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'`,
    );
    const { rows: pks } = await c.query<{ tabela: string; coluna: string }>(
      `SELECT tc.table_name AS tabela, kcu.column_name AS coluna
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
        WHERE tc.table_schema = 'public' AND tc.constraint_type = 'PRIMARY KEY'
        ORDER BY kcu.ordinal_position`,
    );
    const mapa = new Map<string, Tabela>();
    for (const r of cols) {
      const t = mapa.get(r.tabela) ?? { colunas: new Map(), chave: [] };
      t.colunas.set(r.coluna, { tipo: r.tipo.replace(/^_/, ""), array: r.tipo.startsWith("_") });
      mapa.set(r.tabela, t);
    }
    for (const r of pks) mapa.get(r.tabela)?.chave.push(r.coluna);
    return mapa;
  }).catch((e) => {
    catalogo = undefined;
    throw e;
  });
  return catalogo;
}

export class ErroConsulta extends Error {}

const id = (nome: string) => `"${nome}"`;

function tabelaValida(cat: Map<string, Tabela>, nome: string) {
  const t = cat.get(nome);
  if (!t) throw new ErroConsulta(`Tabela não permitida: ${nome}`);
  return t;
}

function colunaValida(t: Tabela, nome: string) {
  const c = t.colunas.get(nome);
  if (!c) throw new ErroConsulta(`Coluna desconhecida: ${nome}`);
  return c;
}

function listaColunas(t: Tabela, lista: string) {
  const texto = lista.trim();
  if (texto === "*" || texto === "") return "*";
  return texto
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((nome) => {
      colunaValida(t, nome);
      return id(nome);
    })
    .join(", ");
}

/** jsonb recebe o valor serializado; arrays do Postgres vão como lista JS. */
function valorParaColuna(col: Coluna, valor: unknown) {
  if (valor === undefined || valor === null) return null;
  if (col.tipo === "jsonb" || col.tipo === "json") return JSON.stringify(valor);
  return valor;
}

class Parametros {
  lista: unknown[] = [];
  add(v: unknown) {
    this.lista.push(v);
    return `$${this.lista.length}`;
  }
}

function montarWhere(t: Tabela, filtros: Filtro[], p: Parametros) {
  if (!filtros.length) return "";
  const partes = filtros.map((f) => {
    const col = colunaValida(t, f.coluna);
    const c = id(f.coluna);
    let expr: string;
    switch (f.op) {
      case "is":
        if (f.valor !== null && typeof f.valor !== "boolean")
          throw new ErroConsulta("Filtro 'is' inválido.");
        expr = `${c} IS ${f.valor === null ? "NULL" : f.valor ? "TRUE" : "FALSE"}`;
        break;
      case "in": {
        if (!Array.isArray(f.valor)) throw new ErroConsulta("Filtro 'in' precisa de uma lista.");
        if (f.valor.length === 0) {
          expr = "FALSE";
          break;
        }
        expr = `${c} = ANY(${p.add(f.valor)}::${col.array ? "text" : col.tipo}[])`;
        break;
      }
      default: {
        const ops = { eq: "=", neq: "<>", lt: "<", lte: "<=", gt: ">", gte: ">=" } as const;
        expr = `${c} ${ops[f.op]} ${p.add(valorParaColuna(col, f.valor))}`;
      }
    }
    return f.negar ? `NOT (${expr})` : expr;
  });
  return ` WHERE ${partes.join(" AND ")}`;
}

function montarValores(
  t: Tabela,
  valores: Record<string, unknown> | Record<string, unknown>[],
  p: Parametros,
) {
  const linhas = Array.isArray(valores) ? valores : [valores];
  if (!linhas.length) throw new ErroConsulta("Nada para gravar.");
  const nomes = [...new Set(linhas.flatMap((l) => Object.keys(l)))];
  for (const n of nomes) colunaValida(t, n);
  const tuplas = linhas.map(
    (l) =>
      `(${nomes
        .map((n) =>
          n in l && l[n] !== undefined
            ? p.add(valorParaColuna(t.colunas.get(n)!, l[n]))
            : "DEFAULT",
        )
        .join(", ")})`,
  );
  return { nomes, tuplas };
}

/** Gera o SQL completo; o resultado sempre volta como uma lista JSON. */
export function montarSql(cat: Map<string, Tabela>, c: Consulta) {
  const t = tabelaValida(cat, c.tabela);
  const p = new Parametros();
  const tabela = `public.${id(c.tabela)}`;
  const devolve = c.colunas !== undefined;
  const retorno = devolve ? ` RETURNING ${listaColunas(t, c.colunas!)}` : "";

  let sql: string;
  switch (c.acao) {
    case "select": {
      let s = `SELECT ${listaColunas(t, c.colunas ?? "*")} FROM ${tabela}${montarWhere(t, c.filtros, p)}`;
      if (c.ordem.length) {
        s += ` ORDER BY ${c.ordem
          .map((o) => {
            colunaValida(t, o.coluna);
            const nulls =
              o.nullsFirst === undefined ? "" : o.nullsFirst ? " NULLS FIRST" : " NULLS LAST";
            return `${id(o.coluna)} ${o.asc ? "ASC" : "DESC"}${nulls}`;
          })
          .join(", ")}`;
      }
      if (c.limite !== undefined) s += ` LIMIT ${p.add(Math.max(0, Math.floor(c.limite)))}`;
      return {
        sql: `SELECT coalesce(json_agg(x), '[]'::json) AS r FROM (${s}) x`,
        params: p.lista,
      };
    }
    case "insert":
    case "upsert": {
      const { nomes, tuplas } = montarValores(t, c.valores ?? {}, p);
      sql = `INSERT INTO ${tabela} (${nomes.map(id).join(", ")}) VALUES ${tuplas.join(", ")}`;
      if (c.acao === "upsert") {
        const alvo = c.conflito ? c.conflito.split(",").map((s) => s.trim()) : t.chave;
        alvo.forEach((n) => colunaValida(t, n));
        const atualizar = nomes.filter((n) => !alvo.includes(n));
        sql +=
          c.ignorarDuplicados || !atualizar.length
            ? ` ON CONFLICT (${alvo.map(id).join(", ")}) DO NOTHING`
            : ` ON CONFLICT (${alvo.map(id).join(", ")}) DO UPDATE SET ${atualizar
                .map((n) => `${id(n)} = EXCLUDED.${id(n)}`)
                .join(", ")}`;
      }
      break;
    }
    case "update": {
      const valores = c.valores as Record<string, unknown>;
      const nomes = Object.keys(valores ?? {}).filter((n) => valores[n] !== undefined);
      if (!nomes.length) throw new ErroConsulta("Nada para atualizar.");
      const sets = nomes.map(
        (n) => `${id(n)} = ${p.add(valorParaColuna(colunaValida(t, n), valores[n]))}`,
      );
      if (!c.filtros.length) throw new ErroConsulta("Atualização sem filtro não é permitida.");
      sql = `UPDATE ${tabela} SET ${sets.join(", ")}${montarWhere(t, c.filtros, p)}`;
      break;
    }
    case "delete": {
      if (!c.filtros.length) throw new ErroConsulta("Exclusão sem filtro não é permitida.");
      sql = `DELETE FROM ${tabela}${montarWhere(t, c.filtros, p)}`;
      break;
    }
    default:
      throw new ErroConsulta("Operação inválida.");
  }
  // Sem RETURNING: com RLS, devolver linhas exigiria também permissão de leitura.
  if (!devolve) return { sql, params: p.lista };
  return {
    sql: `WITH m AS (${sql}${retorno}) SELECT coalesce(json_agg(m), '[]'::json) AS r FROM m`,
    params: p.lista,
  };
}

function paraErro(e: unknown): ErroDados {
  if (e instanceof ErroConsulta) return { message: e.message, code: "THF01" };
  const pgErro = e as { message?: string; code?: string; detail?: string; hint?: string };
  return {
    message: pgErro?.message ?? "Erro ao acessar o banco.",
    code: pgErro?.code,
    details: pgErro?.detail ?? null,
    hint: pgErro?.hint ?? null,
  };
}

export async function executarConsulta(cliente: pg.PoolClient, c: Consulta) {
  try {
    const cat = await carregarCatalogo();
    const { sql, params } = montarSql(cat, c);
    const { rows } = await cliente.query<{ r?: unknown }>(sql, params);
    return { data: rows[0]?.r ?? null, error: null };
  } catch (e) {
    return { data: null, error: paraErro(e) };
  }
}

/** Funções do banco que podem ser chamadas diretamente pelo app. */
const RPC_PERMITIDAS: Record<string, string[]> = {
  is_gestor: [],
  estender_series_mensais: [],
  registrar_movimentacao_estoque: [
    "_item_id",
    "_variacao_id",
    "_tipo",
    "_quantidade",
    "_observacao",
  ],
};

export async function executarRpc(cliente: pg.PoolClient, r: ChamadaRpc) {
  try {
    const args = RPC_PERMITIDAS[r.funcao];
    if (!args) throw new ErroConsulta(`Função não permitida: ${r.funcao}`);
    const nomes = Object.keys(r.argumentos ?? {});
    for (const n of nomes)
      if (!args.includes(n)) throw new ErroConsulta(`Argumento inválido: ${n}`);
    const p = new Parametros();
    const lista = nomes.map((n) => `${id(n)} => ${p.add(r.argumentos[n] ?? null)}`).join(", ");
    const { rows } = await cliente.query<{ r: unknown }>(
      `SELECT to_json(public.${id(r.funcao)}(${lista})) AS r`,
      p.lista,
    );
    return { data: rows[0]?.r ?? null, error: null };
  } catch (e) {
    return { data: null, error: paraErro(e) };
  }
}
