import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirLogin } from "@/lib/dados/middleware";
import { nivelDoTipo } from "./notificacoes";
import { chavesVapid, enviarEmails, enviarPushes, linkDaTarefa } from "./entrega";

const notificarSchema = z.object({
  userIds: z.array(z.string().guid()).max(100),
  taskId: z.string().guid().nullable(),
  tipo: z.string().min(1).max(40),
  titulo: z.string().min(1).max(200),
  body: z.string().max(1000),
});

/**
 * Cria a notificação no app (respeitando as permissões do banco) e a entrega
 * por push nos aparelhos e por e-mail, conforme as preferências de cada pessoa.
 */
export const notificar = createServerFn({ method: "POST" })
  .middleware([exigirLogin])
  .inputValidator((input: unknown) => notificarSchema.parse(input))
  .handler(async ({ data, context }) => {
    const destinos = [...new Set(data.userIds.filter((u) => u && u !== context.userId))];
    if (!destinos.length) return { enviadas: 0 };
    const nivel = nivelDoTipo(data.tipo);

    // Sem .select(): a pessoa que notifica não pode ler as notificações dos outros.
    const linhas = destinos.map((u) => ({ id: crypto.randomUUID(), user_id: u }));
    const { error } = await context.db.from("notifications").insert(
      linhas.map(({ id, user_id }) => ({
        id,
        user_id,
        task_id: data.taskId,
        tipo: data.tipo,
        titulo: data.titulo,
        body: data.body,
        nivel,
      })),
    );
    if (error) throw new Error("Não foi possível criar a notificação.");

    const entregues = destinos;
    try {
      const { dbAdmin } = await import("@/servidor/dados");
      const origem = await (await import("@/servidor/http")).origemAtual();
      const link = await linkDaTarefa(dbAdmin, origem, data.taskId);
      await Promise.allSettled([
        enviarPushes(
          dbAdmin,
          entregues,
          {
            titulo: data.titulo,
            body: data.body,
            url: link,
            tag: linhas[0]?.id ?? data.tipo,
            nivel,
          },
          origem,
        ),
        enviarEmails(dbAdmin, entregues, data.tipo, data.titulo, data.body, link),
      ]);
    } catch (e) {
      // A notificação no app já foi criada; falha no push/e-mail não desfaz isso.
      console.error("[notificar] entrega externa falhou", e);
    }
    return { enviadas: entregues.length };
  });

/** Chave pública para o navegador se inscrever no push. */
export const chavePublicaPush = createServerFn({ method: "GET" })
  .middleware([exigirLogin])
  .handler(async () => {
    const { dbAdmin } = await import("@/servidor/dados");
    return { publicKey: (await chavesVapid(dbAdmin)).publicKey };
  });

/** Manda um aviso de teste para os aparelhos da própria pessoa. */
export const testarPush = createServerFn({ method: "POST" })
  .middleware([exigirLogin])
  .handler(async ({ context }) => {
    const { dbAdmin } = await import("@/servidor/dados");
    const origem = await (await import("@/servidor/http")).origemAtual();
    const status = await enviarPushes(
      dbAdmin,
      [context.userId],
      {
        titulo: "Notificações ativadas",
        body: "Este aparelho vai receber os avisos do TH Flow.",
        url: `${origem}/notificacoes`,
        tag: "teste",
        nivel: "media",
      },
      origem,
    );
    if (!status.length) {
      throw new Error("Nenhum aparelho inscrito. Desative e ative as notificações de novo.");
    }
    const entregues = status.filter((c) => c >= 200 && c < 300).length;
    if (!entregues) {
      throw new Error(`O serviço de push recusou o envio (código ${status.join(", ")}).`);
    }
    return { aparelhos: status.length, entregues };
  });
