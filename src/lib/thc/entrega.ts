import { TODOS_TIPOS } from "./notificacoes";
import { enviarPush, gerarChavesVapid, type VapidKeys } from "./webpush";

/**
 * Entrega das notificações fora do app (push nos aparelhos e e-mail). Usado pelas
 * funções do servidor e pela rota dos lembretes; recebe o cliente admin já carregado.
 */
export type Admin = import("@/servidor/dados").DbAdmin;

export const AVISO_BANCO =
  "O banco ainda não tem a atualização das notificações. Rode o SQL da migração 20261014140000 no banco.";

/** Chaves VAPID do app: criadas uma vez e guardadas no banco (só o servidor lê). */
export async function chavesVapid(admin: Admin): Promise<VapidKeys> {
  const ler = async () => {
    const { data, error } = await admin
      .from("app_config")
      .select("valor")
      .eq("chave", "vapid")
      .maybeSingle();
    // Sem a tabela não dá para guardar a chave: cada pedido geraria uma diferente.
    if (error) throw new Error(AVISO_BANCO);
    return (data?.valor ?? null) as VapidKeys | null;
  };
  const existente = await ler();
  if (existente) return existente;
  const novas = await gerarChavesVapid();
  // Se dois pedidos chegarem juntos, vale a primeira chave gravada.
  await admin
    .from("app_config")
    .upsert(
      { chave: "vapid", valor: novas as never },
      { onConflict: "chave", ignoreDuplicates: true },
    );
  return (await ler()) ?? novas;
}

/** Link que abre a tarefa no quadro certo. */
export async function linkDaTarefa(admin: Admin, origem: string, taskId: string | null) {
  if (!taskId) return `${origem}/notificacoes`;
  const { data: t } = await admin
    .from("tasks")
    .select("board_id, projeto_id")
    .eq("id", taskId)
    .maybeSingle();
  let quadro = t?.board_id ?? t?.projeto_id ?? null;
  if (!quadro) {
    const { data: mae } = await admin
      .from("projects")
      .select("id")
      .eq("kind", "mae")
      .limit(1)
      .maybeSingle();
    quadro = mae?.id ?? null;
  }
  return quadro ? `${origem}/quadro/${quadro}?task=${taskId}` : `${origem}/notificacoes`;
}

function escHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** E-mail via Resend. Fica desligado até RESEND_API_KEY e EMAIL_REMETENTE existirem. */
export async function enviarEmails(
  admin: Admin,
  destinos: string[],
  tipo: string,
  titulo: string,
  body: string,
  link: string,
) {
  const chave = process.env["RESEND_API_KEY"];
  const remetente = process.env["EMAIL_REMETENTE"];
  if (!chave || !remetente || !destinos.length) return;

  const [{ data: prefs }, { data: emails }] = await Promise.all([
    admin
      .from("notification_prefs")
      .select("user_id, email_ativo, email_tipos")
      .in("user_id", destinos),
    admin.from("user_emails").select("user_id, email").in("user_id", destinos),
  ]);
  const prefPor = new Map((prefs ?? []).map((p) => [p.user_id, p]));
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#23254d">
  <p style="font-size:18px;font-weight:bold;margin:0 0 8px">${escHtml(titulo)}</p>
  <p style="margin:0 0 20px">${escHtml(body)}</p>
  <a href="${escHtml(link)}" style="display:inline-block;background:#eab343;color:#23254d;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:bold">Abrir no TH Flow</a>
  <p style="margin:24px 0 0;font-size:12px;color:#777">Você pode escolher quais avisos recebe por e-mail em Meu Perfil, no TH Flow.</p>
</div>`;

  await Promise.allSettled(
    (emails ?? [])
      .filter((e) => {
        // Sem preferência salva = recebe todos os tipos.
        const p = prefPor.get(e.user_id);
        return !p || (p.email_ativo && (p.email_tipos ?? TODOS_TIPOS).includes(tipo));
      })
      .map((e) =>
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: remetente, to: [e.email], subject: body, html }),
        }),
      ),
  );
}

/** Push para todos os aparelhos inscritos dos destinatários. */
export async function enviarPushes(
  admin: Admin,
  destinos: string[],
  dados: { titulo: string; body: string; url: string; tag: string; nivel: string },
  origem: string,
) {
  if (!destinos.length) return [];
  const { data: inscricoes, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", destinos);
  if (error) throw new Error(AVISO_BANCO);
  if (!inscricoes?.length) return [];
  const chaves = await chavesVapid(admin);
  const resultados = await Promise.allSettled(
    inscricoes.map((s) =>
      enviarPush(s, dados, chaves, {
        contato: origem,
        urgencia: dados.nivel === "alta" ? "high" : "normal",
      }),
    ),
  );
  // Aparelhos que saíram (permissão retirada, app removido) são apagados.
  const expirados = inscricoes.filter((_, i) => {
    const r = resultados[i];
    return r?.status === "fulfilled" && (r.value === 404 || r.value === 410);
  });
  if (expirados.length) {
    await admin
      .from("push_subscriptions")
      .delete()
      .in(
        "id",
        expirados.map((s) => s.id),
      );
  }
  return resultados.map((r) => (r.status === "fulfilled" ? r.value : 0));
}
