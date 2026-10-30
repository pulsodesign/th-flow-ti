import { criarClienteDados } from "@/lib/dados/consulta";
import { comoServidor, comoUsuario } from "./banco";
import { executarConsulta, executarRpc } from "./sql";

/** Acesso de servidor: sem as regras de RLS. Usar só em rotinas internas. */
export const dbAdmin = criarClienteDados({
  consulta: (c) => comoServidor((cli) => executarConsulta(cli, c)),
  rpc: (r) => comoServidor((cli) => executarRpc(cli, r)),
});

/** Acesso em nome de um usuário: todas as regras de RLS valem. */
export function dbDoUsuario(usuarioId: string) {
  return criarClienteDados({
    consulta: (c) => comoUsuario(usuarioId, (cli) => executarConsulta(cli, c)),
    rpc: (r) => comoUsuario(usuarioId, (cli) => executarRpc(cli, r)),
  });
}

export type DbAdmin = typeof dbAdmin;
