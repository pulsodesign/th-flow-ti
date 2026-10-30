import { boardLabel } from "@/lib/thc/store";
import type { Profile, Project } from "@/lib/thc/types";

/** Converte um texto em slug de URL limpo (sem acentos, símbolos ou espaços). */
export function slugify(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Slug de um quadro (usa o rótulo exibido). Desambigua com parte do id em caso de duplicidade. */
export function boardSlug(board: Project, profiles: Profile[], todos: Project[] = []) {
  const base = slugify(boardLabel(board, profiles)) || board.id;
  const duplicado = todos.some(
    (b) => b.id !== board.id && (slugify(boardLabel(b, profiles)) || b.id) === base,
  );
  return duplicado ? `${base}-${board.id.slice(0, 6)}` : base;
}

/** Resolve o parâmetro da URL, aceitando slug ou UUID (compatibilidade com links antigos). */
export function findBoardByParam(
  projects: Project[],
  profiles: Profile[],
  param: string,
): Project | null {
  return (
    projects.find((b) => b.id === param) ??
    projects.find((b) => boardSlug(b, profiles, projects) === param) ??
    projects.find((b) => slugify(boardLabel(b, profiles)) === param) ??
    null
  );
}
