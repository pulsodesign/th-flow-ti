import type { Anexo } from "./types";

const MAX_BYTES = 10 * 1024 * 1024;

/** Envia o arquivo ao servidor do app, que o guarda no banco (tabela app.arquivos). */
export async function uploadAnexo(file: File, prefix = "geral"): Promise<Anexo> {
  if (file.size > MAX_BYTES) throw new Error("Arquivo maior que 10 MB.");
  const form = new FormData();
  form.append("arquivo", file);
  form.append("pasta", prefix);
  const r = await fetch("/api/enviar-arquivo", {
    method: "POST",
    credentials: "same-origin",
    headers: { "x-thflow-requisicao": "1" },
    body: form,
  });
  if (r.status === 401) throw new Error("Sessão expirada. Entre novamente para enviar arquivos.");
  const dados = (await r.json().catch(() => null)) as {
    path?: string;
    url?: string;
    error?: { message: string };
  } | null;
  if (!r.ok || !dados?.path || !dados.url)
    throw new Error(dados?.error?.message ?? "Falha ao enviar o arquivo.");

  return {
    nome: file.name,
    url: dados.url,
    path: dados.path,
    tipo: file.type || "application/octet-stream",
    tamanho: file.size,
  };
}

export async function removeAnexo(path: string) {
  await fetch(`/api/arquivos/${path.split("/").map(encodeURIComponent).join("/")}`, {
    method: "DELETE",
    credentials: "same-origin",
    headers: { "x-thflow-requisicao": "1" },
  });
}

export function isImagem(a: Anexo) {
  return a.tipo.startsWith("image/");
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
