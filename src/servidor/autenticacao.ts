import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type pg from "pg";
import { comoServidor } from "./banco";
import { enviarEmailDeAcesso } from "./email";

/**
 * Login próprio do TH Flow.
 *
 * - Senhas: bcrypt (custo 12). Hashes antigos (custo 10) continuam válidos.
 * - Sessão: token aleatório de 256 bits num cookie HttpOnly; no banco fica só o
 *   hash SHA-256 dele. Validade de 30 dias, renovada com o uso.
 * - Links por e-mail (convite, redefinição, troca de e-mail): uso único, com
 *   validade curta, e também guardados só como hash.
 * - Limite de tentativas por e-mail e por IP contra força bruta.
 * - As mensagens de erro seguem o padrão já traduzido em src/lib/thc/i18n.ts.
 */

export const COOKIE_SESSAO = "thflow_sessao";
const DURACAO_SESSAO_S = 60 * 60 * 24 * 30;
const CUSTO_BCRYPT = 12;
const VALIDADE_S = {
  convite: 60 * 60 * 24,
  recuperacao: 60 * 60,
  troca_email: 60 * 60 * 24,
} as const;

export type TipoToken = keyof typeof VALIDADE_S;
export type UsuarioSessao = { id: string; email: string; created_at: string };

export class ErroAuth extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const hash = (texto: string) => createHash("sha256").update(texto).digest("hex");
const novoToken = () => randomBytes(32).toString("base64url");
const normalizarEmail = (email: string) => email.trim().toLowerCase();

// Hash fixo usado quando o e-mail não existe, para o tempo de resposta não
// revelar quais e-mails estão cadastrados.
const HASH_FALSO = bcrypt.hashSync(randomBytes(16).toString("hex"), CUSTO_BCRYPT);

// ---------------------------------------------------------------------------
// Cookies
// ---------------------------------------------------------------------------
export function lerCookie(request: Request, nome: string) {
  const cabecalho = request.headers.get("cookie") ?? "";
  for (const parte of cabecalho.split(";")) {
    const [k, ...v] = parte.trim().split("=");
    if (k === nome) return decodeURIComponent(v.join("="));
  }
  return null;
}

function cookieSeguro() {
  const env = process.env["COOKIE_SEGURO"];
  if (env) return env !== "false";
  return process.env["NODE_ENV"] === "production";
}

export function cookieDeSessao(token: string | null) {
  const partes = [
    `${COOKIE_SESSAO}=${token ? encodeURIComponent(token) : ""}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${token ? DURACAO_SESSAO_S : 0}`,
  ];
  if (cookieSeguro()) partes.push("Secure");
  return partes.join("; ");
}

export function ipDaRequisicao(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}

// ---------------------------------------------------------------------------
// Auditoria e limite de tentativas
// ---------------------------------------------------------------------------
async function auditar(
  c: pg.PoolClient,
  evento: string,
  usuarioId: string | null,
  ip: string | null,
  detalhes = {},
) {
  await c.query(
    "INSERT INTO app.auditoria (usuario_id, evento, detalhes, ip) VALUES ($1, $2, $3, $4)",
    [usuarioId, evento, JSON.stringify(detalhes), ip],
  );
}

async function contarFalhas(c: pg.PoolClient, acao: string, chave: string, minutos: number) {
  const { rows } = await c.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM app.tentativas
      WHERE acao = $1 AND chave = $2 AND NOT sucesso AND created_at > now() - make_interval(mins => $3)`,
    [acao, chave, minutos],
  );
  return rows[0]?.n ?? 0;
}

async function registrarTentativa(c: pg.PoolClient, acao: string, chave: string, sucesso: boolean) {
  await c.query("INSERT INTO app.tentativas (acao, chave, sucesso) VALUES ($1, $2, $3)", [
    acao,
    chave,
    sucesso,
  ]);
}

// ---------------------------------------------------------------------------
// Senhas
// ---------------------------------------------------------------------------
/** Consulta anônima (k-anonimato) à base Have I Been Pwned. Se o serviço não responder, não bloqueia. */
async function senhaVazada(senha: string) {
  try {
    const sha1 = createHash("sha1").update(senha).digest("hex").toUpperCase();
    const r = await fetch(`https://api.pwnedpasswords.com/range/${sha1.slice(0, 5)}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) return false;
    const sufixo = sha1.slice(5);
    return (await r.text())
      .split("\n")
      .some((linha) => linha.startsWith(sufixo) && Number(linha.split(":")[1]) > 0);
  } catch {
    return false;
  }
}

async function validarNovaSenha(senha: string, hashAtual: string | null) {
  if (typeof senha !== "string" || senha.length < 6) {
    throw new ErroAuth("senha_curta", 422);
  }
  if (Buffer.byteLength(senha) > 72)
    throw new ErroAuth("A senha pode ter no máximo 72 caracteres.", 422);
  if (hashAtual && (await bcrypt.compare(senha, hashAtual))) {
    throw new ErroAuth("senha_igual_a_atual", 422);
  }
  if (await senhaVazada(senha)) {
    throw new ErroAuth("senha_vazada", 422);
  }
}

// ---------------------------------------------------------------------------
// Sessões
// ---------------------------------------------------------------------------
async function criarSessao(
  c: pg.PoolClient,
  usuarioId: string,
  ip: string | null,
  userAgent: string | null,
) {
  const token = novoToken();
  await c.query(
    `INSERT INTO app.sessoes (usuario_id, token_hash, expira_em, ip, user_agent)
     VALUES ($1, $2, now() + make_interval(secs => $3), $4, $5)`,
    [usuarioId, hash(token), DURACAO_SESSAO_S, ip, userAgent?.slice(0, 300) ?? null],
  );
  return token;
}

/** Usuário da sessão atual (cookie), ou null. */
export async function obterSessao(
  request: Request,
): Promise<{ usuario: UsuarioSessao; token: string } | null> {
  const token = lerCookie(request, COOKIE_SESSAO);
  if (!token || token.length > 200) return null;
  return comoServidor(async (c) => {
    const { rows } = await c.query<UsuarioSessao & { sessao_id: string; renovar: boolean }>(
      `SELECT u.id, u.email, to_jsonb(u.created_at) #>> '{}' AS created_at, s.id AS sessao_id,
              s.ultimo_uso_em < now() - interval '1 day' AS renovar
         FROM app.sessoes s JOIN app.usuarios u ON u.id = s.usuario_id
        WHERE s.token_hash = $1 AND s.expira_em > now()`,
      [hash(token)],
    );
    const r = rows[0];
    if (!r) return null;
    if (r.renovar) {
      await c.query(
        `UPDATE app.sessoes SET ultimo_uso_em = now(), expira_em = now() + make_interval(secs => $2) WHERE id = $1`,
        [r.sessao_id, DURACAO_SESSAO_S],
      );
    }
    return { usuario: { id: r.id, email: r.email, created_at: r.created_at }, token };
  });
}

export async function entrar(
  emailBruto: string,
  senha: string,
  ip: string | null,
  userAgent: string | null,
) {
  const email = normalizarEmail(String(emailBruto ?? ""));
  // Erros são devolvidos (e não lançados) dentro da transação, para que o
  // registro da tentativa e da auditoria seja gravado mesmo quando o login falha.
  const r = await comoServidor(async (c) => {
    // Até 10 erros por e-mail e 50 por IP a cada 15 minutos.
    if (
      (await contarFalhas(c, "login", email, 15)) >= 10 ||
      (ip && (await contarFalhas(c, "login_ip", ip, 15)) >= 50)
    ) {
      await auditar(c, "login_bloqueado", null, ip, { email });
      return { erro: new ErroAuth("muitas_tentativas", 429) };
    }
    const { rows } = await c.query<{
      id: string;
      email: string;
      created_at: string;
      senha_hash: string | null;
    }>(
      "SELECT id, email, to_jsonb(created_at) #>> '{}' AS created_at, senha_hash FROM app.usuarios WHERE lower(email) = $1",
      [email],
    );
    const u = rows[0];
    const valida = await bcrypt.compare(String(senha ?? ""), u?.senha_hash ?? HASH_FALSO);
    if (!u || !u.senha_hash || !valida) {
      await registrarTentativa(c, "login", email, false);
      if (ip) await registrarTentativa(c, "login_ip", ip, false);
      await auditar(c, "login_falhou", u?.id ?? null, ip, { email });
      return { erro: new ErroAuth("credenciais_invalidas", 400) };
    }
    await registrarTentativa(c, "login", email, true);
    await c.query("UPDATE app.usuarios SET ultimo_login_em = now() WHERE id = $1", [u.id]);
    // Hashes antigos com custo menor são atualizados no primeiro login.
    if (bcrypt.getRounds(u.senha_hash) < CUSTO_BCRYPT) {
      await c.query("UPDATE app.usuarios SET senha_hash = $2 WHERE id = $1", [
        u.id,
        await bcrypt.hash(String(senha), CUSTO_BCRYPT),
      ]);
    }
    await auditar(c, "login", u.id, ip);
    const token = await criarSessao(c, u.id, ip, userAgent);
    return { token, usuario: { id: u.id, email: u.email, created_at: u.created_at } };
  });
  if ("erro" in r) throw r.erro;
  return r;
}

export async function sair(token: string | null) {
  if (!token) return;
  await comoServidor((c) =>
    c.query("DELETE FROM app.sessoes WHERE token_hash = $1", [hash(token)]),
  );
}

// ---------------------------------------------------------------------------
// Links de uso único
// ---------------------------------------------------------------------------
async function criarLink(
  c: pg.PoolClient,
  usuarioId: string,
  tipo: TipoToken,
  destino: URL,
  dados = {},
) {
  const token = novoToken();
  // Um link novo invalida os anteriores do mesmo tipo.
  await c.query(
    "UPDATE app.tokens SET usado_em = now() WHERE usuario_id = $1 AND tipo = $2 AND usado_em IS NULL",
    [usuarioId, tipo],
  );
  await c.query(
    `INSERT INTO app.tokens (usuario_id, tipo, token_hash, dados, expira_em)
     VALUES ($1, $2, $3, $4, now() + make_interval(secs => $5))`,
    [usuarioId, tipo, hash(token), JSON.stringify(dados), VALIDADE_S[tipo]],
  );
  destino.searchParams.set("token", token);
  destino.searchParams.set("tipo", tipo);
  return destino.toString();
}

/** Só aceita endereços de retorno do próprio app (evita redirecionamento aberto). */
export function destinoSeguro(destinoPedido: string | undefined, origem: string, padrao: string) {
  try {
    const url = new URL(destinoPedido || padrao, origem);
    if (url.origin !== new URL(origem).origin) return new URL(padrao, origem);
    return url;
  } catch {
    return new URL(padrao, origem);
  }
}

/** Valida um link de convite/recuperação e abre a sessão do usuário. */
export async function verificarLink(
  tokenBruto: string,
  tipoUrl: string,
  ip: string | null,
  userAgent: string | null,
) {
  const tipo = tipoUrl === "convite" || tipoUrl === "recuperacao" ? tipoUrl : null;
  if (!tipo || !tokenBruto) throw new ErroAuth("link_invalido", 403);
  return comoServidor(async (c) => {
    const { rows } = await c.query<{ id: string; usuario_id: string }>(
      `UPDATE app.tokens SET usado_em = now()
        WHERE token_hash = $1 AND tipo = $2 AND usado_em IS NULL AND expira_em > now()
        RETURNING id, usuario_id`,
      [hash(tokenBruto), tipo],
    );
    const t = rows[0];
    if (!t) throw new ErroAuth("link_invalido", 403);
    await c.query(
      "UPDATE app.usuarios SET email_confirmado_em = coalesce(email_confirmado_em, now()) WHERE id = $1",
      [t.usuario_id],
    );
    await auditar(c, `link_${tipo}`, t.usuario_id, ip);
    return { token: await criarSessao(c, t.usuario_id, ip, userAgent) };
  });
}

/** Confirma a troca de e-mail pelo link enviado ao novo endereço. */
export async function confirmarTrocaEmail(tokenBruto: string, ip: string | null) {
  return comoServidor(async (c) => {
    const { rows } = await c.query<{ usuario_id: string; dados: { email?: string } }>(
      `UPDATE app.tokens SET usado_em = now()
        WHERE token_hash = $1 AND tipo = 'troca_email' AND usado_em IS NULL AND expira_em > now()
        RETURNING usuario_id, dados`,
      [hash(tokenBruto)],
    );
    const t = rows[0];
    const novo = t?.dados?.email;
    if (!t || !novo) throw new ErroAuth("link_invalido", 403);
    await c.query("UPDATE app.usuarios SET email = $2, email_confirmado_em = now() WHERE id = $1", [
      t.usuario_id,
      novo,
    ]);
    await c.query(
      `INSERT INTO public.user_emails (user_id, email) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, updated_at = now()`,
      [t.usuario_id, novo],
    );
    await auditar(c, "email_alterado", t.usuario_id, ip, { email: novo });
  });
}

// ---------------------------------------------------------------------------
// Alterações feitas pelo próprio usuário
// ---------------------------------------------------------------------------
export async function alterarSenha(
  usuarioId: string,
  senha: string,
  ip: string | null,
  manterToken: string | null,
) {
  await comoServidor(async (c) => {
    const { rows } = await c.query<{ senha_hash: string | null }>(
      "SELECT senha_hash FROM app.usuarios WHERE id = $1",
      [usuarioId],
    );
    await validarNovaSenha(senha, rows[0]?.senha_hash ?? null);
    await c.query(
      "UPDATE app.usuarios SET senha_hash = $2, email_confirmado_em = coalesce(email_confirmado_em, now()) WHERE id = $1",
      [usuarioId, await bcrypt.hash(senha, CUSTO_BCRYPT)],
    );
    // Encerra as outras sessões abertas e os links pendentes.
    await c.query("DELETE FROM app.sessoes WHERE usuario_id = $1 AND token_hash <> $2", [
      usuarioId,
      manterToken ? hash(manterToken) : "",
    ]);
    await c.query(
      "UPDATE app.tokens SET usado_em = now() WHERE usuario_id = $1 AND usado_em IS NULL AND tipo <> 'troca_email'",
      [usuarioId],
    );
    await auditar(c, "senha_alterada", usuarioId, ip);
  });
}

export async function solicitarTrocaEmail(
  usuarioId: string,
  novoEmail: string,
  origem: string,
  ip: string | null,
) {
  const email = normalizarEmail(novoEmail);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErroAuth("email_invalido", 400);
  const link = await comoServidor(async (c) => {
    const { rows } = await c.query(
      "SELECT 1 FROM app.usuarios WHERE lower(email) = $1 AND id <> $2",
      [email, usuarioId],
    );
    if (rows.length) throw new ErroAuth("email_ja_cadastrado", 422);
    await auditar(c, "troca_email_solicitada", usuarioId, ip, { email });
    return criarLink(c, usuarioId, "troca_email", new URL("/api/auth/confirmar-email", origem), {
      email,
    });
  });
  const r = await enviarEmailDeAcesso("troca_email", email, link);
  if (!r.ok) throw new ErroAuth("Não foi possível enviar o e-mail de confirmação.", 502);
}

/** Envia o link de redefinição. Responde igual exista ou não o e-mail. */
export async function solicitarRecuperacao(
  emailBruto: string,
  destinoPedido: string | undefined,
  origem: string,
  ip: string | null,
) {
  const email = normalizarEmail(String(emailBruto ?? ""));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErroAuth("email_invalido", 400);
  const envio = await comoServidor(async (c) => {
    const { rows: recentes } = await c.query(
      "SELECT 1 FROM app.tentativas WHERE acao = 'recuperacao' AND chave = $1 AND created_at > now() - interval '60 seconds'",
      [email],
    );
    if (recentes.length) throw new ErroAuth("aguarde_para_tentar", 429);
    if (ip && (await contarFalhas(c, "recuperacao_ip", ip, 60)) >= 20) {
      throw new ErroAuth("limite_de_emails", 429);
    }
    await registrarTentativa(c, "recuperacao", email, false);
    if (ip) await registrarTentativa(c, "recuperacao_ip", ip, false);
    const { rows } = await c.query<{ id: string; email: string }>(
      "SELECT id, email FROM app.usuarios WHERE lower(email) = $1",
      [email],
    );
    const u = rows[0];
    if (!u) return null;
    await auditar(c, "recuperacao_solicitada", u.id, ip);
    const link = await criarLink(
      c,
      u.id,
      "recuperacao",
      destinoSeguro(destinoPedido, origem, "/redefinir-senha"),
    );
    return { email: u.email, link };
  });
  if (envio) await enviarEmailDeAcesso("recuperacao", envio.email, envio.link);
}

// ---------------------------------------------------------------------------
// Administração (usada pelas funções do gestor em src/lib/thc/admin.functions.ts)
// ---------------------------------------------------------------------------
export async function convidarUsuario(
  emailBruto: string,
  metadados: Record<string, unknown>,
  destinoPedido: string,
  origem: string,
) {
  const email = normalizarEmail(emailBruto);
  const { usuario, link } = await comoServidor(async (c) => {
    const { rows: existe } = await c.query("SELECT 1 FROM app.usuarios WHERE lower(email) = $1", [
      email,
    ]);
    if (existe.length) throw new ErroAuth("email_ja_cadastrado", 422);
    const { rows } = await c.query<UsuarioSessao>(
      "INSERT INTO app.usuarios (email, metadados) VALUES ($1, $2) RETURNING id, email, to_jsonb(created_at) #>> '{}' AS created_at",
      [email, JSON.stringify(metadados)],
    );
    const u = rows[0]!;
    await auditar(c, "usuario_convidado", u.id, null, { email });
    return {
      usuario: u,
      link: await criarLink(
        c,
        u.id,
        "convite",
        destinoSeguro(destinoPedido, origem, "/auth?mode=definir"),
      ),
    };
  });
  const r = await enviarEmailDeAcesso("convite", email, link);
  if (!r.ok) console.error("[email] falha ao enviar convite:", r.erro);
  return usuario;
}

/** Gera um link novo de convite (quem nunca criou senha) ou de redefinição. */
export async function gerarLinkDeAcesso(
  tipo: "convite" | "recuperacao",
  emailBruto: string,
  destinoPedido: string,
  origem: string,
) {
  const email = normalizarEmail(emailBruto);
  return comoServidor(async (c) => {
    const { rows } = await c.query<{ id: string; senha_hash: string | null }>(
      "SELECT id, senha_hash FROM app.usuarios WHERE lower(email) = $1",
      [email],
    );
    const u = rows[0];
    if (!u) throw new ErroAuth("usuario_nao_encontrado", 404);
    if (tipo === "convite" && u.senha_hash) throw new ErroAuth("email_ja_cadastrado", 422);
    return criarLink(c, u.id, tipo, destinoSeguro(destinoPedido, origem, "/auth?mode=definir"));
  });
}

export async function excluirUsuario(usuarioId: string) {
  await comoServidor(async (c) => {
    await c.query("DELETE FROM app.usuarios WHERE id = $1", [usuarioId]);
    await auditar(c, "usuario_excluido", usuarioId, null);
  });
}

/** Limpeza diária: sessões vencidas, links usados e tentativas antigas. */
export async function limparRegistrosAntigos() {
  await comoServidor(async (c) => {
    await c.query("DELETE FROM app.sessoes WHERE expira_em < now()");
    await c.query("DELETE FROM app.tokens WHERE expira_em < now() - interval '7 days'");
    await c.query("DELETE FROM app.tentativas WHERE created_at < now() - interval '7 days'");
    await c.query("DELETE FROM app.auditoria WHERE created_at < now() - interval '1 year'");
  });
}
