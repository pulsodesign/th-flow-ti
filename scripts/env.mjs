import { existsSync, readFileSync } from "node:fs";

/** Lê o arquivo .env (se existir) sem sobrescrever variáveis já definidas. */
export function carregarEnv(caminho = ".env") {
  if (!existsSync(caminho)) return;
  for (const linha of readFileSync(caminho, "utf8").split("\n")) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
