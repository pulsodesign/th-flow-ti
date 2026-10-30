import pg from "pg";

/**
 * Conexão com o PostgreSQL (somente no servidor).
 *
 * - `comoServidor`: rotinas internas (convites, lembretes, envios). Roda com o
 *   usuário dono das tabelas.
 * - `comoUsuario`: tudo que é feito em nome de uma pessoa logada. Roda com o
 *   papel `thflow_usuario`, sujeito às regras de Row Level Security do banco.
 */

// Datas e horários chegam como texto, igual ao formato salvo no banco.
for (const oid of [1082, 1114, 1184]) pg.types.setTypeParser(oid, (v: string) => v);

let pool: pg.Pool | undefined;

export function urlDoBanco() {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("Variável DATABASE_URL não configurada (veja .env.example).");
  return url;
}

export function obterPool() {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: urlDoBanco(),
      max: Number(process.env["DATABASE_POOL_MAX"] ?? 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    pool.on("error", (err) => console.error("[banco] erro em conexão ociosa:", err.message));
  }
  return pool;
}

async function emTransacao<T>(
  preparar: string[],
  params: unknown[][],
  fn: (c: pg.PoolClient) => Promise<T>,
) {
  const cliente = await obterPool().connect();
  try {
    await cliente.query("BEGIN");
    for (let i = 0; i < preparar.length; i++) await cliente.query(preparar[i]!, params[i]);
    const r = await fn(cliente);
    await cliente.query("COMMIT");
    return r;
  } catch (e) {
    await cliente.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    cliente.release();
  }
}

export function comoServidor<T>(fn: (c: pg.PoolClient) => Promise<T>) {
  return emTransacao(["SET LOCAL TIME ZONE 'UTC'"], [[]], fn);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function comoUsuario<T>(usuarioId: string, fn: (c: pg.PoolClient) => Promise<T>) {
  if (!UUID.test(usuarioId)) throw new Error("Sessão inválida.");
  return emTransacao(
    [
      "SET LOCAL TIME ZONE 'UTC'",
      "SELECT set_config('app.user_id', $1, true)",
      "SET LOCAL ROLE thflow_usuario",
      // Uma consulta em nome do usuário nunca deve travar o banco.
      "SET LOCAL statement_timeout = '15s'",
    ],
    [[], [usuarioId], [], []],
    fn,
  );
}
