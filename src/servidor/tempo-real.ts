import pg from "pg";
import { urlDoBanco } from "./banco";

/**
 * Atualização em tempo real das telas.
 *
 * Os gatilhos do banco (app.notificar_mudanca) avisam pelo canal LISTEN/NOTIFY
 * do PostgreSQL. Este módulo mantém uma conexão escutando esse canal e repassa
 * os avisos às telas abertas (rota /api/tempo-real, via Server-Sent Events).
 * As telas então recarregam os dados pela rota /api/dados, sob as regras de RLS.
 */

export type Mudanca = {
  tabela: string;
  evento: "INSERT" | "UPDATE" | "DELETE";
  user_id?: string;
  linha?: Record<string, unknown>;
};

type Assinante = { usuarioId: string; enviar: (m: Mudanca) => void };

const assinantes = new Set<Assinante>();
let conexao: pg.Client | null = null;
let conectando = false;
let tentativas = 0;

/** LISTEN não funciona pelo pooler do Neon/PgBouncer; usa a conexão direta. */
function urlDireta() {
  const explicita = process.env["DATABASE_URL_DIRETA"];
  if (explicita) return explicita;
  const url = new URL(urlDoBanco());
  url.hostname = url.hostname.replace("-pooler.", ".");
  return url.toString();
}

function distribuir(texto: string) {
  let m: Mudanca;
  try {
    m = JSON.parse(texto) as Mudanca;
  } catch {
    return;
  }
  for (const a of assinantes) {
    if (m.tabela === "notifications") {
      // A notificação (com a linha completa) só vai para o próprio destinatário.
      if (m.user_id === a.usuarioId) a.enviar(m);
    } else {
      a.enviar({ tabela: m.tabela, evento: m.evento });
    }
  }
}

async function conectar() {
  if (conexao || conectando || !assinantes.size) return;
  conectando = true;
  const cliente = new pg.Client({ connectionString: urlDireta() });
  try {
    await cliente.connect();
    cliente.on("notification", (n) => n.payload && distribuir(n.payload));
    cliente.on("error", () => reconectar(cliente));
    cliente.on("end", () => reconectar(cliente));
    await cliente.query("LISTEN thflow_mudancas");
    conexao = cliente;
    tentativas = 0;
  } catch (e) {
    console.error("[tempo-real] falha ao conectar:", e instanceof Error ? e.message : e);
    await cliente.end().catch(() => {});
    agendarReconexao();
  } finally {
    conectando = false;
  }
}

function reconectar(cliente: pg.Client) {
  if (conexao !== cliente) return;
  conexao = null;
  void cliente.end().catch(() => {});
  agendarReconexao();
}

function agendarReconexao() {
  const espera = Math.min(30_000, 1_000 * 2 ** tentativas++);
  setTimeout(() => void conectar(), espera);
}

export function assinar(usuarioId: string, enviar: (m: Mudanca) => void) {
  const a: Assinante = { usuarioId, enviar };
  assinantes.add(a);
  void conectar();
  return () => {
    assinantes.delete(a);
    if (!assinantes.size && conexao) {
      const c = conexao;
      conexao = null;
      void c.end().catch(() => {});
    }
  };
}
