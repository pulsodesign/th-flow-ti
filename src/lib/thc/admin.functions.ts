import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirLogin } from "@/lib/dados/middleware";

/**
 * Link do e-mail de convite: sempre a tela de criar senha do próprio app, montado no servidor
 * a partir do endereço em que o app está rodando (o navegador não escolhe o destino).
 */
async function origemDoApp() {
  return (await import("@/servidor/http")).origemAtual();
}

async function linkDefinirSenha() {
  return new URL("/auth?mode=definir", await origemDoApp()).toString();
}

const criarMembroSchema = z.object({
  nome: z.string().min(1),
  email: z.string().email(),
  cargo: z.string().min(1),
  nivel_acesso: z.enum(["gestor", "membro"]),
});

export const listarEquipeAdmin = createServerFn({ method: "GET" })
  .middleware([exigirLogin])
  .handler(async ({ context }) => {
    const { data: isGestor } = await context.db.rpc("is_gestor");
    if (!isGestor) throw new Error("Somente o Administrador pode consultar os acessos da equipe.");

    const { dbAdmin } = await import("@/servidor/dados");
    const [
      { data: profiles, error: profilesError },
      { data: emails, error: emailsError },
      { data: roles, error: rolesError },
    ] = await Promise.all([
      dbAdmin.from("profiles").select("id, nome, cargo, foto_perfil, cor").order("nome"),
      dbAdmin.from("user_emails").select("user_id, email"),
      dbAdmin.from("user_roles").select("user_id, role"),
    ]);

    const error = profilesError ?? emailsError ?? rolesError;
    if (error) throw new Error("Não foi possível carregar os acessos da equipe.");

    const emailById = new Map((emails ?? []).map((item) => [item.user_id, item.email]));
    const roleById = new Map((roles ?? []).map((item) => [item.user_id, item.role]));
    return (profiles ?? []).map((profile) => ({
      ...profile,
      email: emailById.get(profile.id) ?? "",
      role: roleById.get(profile.id) === "gestor" ? ("gestor" as const) : ("membro" as const),
    }));
  });

export const criarMembro = createServerFn({ method: "POST" })
  .middleware([exigirLogin])
  .inputValidator((input: unknown) => criarMembroSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isGestor } = await context.db.rpc("is_gestor");
    if (!isGestor) throw new Error("Somente o Administrador pode cadastrar usuários.");

    const { dbAdmin } = await import("@/servidor/dados");
    const { convidarUsuario } = await import("@/servidor/autenticacao");

    let user: { id: string };
    try {
      user = await convidarUsuario(
        data.email,
        { nome: data.nome, cargo: data.cargo, nivel_acesso: data.nivel_acesso },
        await linkDefinirSenha(),
        await origemDoApp(),
      );
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : "";
      if (mensagem === "email_ja_cadastrado") {
        throw new Error("Este e-mail já está cadastrado.");
      }
      if (mensagem === "limite_de_emails") {
        throw new Error("Muitos e-mails enviados. Aguarde alguns minutos e tente novamente.");
      }
      throw new Error("Não foi possível convidar o usuário. Tente novamente.");
    }

    await dbAdmin.from("profiles").upsert({ id: user.id, nome: data.nome, cargo: data.cargo });

    await dbAdmin
      .from("user_emails")
      .upsert({ user_id: user.id, email: data.email }, { onConflict: "user_id" });

    // O cadastro sempre cria o usuário como "membro"; aqui fica o nível escolhido pelo Administrador.
    await dbAdmin.from("user_roles").delete().eq("user_id", user.id);
    await dbAdmin.from("user_roles").insert({ user_id: user.id, role: data.nivel_acesso });

    // Quadro individual automático em "Demanda da Equipe"
    const { data: existing } = await dbAdmin
      .from("projects")
      .select("id")
      .eq("kind", "individual")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!existing) {
      await dbAdmin.from("projects").insert({
        nome: `Quadro de ${data.nome}`,
        kind: "individual",
        descricao: `Demandas individuais de ${data.nome} — ${data.cargo}.`,
        icon: "User",
        owner_id: user.id,
      });
    }

    return { ok: true, userId: user.id };
  });

export const definirNivelAcesso = createServerFn({ method: "POST" })
  .middleware([exigirLogin])
  .inputValidator((input: unknown) =>
    z
      .object({ user_id: z.string().guid(), nivel_acesso: z.enum(["gestor", "membro"]) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isGestor } = await context.db.rpc("is_gestor");
    if (!isGestor) throw new Error("Somente o Administrador pode alterar níveis de acesso.");

    const { dbAdmin } = await import("@/servidor/dados");
    await dbAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    await dbAdmin.from("user_roles").insert({ user_id: data.user_id, role: data.nivel_acesso });
    return { ok: true };
  });

export const removerMembro = createServerFn({ method: "POST" })
  .middleware([exigirLogin])
  .inputValidator((input: unknown) => z.object({ user_id: z.string().guid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isGestor } = await context.db.rpc("is_gestor");
    if (!isGestor) throw new Error("Somente o Administrador pode remover usuários.");
    if (data.user_id === context.userId) throw new Error("Você não pode remover a si mesmo.");

    const { excluirUsuario } = await import("@/servidor/autenticacao");
    await excluirUsuario(data.user_id);
    return { ok: true };
  });

/** Reenvia o convite e devolve também um link direto de definição de senha (fallback ao e-mail). */
export const reenviarConvite = createServerFn({ method: "POST" })
  .middleware([exigirLogin])
  .inputValidator((input: unknown) => z.object({ email: z.string().email() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isGestor } = await context.db.rpc("is_gestor");
    if (!isGestor) throw new Error("Somente o Administrador pode reenviar convites.");
    const redirectTo = await linkDefinirSenha();
    const origem = await origemDoApp();
    const { gerarLinkDeAcesso } = await import("@/servidor/autenticacao");

    try {
      return {
        ok: true,
        link: await gerarLinkDeAcesso("convite", data.email, redirectTo, origem),
        tipo: "convite" as const,
      };
    } catch {
      // Usuário que já criou a senha — gera link de recuperação de senha.
      try {
        return {
          ok: true,
          link: await gerarLinkDeAcesso("recuperacao", data.email, redirectTo, origem),
          tipo: "recuperacao" as const,
        };
      } catch {
        throw new Error("Não foi possível gerar um novo link de acesso. Tente novamente.");
      }
    }
  });

/** Garante um quadro individual para cada membro cadastrado. */
export const sincronizarQuadros = createServerFn({ method: "POST" })
  .middleware([exigirLogin])
  .handler(async ({ context }) => {
    const { data: isGestor } = await context.db.rpc("is_gestor");
    if (!isGestor) throw new Error("Somente o Administrador pode sincronizar quadros.");

    const { dbAdmin } = await import("@/servidor/dados");
    const [{ data: profiles }, { data: boards }] = await Promise.all([
      dbAdmin.from("profiles").select("id, nome, cargo"),
      dbAdmin.from("projects").select("owner_id").eq("kind", "individual"),
    ]);

    const existentes = new Set((boards ?? []).map((b) => b.owner_id));
    const faltando = (profiles ?? []).filter((p) => !existentes.has(p.id));
    if (faltando.length) {
      await dbAdmin.from("projects").insert(
        faltando.map((p) => ({
          nome: p.nome,
          kind: "individual" as const,
          descricao: `Demandas individuais de ${p.nome} — ${p.cargo}.`,
          icon: "User",
          owner_id: p.id,
        })),
      );
    }
    return { ok: true, criados: faltando.length };
  });
