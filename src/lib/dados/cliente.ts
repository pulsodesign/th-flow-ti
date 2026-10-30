import { criarClienteDados, type ErroDados } from "./consulta";

/**
 * Cliente usado pelas telas (navegador). Tudo passa pelo servidor do app:
 *   - dados:      POST /api/dados (as regras de acesso valem no banco)
 *   - login:      /api/auth/*  (sessão em cookie HttpOnly, invisível ao JavaScript)
 *   - tempo real: GET /api/tempo-real (Server-Sent Events)
 */

const CABECALHO_APP = { "x-thflow-requisicao": "1" };

export type Usuario = { id: string; email: string; created_at: string };
export type Sessao = { user: Usuario };
type EventoSessao = "inicial" | "entrou" | "saiu" | "atualizado";
type OuvinteSessao = (evento: EventoSessao, sessao: Sessao | null) => void;

// ---------------------------------------------------------------------------
// Sessão
// ---------------------------------------------------------------------------
let usuarioAtual: Promise<Usuario | null> | null = null;
const ouvintes = new Set<OuvinteSessao>();

async function buscarUsuario(): Promise<Usuario | null> {
  if (typeof window === "undefined") return null;
  try {
    const r = await fetch("/api/auth/sessao", { credentials: "same-origin", cache: "no-store" });
    if (!r.ok) return null;
    return ((await r.json()) as { user: Usuario | null }).user;
  } catch {
    return null;
  }
}

function emitir(evento: EventoSessao, usuario: Usuario | null) {
  const sessao = usuario ? { user: usuario } : null;
  for (const o of ouvintes) o(evento, sessao);
}

async function chamarAuth(acao: string, corpo: unknown = {}) {
  try {
    const r = await fetch(`/api/auth/${acao}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", ...CABECALHO_APP },
      body: JSON.stringify(corpo),
    });
    const dados = (await r.json().catch(() => ({}))) as { user?: Usuario; error?: ErroDados };
    return { dados, error: r.ok ? null : (dados.error ?? { message: `Erro ${r.status}` }) };
  } catch (e) {
    return {
      dados: {},
      error: { message: e instanceof Error ? e.message : "falha_conexao" } as ErroDados,
    };
  }
}

function sessaoEncerrada() {
  if (usuarioAtual === null) return;
  usuarioAtual = Promise.resolve(null);
  emitir("saiu", null);
}

const auth = {
  /** Sessão atual (consulta o servidor só na primeira vez). */
  async sessao() {
    usuarioAtual ??= buscarUsuario();
    const u = await usuarioAtual;
    return { data: { session: u ? { user: u } : null }, error: null };
  },

  /** Confere a sessão no servidor (usado ao entrar nas telas protegidas). */
  async usuario() {
    usuarioAtual = buscarUsuario();
    const u = await usuarioAtual;
    return u
      ? { data: { user: u }, error: null }
      : { data: { user: null }, error: { message: "sessao_expirada" } as ErroDados };
  },

  async entrar({ email, senha }: { email: string; senha: string }) {
    const { dados, error } = await chamarAuth("entrar", { email, senha });
    if (error || !dados.user) return { data: { user: null, session: null }, error };
    usuarioAtual = Promise.resolve(dados.user);
    emitir("entrou", dados.user);
    return { data: { user: dados.user, session: { user: dados.user } }, error: null };
  },

  async sair() {
    await chamarAuth("sair");
    usuarioAtual = Promise.resolve(null);
    emitir("saiu", null);
    return { error: null };
  },

  /** Valida o link de convite ou de redefinição de senha e abre a sessão. */
  async validarLink({ token, tipo }: { token: string; tipo: string }) {
    const { error } = await chamarAuth("verificar", { token, tipo });
    if (error) return { data: { user: null }, error };
    const { data } = await auth.usuario();
    if (data.user) emitir("entrou", data.user);
    return { data, error: null };
  },

  async atualizar(dados: { senha?: string; email?: string }) {
    const { dados: r, error } = await chamarAuth("atualizar", dados);
    if (error) return { data: { user: null }, error };
    if (r.user) emitir("atualizado", r.user);
    return { data: { user: r.user ?? null }, error: null };
  },

  async pedirRedefinicao(email: string, destino?: string) {
    const { error } = await chamarAuth("recuperar", { email, destino });
    return { data: {}, error };
  },

  /** Avisa quando a pessoa entra, sai ou altera a conta. Devolve a função que cancela o aviso. */
  aoMudarSessao(ouvinte: OuvinteSessao) {
    ouvintes.add(ouvinte);
    void auth
      .sessao()
      .then(({ data }) => ouvintes.has(ouvinte) && ouvinte("inicial", data.session));
    return () => {
      ouvintes.delete(ouvinte);
    };
  },
};

// ---------------------------------------------------------------------------
// Dados
// ---------------------------------------------------------------------------
async function postarDados(corpo: unknown) {
  const r = await fetch("/api/dados", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...CABECALHO_APP },
    body: JSON.stringify(corpo),
  });
  if (r.status === 401) sessaoEncerrada();
  const resposta = (await r.json().catch(() => null)) as {
    data: unknown;
    error: ErroDados | null;
  } | null;
  return resposta ?? { data: null, error: { message: `Erro ${r.status}` } };
}

const dados = criarClienteDados({
  consulta: (consulta) => postarDados({ consulta }),
  rpc: (rpc) => postarDados({ rpc }),
});

// ---------------------------------------------------------------------------
// Tempo real
// ---------------------------------------------------------------------------
type TipoMudanca = "INSERT" | "UPDATE" | "DELETE";
type Mudanca = { tabela: string; evento: TipoMudanca; linha?: Record<string, unknown> };
export type AvisoDeMudanca = {
  evento: TipoMudanca;
  tabela: string;
  /** Linha nova (vazia em exclusões). Só as notificações trazem a linha. */
  nova: Record<string, unknown>;
  /** Linha excluída (vazia nos demais casos). */
  antiga: Record<string, unknown>;
};
type Inscricao = {
  evento: TipoMudanca | "*";
  tabela: string;
  /** Só avisa quando a linha tem este valor nesta coluna. */
  filtro?: { coluna: string; valor: string } | undefined;
  cb: (aviso: AvisoDeMudanca) => void;
};
type StatusCanal = "conectado" | "erro";

const canais = new Set<Canal>();
let fonte: EventSource | null = null;

function abrirFonte() {
  if (fonte || typeof window === "undefined") return;
  fonte = new EventSource("/api/tempo-real", { withCredentials: true });
  fonte.onopen = () => canais.forEach((c) => c.status("conectado"));
  fonte.onerror = () => {
    canais.forEach((c) => c.status("erro"));
    // Sem sessão o servidor recusa; o navegador tentaria de novo para sempre.
    if (fonte?.readyState === EventSource.CLOSED) fecharFonte();
  };
  fonte.onmessage = (e) => {
    let m: Mudanca;
    try {
      m = JSON.parse(e.data as string) as Mudanca;
    } catch {
      return;
    }
    canais.forEach((c) => c.entregar(m));
  };
}

function fecharFonte() {
  fonte?.close();
  fonte = null;
}

class Canal {
  private inscricoes: Inscricao[] = [];
  private aoStatus: ((s: StatusCanal) => void) | undefined;

  /** Registra o interesse em mudanças de uma tabela. */
  escutar(
    alvo: { tabela: string; evento?: TipoMudanca | "*"; filtro?: Inscricao["filtro"] },
    cb: (aviso: AvisoDeMudanca) => void,
  ) {
    this.inscricoes.push({
      evento: alvo.evento ?? "*",
      tabela: alvo.tabela,
      filtro: alvo.filtro,
      cb,
    });
    return this;
  }

  iniciar(aoStatus?: (s: StatusCanal) => void) {
    this.aoStatus = aoStatus;
    canais.add(this);
    abrirFonte();
    if (fonte?.readyState === EventSource.OPEN) queueMicrotask(() => this.status("conectado"));
    return this;
  }

  status(s: StatusCanal) {
    this.aoStatus?.(s);
  }

  entregar(m: Mudanca) {
    for (const i of this.inscricoes) {
      if (i.tabela !== m.tabela) continue;
      if (i.evento !== "*" && i.evento !== m.evento) continue;
      if (i.filtro && String(m.linha?.[i.filtro.coluna] ?? "") !== i.filtro.valor) continue;
      const linha = m.linha ?? {};
      i.cb({
        evento: m.evento,
        tabela: m.tabela,
        nova: m.evento === "DELETE" ? {} : linha,
        antiga: m.evento === "DELETE" ? linha : {},
      });
    }
  }

  fechar() {
    // Remoção pedida pela própria tela: não avisa status, para não disparar reconexão.
    canais.delete(this);
    this.aoStatus = undefined;
    if (!canais.size) fecharFonte();
  }
}

/** Cliente do app no navegador. */
export const db = {
  ...dados,
  auth,
  canal: () => new Canal(),
  removerCanal: (canal: Canal) => canal.fechar(),
};
