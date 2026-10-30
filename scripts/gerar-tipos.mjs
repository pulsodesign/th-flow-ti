// Gera src/lib/dados/tipos.ts a partir das tabelas do banco (schema public).
// Uso: npm run db:tipos   (lê DATABASE_URL do ambiente ou do arquivo .env)
import { writeFileSync } from "node:fs";
import pg from "pg";
import { carregarEnv } from "./env.mjs";

carregarEnv();
const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });
await cliente.connect();

const { rows: enums } = await cliente.query(`
  SELECT t.typname::text AS nome, array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS valores
    FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid JOIN pg_namespace n ON n.oid = t.typnamespace
   WHERE n.nspname = 'public' GROUP BY t.typname ORDER BY 1`);
const { rows: colunas } = await cliente.query(`
  SELECT c.table_name AS tabela, c.column_name AS coluna, c.udt_name AS tipo, c.is_nullable = 'YES' AS nulo
    FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
   WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
   ORDER BY c.table_name, c.ordinal_position`);
await cliente.end();

const nomesEnum = new Set(enums.map((e) => e.nome));
const base = (tipo) => {
  if (nomesEnum.has(tipo)) return `Enums["${tipo}"]`;
  if (["int2", "int4", "int8", "float4", "float8", "numeric"].includes(tipo)) return "number";
  if (tipo === "bool") return "boolean";
  if (tipo === "json" || tipo === "jsonb") return "Json";
  return "string";
};
const ts = (tipo) => (tipo.startsWith("_") ? `${base(tipo.slice(1))}[]` : base(tipo));

const tabelas = new Map();
for (const c of colunas) {
  if (!tabelas.has(c.tabela)) tabelas.set(c.tabela, []);
  tabelas.get(c.tabela).push(`    ${c.coluna}: ${ts(c.tipo)}${c.nulo ? " | null" : ""};`);
}

const saida = `// Arquivo gerado por scripts/gerar-tipos.mjs a partir do banco. Não edite à mão.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Enums = {
${enums.map((e) => `  ${e.nome}: ${e.valores.map((v) => JSON.stringify(v)).join(" | ")};`).join("\n")}
};

export type Tabelas = {
${[...tabelas].map(([t, cols]) => `  ${t}: {\n${cols.join("\n")}\n  };`).join("\n")}
};

export type NomeTabela = keyof Tabelas;
`;
writeFileSync(new URL("../src/lib/dados/tipos.ts", import.meta.url), saida);
console.log(`tipos.ts gerado: ${tabelas.size} tabelas.`);
