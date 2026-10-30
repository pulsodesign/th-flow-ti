// Aplica, em ordem, os arquivos de db/migracoes que ainda não rodaram no banco.
// Uso: npm run db:migrar   (lê DATABASE_URL do ambiente ou do arquivo .env)
//      npm run db:semente  (depois das migrações, carrega usuários e dados de teste;
//                           só para desenvolvimento)
import { readdirSync, readFileSync } from "node:fs";
import pg from "pg";
import { carregarEnv } from "./env.mjs";

carregarEnv();
if (!process.env.DATABASE_URL) {
  console.error("Defina DATABASE_URL (veja .env.example).");
  process.exit(1);
}
const pasta = new URL("../db/migracoes/", import.meta.url);
const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });
await cliente.connect();
await cliente.query(`CREATE SCHEMA IF NOT EXISTS controle;
  CREATE TABLE IF NOT EXISTS controle.migracoes (nome text PRIMARY KEY, aplicada_em timestamptz NOT NULL DEFAULT now())`);
const { rows } = await cliente.query("SELECT nome FROM controle.migracoes");
const feitas = new Set(rows.map((r) => r.nome));

for (const nome of readdirSync(pasta)
  .filter((f) => f.endsWith(".sql"))
  .sort()) {
  if (feitas.has(nome)) continue;
  process.stdout.write(`Aplicando ${nome}... `);
  try {
    await cliente.query("BEGIN");
    await cliente.query(readFileSync(new URL(nome, pasta), "utf8"));
    await cliente.query("INSERT INTO controle.migracoes (nome) VALUES ($1)", [nome]);
    await cliente.query("COMMIT");
    console.log("ok");
  } catch (e) {
    await cliente.query("ROLLBACK");
    console.log("ERRO");
    console.error(e.message);
    await cliente.end();
    process.exit(1);
  }
}
if (process.argv.includes("--semente")) {
  process.stdout.write("Carregando dados de teste... ");
  await cliente.query(
    readFileSync(new URL("../db/desenvolvimento/semente.sql", import.meta.url), "utf8"),
  );
  console.log("ok");
}
await cliente.end();
console.log("Banco atualizado.");
