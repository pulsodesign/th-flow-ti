import { comoServidor } from "./banco";
import { dbAdmin } from "./dados";
import { limparRegistrosAntigos } from "./autenticacao";

/**
 * Rotinas diárias, no horário de Brasília. Rodam no próprio servidor, sem
 * depender de extensões de agendamento no banco.
 *
 *   03:05  conclui eventos vencidos e limpa sessões/links antigos
 *   03:15  cria as próximas ocorrências das tarefas mensais
 *   09:00  cria os lembretes do dia no sino e envia push e e-mail
 *
 * Cada rotina roda uma vez por dia: a tabela app.rotinas_execucoes garante isso
 * mesmo com mais de uma instância do servidor ou depois de um reinício (se o
 * servidor estava parado no horário, a rotina roda assim que ele voltar).
 */

type Rotina = { nome: string; hora: number; minuto: number; executar: () => Promise<unknown> };

const ROTINAS: Rotina[] = [
  {
    nome: "concluir-eventos-vencidos",
    hora: 3,
    minuto: 5,
    executar: async () => {
      await limparRegistrosAntigos();
      return comoServidor(
        async (c) => (await c.query("SELECT public.concluir_eventos_vencidos() AS n")).rows[0],
      );
    },
  },
  {
    nome: "estender-series-mensais",
    hora: 3,
    minuto: 15,
    executar: () =>
      comoServidor(
        async (c) => (await c.query("SELECT public.estender_series_mensais() AS n")).rows[0],
      ),
  },
  { nome: "lembretes-9h", hora: 9, minuto: 0, executar: () => dispararLembretes() },
];

function agoraEmSaoPaulo() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? "00";
  return {
    dia: `${v("year")}-${v("month")}-${v("day")}`,
    minutos: Number(v("hour")) * 60 + Number(v("minute")),
  };
}

/** Cria os lembretes do dia e entrega por push e e-mail os que ainda estão pendentes. */
export async function dispararLembretes() {
  const { enviarEmails, enviarPushes, linkDaTarefa } = await import("@/lib/thc/entrega");
  const criados = await comoServidor(
    async (c) => (await c.query("SELECT public.criar_lembretes_do_dia() AS n")).rows[0]?.n,
  );

  // Marca como entregues antes de enviar: se rodar duas vezes, ninguém recebe o aviso repetido.
  const { data: pendentes, error } = await dbAdmin
    .from("notifications")
    .update({ entrega_pendente: false })
    .eq("entrega_pendente", true)
    .eq("tipo", "lembrete")
    .select("id, user_id, task_id, tipo, titulo, body, nivel");
  if (error) throw new Error(error.message);

  const origem = process.env["APP_URL"] ? new URL(process.env["APP_URL"]).origin : "";
  await Promise.allSettled(
    (pendentes ?? []).map(
      async (n: {
        id: string;
        user_id: string;
        task_id: string | null;
        tipo: string;
        titulo: string;
        body: string;
        nivel: string;
      }) => {
        const link = await linkDaTarefa(dbAdmin, origem, n.task_id);
        await Promise.allSettled([
          enviarPushes(
            dbAdmin,
            [n.user_id],
            { titulo: n.titulo, body: n.body, url: link, tag: n.id, nivel: n.nivel },
            origem,
          ),
          enviarEmails(dbAdmin, [n.user_id], n.tipo, n.titulo, n.body, link),
        ]);
      },
    ),
  );
  return { criados, entregues: pendentes?.length ?? 0 };
}

async function rodarSeDevido(r: Rotina, dia: string, minutos: number) {
  if (minutos < r.hora * 60 + r.minuto) return;
  const marcada = await comoServidor(async (c) => {
    const { rowCount } = await c.query(
      "INSERT INTO app.rotinas_execucoes (rotina, dia) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [r.nome, dia],
    );
    return rowCount === 1;
  });
  if (!marcada) return;
  try {
    const resultado = await r.executar();
    await comoServidor((c) =>
      c.query("UPDATE app.rotinas_execucoes SET resultado = $3 WHERE rotina = $1 AND dia = $2", [
        r.nome,
        dia,
        JSON.stringify(resultado ?? null),
      ]),
    );
    console.info(`[rotinas] ${r.nome} concluída`, resultado);
  } catch (e) {
    // Libera para tentar de novo no próximo minuto.
    await comoServidor((c) =>
      c.query("DELETE FROM app.rotinas_execucoes WHERE rotina = $1 AND dia = $2", [r.nome, dia]),
    );
    console.error(`[rotinas] ${r.nome} falhou:`, e instanceof Error ? e.message : e);
  }
}

let rodando = false;

export async function verificarRotinas() {
  if (rodando) return;
  rodando = true;
  try {
    const { dia, minutos } = agoraEmSaoPaulo();
    for (const r of ROTINAS) await rodarSeDevido(r, dia, minutos);
  } catch (e) {
    console.error("[rotinas] erro ao verificar:", e instanceof Error ? e.message : e);
  } finally {
    rodando = false;
  }
}

let iniciado = false;

/** Liga o agendador interno (uma checagem por minuto). Desligue com ROTINAS_INTERNAS=false. */
export function iniciarAgendador() {
  if (iniciado || process.env["ROTINAS_INTERNAS"] === "false" || !process.env["DATABASE_URL"])
    return;
  iniciado = true;
  setTimeout(() => void verificarRotinas(), 10_000);
  setInterval(() => void verificarRotinas(), 60_000).unref?.();
}
