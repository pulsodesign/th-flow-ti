import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { db } from "@/lib/dados/cliente";
import { useAuth } from "./auth";
import { sanitizeRichHtml } from "./sanitize";
import { isArquivada } from "./filters";
import { nivelDoTipo, type TipoNotificacao } from "./notificacoes";
import { notificar } from "./notificacoes.functions";
import {
  EVENT_STATUS_KEY,
  RECORRENCIAS,
  addMesesISO,
  isEventTask,
  isEventoEncerrado,
  type ActivityLog,
  type Anexo,
  type AppNotification,
  type UserColumnOrder,
  type Profile,
  type Recorrencia,
  type Project,
  type ProjectColumn,
  type RequestOption,
  type RequestOptionTipo,
  type Status,
  type Task,
} from "./types";

const KEY = ["thc-workspace"];

/**
 * Cria notificações para outras pessoas. O servidor grava no app e entrega por push e
 * e-mail; se ele não responder, grava direto no banco para o aviso no app não se perder.
 */
export async function enviarNotificacao(
  userIds: string[],
  taskId: string | null,
  tipo: TipoNotificacao,
  titulo: string,
  body: string,
  autorId: string | null,
) {
  const alvos = [...new Set(userIds.filter((u) => u && u !== autorId))];
  if (!alvos.length) return;
  try {
    await notificar({ data: { userIds: alvos, taskId, tipo, titulo, body } });
  } catch {
    await db.from("notifications").insert(
      alvos.map((u) => ({
        user_id: u,
        task_id: taskId,
        tipo,
        titulo,
        body,
        nivel: nivelDoTipo(tipo),
      })),
    );
  }
}

/** Statuses padrão do sistema incluindo a nova coluna "Eventos" após "Standby".
 * Usado como referência/seed — a fonte da verdade em tempo de execução é sempre
 * a tabela `statuses` do banco, para que a reordenação por quadro funcione. */
export const DEFAULT_STATUSES: Omit<Status, "id">[] = [
  { chave: "backlog", label: "Backlog", cor: "oklch(0.6 0.02 260)", posicao: 1, is_done: false },
  {
    chave: "em_andamento",
    label: "Em Andamento",
    cor: "oklch(0.75 0.15 65)",
    posicao: 2,
    is_done: false,
  },
  {
    chave: "aguardando_aprovacao",
    label: "Aguardando aprovação",
    cor: "oklch(0.7 0.12 300)",
    posicao: 3,
    is_done: false,
  },
  {
    chave: "com_fornecedor",
    label: "Com fornecedor",
    cor: "oklch(0.65 0.12 200)",
    posicao: 4,
    is_done: false,
  },
  {
    chave: "concluido",
    label: "Concluído",
    cor: "oklch(0.625 0.169 133.5)",
    posicao: 5,
    is_done: true,
  },
  { chave: "standby", label: "Stand by", cor: "oklch(0.55 0.03 260)", posicao: 6, is_done: false },
  {
    chave: EVENT_STATUS_KEY,
    label: "Eventos",
    cor: "oklch(0.78 0.16 70)",
    posicao: 7,
    is_done: false,
  },
];

/** Normaliza campos jsonb e migra a tag legada (tag/cor_da_tag) para o array `tags`. */
export function normalizeTask(t: Task): Task {
  const raw = Array.isArray(t.tags) ? t.tags : [];
  const tags = raw
    .filter((x): x is { nome: string; cor: string } => !!x && typeof x === "object")
    .map((x) => ({ nome: String(x.nome ?? ""), cor: String(x.cor ?? "oklch(0.6 0.14 259)") }))
    .filter((x) => x.nome);
  if (!tags.length && t.tag) {
    tags.push({ nome: t.tag, cor: t.cor_da_tag ?? "oklch(0.6 0.14 259)" });
  }
  return {
    ...t,
    subtarefas: Array.isArray(t.subtarefas) ? t.subtarefas : [],
    usuario_id: t.usuario_id ?? [],
    anexos: Array.isArray(t.anexos) ? t.anexos : [],
    tags,
    is_completed: t.is_completed ?? false,
    recorrencia: t.recorrencia ?? "nenhuma",
    lembrete: t.lembrete ?? false,
  };
}

/** Rótulo exibido de um quadro — individuais aparecem como "Nome | Cargo". */
export function boardLabel(board: Project, profiles: Profile[]) {
  if (board.kind !== "individual" || !board.owner_id) return board.nome;
  const p = profiles.find((x) => x.id === board.owner_id);
  if (!p) return board.nome;
  const primeiro = p.nome.trim().split(/\s+/)[0] ?? p.nome;
  return p.cargo ? `${primeiro} | ${p.cargo}` : primeiro;
}

/** Link absoluto que abre o modal da tarefa (usado em notificações e no botão "copiar link"). */
export function taskLink(task: Pick<Task, "id" | "board_id" | "projeto_id">) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const board = task.board_id ?? task.projeto_id;
  return board
    ? `${origin}/quadro/${board}?task=${task.id}`
    : `${origin}/minhas-tarefas?task=${task.id}`;
}

async function fetchWorkspace() {
  const [profiles, roles, projects, statuses, columns, tasks, columnOrder] = await Promise.all([
    db.from("profiles").select("*").order("nome"),
    db.from("user_roles").select("user_id, role"),
    db.from("projects").select("*").order("posicao").order("created_at"),
    db.from("statuses").select("*").order("posicao"),
    db.from("project_columns").select("*").order("posicao"),
    db.from("tasks").select("*").is("deletada_em", null).order("ordem"),
    // RLS já limita às linhas do próprio usuário.
    db.from("user_board_column_order").select("user_id, project_id, column_chave, posicao"),
  ]);

  // Limpeza automática: tarefas na lixeira há mais de 30 dias são removidas de vez.
  void db
    .from("tasks")
    .delete()
    .lt("deletada_em", new Date(Date.now() - 30 * 864e5).toISOString())
    .then(() => undefined);

  return {
    profiles: (profiles.data ?? []) as Profile[],
    roles: (roles.data ?? []) as { user_id: string; role: string }[],
    projects: (projects.data ?? []) as Project[],
    statuses: (statuses.data ?? []) as Status[],
    columns: (columns.data ?? []) as ProjectColumn[],
    tasks: ((tasks.data ?? []) as unknown as Task[]).map(normalizeTask),
    columnOrder: (columnOrder.data ?? []) as UserColumnOrder[],
  };
}

export function useWorkspace() {
  const qc = useQueryClient();
  const { userId } = useAuth();

  const query = useQuery({
    queryKey: KEY,
    queryFn: fetchWorkspace,
    enabled: !!userId,
    staleTime: 5_000,
  });

  useEffect(() => {
    if (!userId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const invalidateSoon = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        void qc.invalidateQueries({ queryKey: KEY });
        void qc.invalidateQueries({ queryKey: ["thc-notifications"] });
        void qc.invalidateQueries({ queryKey: ["thc-activity"] });
      }, 400);
    };
    // Conexão em tempo real com reconexão automática (recuo progressivo).
    // Em algumas máquinas/redes (proxy, antivírus, Windows) o WebSocket cai;
    // sem isso a tela ficava "congelada" até um F5.
    let channel: ReturnType<typeof db.canal> | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let tentativas = 0;
    let ativo = true;

    const conectar = () => {
      if (!ativo) return;
      channel = db.canal();
      for (const table of [
        "tasks",
        "projects",
        "statuses",
        "project_columns",
        "user_board_column_order",
        "profiles",
        "user_roles",
        "request_options",
        "activity_logs",
        "notifications",
      ]) {
        channel.escutar({ tabela: table }, invalidateSoon);
      }
      channel.iniciar((status) => {
        if (status === "conectado") {
          tentativas = 0;
          invalidateSoon();
          return;
        }
        if (status === "erro") {
          if (!ativo || retry) return;
          const espera = Math.min(30_000, 1_000 * 2 ** tentativas++);
          retry = setTimeout(() => {
            retry = null;
            const antigo = channel;
            channel = null;
            if (antigo) db.removerCanal(antigo);
            conectar();
          }, espera);
        }
      });
    };
    conectar();

    // Ao voltar o foco da aba ou a internet, recarrega os dados silenciosamente.
    const revalidar = () => {
      if (document.visibilityState === "visible") invalidateSoon();
    };
    window.addEventListener("online", invalidateSoon);
    document.addEventListener("visibilitychange", revalidar);

    return () => {
      ativo = false;
      if (timer) clearTimeout(timer);
      if (retry) clearTimeout(retry);
      window.removeEventListener("online", invalidateSoon);
      document.removeEventListener("visibilitychange", revalidar);
      if (channel) db.removerCanal(channel);
    };
  }, [qc, userId]);

  const data = query.data;

  return useMemo(() => {
    const profiles = data?.profiles ?? [];
    const roles = data?.roles ?? [];
    const projects = data?.projects ?? [];
    const statuses = data?.statuses ?? [];
    const columns = data?.columns ?? [];
    const tasks = data?.tasks ?? [];
    const columnOrder = data?.columnOrder ?? [];

    return {
      loading: query.isLoading,
      profiles,
      roles,
      projects,
      statuses,
      columns,
      tasks,
      columnOrder,
      masterBoard: projects.find((p) => p.kind === "mae") ?? null,
      departmentBoards: projects.filter((p) => p.kind === "departamento"),
      individualBoards: projects.filter((p) => p.kind === "individual"),
      profileById: (id: string | null | undefined) => profiles.find((p) => p.id === id) ?? null,
      roleOf: (id: string) =>
        roles.some((r) => r.user_id === id && r.role === "gestor") ? "gestor" : "membro",
      refetch: () => qc.invalidateQueries({ queryKey: KEY }),
    };
  }, [data, query.isLoading, qc]);
}

/**
 * Colunas visíveis de um quadro: status globais + colunas personalizadas do quadro.
 *
 * A ordem padrão vem de `statuses.posicao` / `project_columns.posicao` (definida no
 * Quadro Mãe / no próprio quadro). Se o USUÁRIO logado já reordenou este quadro
 * (linhas em `user_board_column_order`), a preferência dele vem primeiro e vale só
 * para ele. Colunas criadas depois da personalização entram no fim, na ordem padrão.
 */
export function boardColumns(
  boardId: string,
  statuses: Status[],
  columns: ProjectColumn[],
  userOrder: UserColumnOrder[] = [],
) {
  const custom = columns.filter((c) => c.project_id === boardId);
  const prefs = new Map(
    userOrder.filter((o) => o.project_id === boardId).map((o) => [o.column_chave, o.posicao]),
  );

  const todas = [
    ...statuses.map((s) => ({
      chave: s.chave,
      label: s.label,
      cor: s.cor,
      posicao: s.posicao,
      custom: false,
      id: s.id,
    })),
    ...custom.map((c) => ({
      chave: c.chave,
      label: c.label,
      cor: c.cor,
      posicao: c.posicao,
      custom: true,
      id: c.id,
    })),
  ].sort((a, b) => a.posicao - b.posicao);

  if (prefs.size === 0) return todas;

  const comPref = todas
    .filter((c) => prefs.has(c.chave))
    .sort((a, b) => (prefs.get(a.chave) ?? 0) - (prefs.get(b.chave) ?? 0));
  const semPref = todas.filter((c) => !prefs.has(c.chave));
  return [...comPref, ...semPref];
}

/** Espelhamento: uma tarefa aparece no quadro mãe, no quadro do projeto e nos quadros individuais dos responsáveis. */
export function tasksForBoard(board: Project, tasks: Task[]) {
  return tasks.filter((t) => {
    // Eventos são globais: cadastrados no Gestão de Demandas, aparecem em TODOS os quadros.
    if (isEventTask(t.status)) return !isEventoEncerrado(t);
    if (board.kind === "mae") return true;
    if (t.board_id === board.id || t.projeto_id === board.id) return true;
    if (board.kind === "individual" && board.owner_id) return t.usuario_id.includes(board.owner_id);
    return false;
  });
}

/**
 * Criação e reordenação de colunas:
 * - Criar coluna no Quadro Mãe grava em `statuses` (global) → aparece em todos os quadros.
 * - Criar coluna em qualquer outro quadro grava em `project_columns` (local) → só naquele quadro.
 * - Reordenar é SEMPRE pessoal: grava em `user_board_column_order` (usuário + quadro),
 *   sem afetar o que os outros veem. A única exceção é o administrador no Quadro Mãe,
 *   que também atualiza `statuses.posicao` — a ordem padrão de quem nunca personalizou.
 */
export function useColumnMutations() {
  const qc = useQueryClient();
  const { userId, isGestor } = useAuth();
  const invalidate = () => void qc.invalidateQueries({ queryKey: KEY });

  const addColumn = useMutation({
    mutationFn: async ({
      board,
      label,
      posicao,
    }: {
      board: Project;
      label: string;
      posicao: number;
    }) => {
      const chave = `c_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      if (board.kind === "mae") {
        const { error } = await db.from("statuses").insert({
          chave,
          label,
          cor: "oklch(0.6 0.05 260)",
          posicao,
          is_done: false,
        });
        if (error) throw error;
        return;
      }
      const { error } = await db.from("project_columns").insert({
        project_id: board.id,
        chave,
        label,
        cor: "oklch(0.6 0.05 260)",
        posicao,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /**
   * Salva a ordem completa das colunas de um quadro para o USUÁRIO logado.
   * `ordem` é a lista de chaves na sequência final desejada.
   */
  const reorderColumns = useMutation({
    mutationFn: async ({
      board,
      ordem,
    }: {
      board: Project;
      ordem: { chave: string; custom: boolean }[];
    }) => {
      if (!userId) throw new Error("Sessão expirada.");

      const linhas = ordem.map((c, i) => ({
        user_id: userId,
        project_id: board.id,
        column_chave: c.chave,
        posicao: (i + 1) * 10,
      }));
      const { error } = await db
        .from("user_board_column_order")
        .upsert(linhas, { onConflict: "user_id,project_id,column_chave" });
      if (error) throw error;

      // Administrador no Quadro Mãe também define a ordem PADRÃO global (fallback
      // para quem ainda não personalizou aquele quadro).
      if (board.kind === "mae" && isGestor) {
        await Promise.all(
          ordem.map((c, i) =>
            c.custom
              ? db
                  .from("project_columns")
                  .update({ posicao: (i + 1) * 10 })
                  .eq("project_id", board.id)
                  .eq("chave", c.chave)
              : db
                  .from("statuses")
                  .update({ posicao: (i + 1) * 10 })
                  .eq("chave", c.chave),
          ),
        );
      }
    },
    // Atualização otimista: reordena na hora, sem esperar o banco.
    onMutate: async ({ board, ordem }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const anterior = qc.getQueryData<Awaited<ReturnType<typeof fetchWorkspace>>>(KEY);
      if (anterior && userId) {
        const outros = anterior.columnOrder.filter((o) => o.project_id !== board.id);
        qc.setQueryData(KEY, {
          ...anterior,
          columnOrder: [
            ...outros,
            ...ordem.map((c, i) => ({
              user_id: userId,
              project_id: board.id,
              column_chave: c.chave,
              posicao: (i + 1) * 10,
            })),
          ],
        });
      }
      return { anterior };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.anterior) qc.setQueryData(KEY, ctx.anterior);
      toast.error("Não foi possível salvar a ordem das colunas.");
    },
    onSettled: invalidate,
  });

  /** Remove a personalização de ordem do usuário para o quadro (volta ao padrão). */
  const resetColumnOrder = useMutation({
    mutationFn: async ({ board }: { board: Project }) => {
      if (!userId) throw new Error("Sessão expirada.");
      const { error } = await db
        .from("user_board_column_order")
        .delete()
        .eq("user_id", userId)
        .eq("project_id", board.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /** Exclui a coluna: global (`statuses`) quando está no Quadro Mãe, local (`project_columns`) nos demais. */
  const deleteColumn = useMutation({
    mutationFn: async ({ id, custom }: { id: string; custom: boolean }) => {
      const { error } = await db
        .from(custom ? "project_columns" : "statuses")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /** Altera a cor da coluna na tabela correspondente (global ou local). */
  const setColumnColor = useMutation({
    mutationFn: async ({ id, custom, cor }: { id: string; custom: boolean; cor: string }) => {
      const { error } = await db
        .from(custom ? "project_columns" : "statuses")
        .update({ cor })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { addColumn, reorderColumns, resetColumnOrder, deleteColumn, setColumnColor };
}

export function useTaskMutations() {
  const qc = useQueryClient();
  const { userId, profile } = useAuth();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: KEY });
    void qc.invalidateQueries({ queryKey: ["thc-activity"] });
  };

  const log = async (taskId: string, body: string) => {
    if (!userId) return;
    await db
      .from("activity_logs")
      .insert({ task_id: taskId, user_id: userId, kind: "event", body });
  };

  const notify = (
    userIds: string[],
    taskId: string,
    tipo: TipoNotificacao,
    titulo: string,
    body: string,
  ) => enviarNotificacao(userIds, taskId, tipo, titulo, body, userId);

  /** Todos que acompanham a tarefa: responsáveis, criador e quem já foi mencionado nela. */
  const participantes = async (taskId: string, base: string[] = []) => {
    const [{ data: task }, { data: logs }] = await Promise.all([
      db.from("tasks").select("usuario_id, criador_id").eq("id", taskId).maybeSingle(),
      db.from("activity_logs").select("mentions").eq("task_id", taskId),
    ]);
    const mencionados = (logs ?? []).flatMap((l) => (l.mentions ?? []) as string[]);
    return [
      ...new Set(
        [
          ...base,
          ...((task?.usuario_id ?? []) as string[]),
          task?.criador_id ?? "",
          ...mencionados,
        ].filter(Boolean),
      ),
    ];
  };

  const createTask = useMutation({
    mutationFn: async (input: Partial<Task> & { titulo: string }) => {
      const { data, error } = await db
        .from("tasks")
        .insert({
          titulo: input.titulo,
          descricao: sanitizeRichHtml(input.descricao ?? ""),
          status: input.status ?? "backlog",
          prioridade: input.prioridade ?? "media",
          board_id: input.board_id ?? null,
          projeto_id: input.projeto_id ?? null,
          usuario_id: input.usuario_id ?? [],
          data_inicio: input.data_inicio ?? new Date().toISOString().slice(0, 10),
          data_vencimento: input.data_vencimento ?? null,
          tag: input.tag ?? null,
          cor_da_tag: input.cor_da_tag ?? null,
          tags: input.tags ?? [],
          anexos: input.anexos ?? [],
          is_master: input.is_master ?? false,
          subtarefas: input.subtarefas ?? [],
          criador_id: userId,
          ordem: input.ordem ?? Date.now() % 100000,
          versao: input.versao ?? null,
          area: input.area ?? null,
          solicitante: input.solicitante ?? null,
          // Só envia o campo quando ligado: tarefas sem lembrete não dependem dele no banco.
          ...(input.lembrete ? { lembrete: true } : {}),
        })
        .select()
        .single();
      if (error) throw error;
      const t = data as unknown as Task;
      await notify(
        t.usuario_id ?? [],
        t.id,
        "atribuicao",
        "Você foi marcado em uma tarefa",
        `${profile?.nome ?? "Alguém"} marcou você na tarefa "${t.titulo}".`,
      );
      return t;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: KEY });
      const snapshot = qc.getQueryData<Awaited<ReturnType<typeof fetchWorkspace>>>(KEY);
      const tempId = crypto.randomUUID();
      if (snapshot) {
        const optimistic = normalizeTask({
          id: tempId,
          titulo: input.titulo,
          descricao: input.descricao ?? "",
          status: input.status ?? "backlog",
          prioridade: input.prioridade ?? "media",
          board_id: input.board_id ?? null,
          projeto_id: input.projeto_id ?? null,
          usuario_id: input.usuario_id ?? [],
          data_inicio: input.data_inicio ?? new Date().toISOString().slice(0, 10),
          data_vencimento: input.data_vencimento ?? null,
          tag: input.tag ?? null,
          cor_da_tag: input.cor_da_tag ?? null,
          tags: input.tags ?? [],
          anexos: input.anexos ?? [],
          is_master: input.is_master ?? false,
          subtarefas: input.subtarefas ?? [],
          criador_id: userId,
          concluida_em: null,
          deletada_em: null,
          ordem: input.ordem ?? Date.now() % 100000,
          created_at: new Date().toISOString(),
          versao: input.versao ?? null,
          area: input.area ?? null,
          solicitante: input.solicitante ?? null,
          is_completed: false,
        });
        qc.setQueryData(KEY, { ...snapshot, tasks: [...snapshot.tasks, optimistic] });
      }
      return { snapshot, tempId };
    },
    onError: (error, _vars, context) => {
      if (context?.snapshot) qc.setQueryData(KEY, context.snapshot);
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a tarefa.");
    },
    onSuccess: (t, _vars, context) => {
      // Substitui a tarefa temporária pela real antes de invalidar a query.
      if (context?.tempId) {
        const cache = qc.getQueryData<Awaited<ReturnType<typeof fetchWorkspace>>>(KEY);
        if (cache) {
          qc.setQueryData(KEY, {
            ...cache,
            tasks: cache.tasks.map((x) => (x.id === context.tempId ? normalizeTask(t) : x)),
          });
        }
      }
      invalidate();
    },
  });

  /** Mantém `concluida_em` coerente: a tarefa é concluída quando está na coluna de
   * entrega (status is_done) OU quando recebeu o tick (is_completed). A data registrada
   * é a da primeira conclusão; só é apagada quando nenhum dos dois vale mais. */
  const comDataDeConclusao = (patch: Partial<Task>, previous?: Task): Partial<Task> => {
    if (!previous || !("status" in patch || "is_completed" in patch)) return patch;
    const cache = qc.getQueryData<Awaited<ReturnType<typeof fetchWorkspace>>>(KEY);
    const doneKeys = (cache?.statuses ?? []).filter((s) => s.is_done).map((s) => s.chave);
    const concluida =
      doneKeys.includes(patch.status ?? previous.status) ||
      (patch.is_completed ?? previous.is_completed);
    if (!concluida) return { ...patch, concluida_em: null };
    return {
      ...patch,
      concluida_em: previous.concluida_em ?? patch.concluida_em ?? new Date().toISOString(),
    };
  };

  const updateTask = useMutation({
    mutationFn: async ({
      id,
      patch: patchOriginal,
      previous,
    }: {
      id: string;
      patch: Partial<Task>;
      previous?: Task;
    }) => {
      const patch = comDataDeConclusao(patchOriginal, previous);
      const safePatch =
        typeof patch.descricao === "string"
          ? { ...patch, descricao: sanitizeRichHtml(patch.descricao) }
          : patch;
      const { error } = await db.from("tasks").update(safePatch).eq("id", id);
      if (error) throw error;

      void (async () => {
        try {
          if (!previous) return;
          const autor = profile?.nome ?? "Alguém";
          const envolvidos = await participantes(id, [
            ...(patch.usuario_id ?? previous.usuario_id ?? []),
            previous.criador_id ?? "",
          ]);

          const titulo = patch.titulo ?? previous.titulo;

          if (patch.status && patch.status !== previous.status) {
            await log(id, `moveu para ${patch.status}`);
            const cache = qc.getQueryData<Awaited<ReturnType<typeof fetchWorkspace>>>(KEY);
            const statuses = cache?.statuses ?? [];
            const doneKeys = statuses.filter((s) => s.is_done).map((s) => s.chave);
            const labelDe = (chave: string) =>
              statuses.find((s) => s.chave === chave)?.label ??
              cache?.columns.find((c) => c.chave === chave)?.label ??
              chave;
            const entregou = doneKeys.includes(patch.status) && !doneKeys.includes(previous.status);
            if (entregou) {
              await notify(
                envolvidos,
                id,
                "entrega",
                "Tarefa entregue",
                `Tarefa "${titulo}" foi entregue por ${autor}.`,
              );
            } else {
              await notify(
                envolvidos,
                id,
                "status",
                "Status alterado",
                `Tarefa "${titulo}" foi movida para ${labelDe(patch.status)} por ${autor}.`,
              );
            }
          }

          // Tick de concluída (independente da coluna Entregue).
          if (patch.is_completed === true && !previous.is_completed) {
            await notify(
              envolvidos,
              id,
              "conclusao",
              "Tarefa concluída",
              `Tarefa "${titulo}" foi concluída por ${autor}.`,
            );
          }

          let novos: string[] = [];
          if (patch.usuario_id) {
            novos = patch.usuario_id.filter((u) => !previous.usuario_id.includes(u));
            await notify(
              novos,
              id,
              "atribuicao",
              "Você foi marcado em uma tarefa",
              `${autor} marcou você na tarefa "${titulo}".`,
            );
          }

          const mudou = (a: unknown, b: unknown) =>
            JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);

          // Datas: entrega, início ou período do evento.
          const camposData: Array<keyof Task> = ["data_vencimento", "data_inicio", "evento_inicio"];
          if (camposData.some((c) => c in patch && mudou(patch[c], previous[c]))) {
            await log(id, "alterou a data");
            const nova = patch.data_vencimento ?? previous.data_vencimento;
            const quando = nova ? ` para ${nova.slice(8, 10)}/${nova.slice(5, 7)}` : "";
            await notify(
              envolvidos.filter((u) => !novos.includes(u)),
              id,
              "data",
              "Data alterada",
              `A data da tarefa "${titulo}" foi atualizada${quando} por ${autor}.`,
            );
          }

          // Demais alterações: avisam todos os participantes com prioridade baixa.
          const campos: Array<[keyof Task, string]> = [
            ["titulo", "título"],
            ["descricao", "descrição"],
            ["tags", "tags"],
            ["anexos", "anexos"],
            ["prioridade", "prioridade"],
            ["area", "área"],
            ["solicitante", "solicitante"],
            ["versao", "versão"],
            ["subtarefas", "subtarefas"],
          ];
          const alterados = campos
            .filter(([campo]) => campo in patch && mudou(patch[campo], previous[campo]))
            .map(([, rotulo]) => rotulo);
          if (novos.length) alterados.push("responsáveis");

          if (alterados.length) {
            const lista =
              alterados.length === 1
                ? alterados[0]
                : `${alterados.slice(0, -1).join(", ")} e ${alterados[alterados.length - 1]}`;
            await log(id, `alterou ${lista}`);
            await notify(
              envolvidos.filter((u) => !novos.includes(u)),
              id,
              "atualizacao",
              "Tarefa atualizada",
              `${autor} alterou ${lista} na tarefa "${titulo}".`,
            );
          }
        } catch {
          /* efeitos secundários não bloqueiam a interface */
        }
      })();

      return id;
    },
    onMutate: async ({ id, patch: patchOriginal, previous }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const snapshot = qc.getQueryData<Awaited<ReturnType<typeof fetchWorkspace>>>(KEY);
      const patch = comDataDeConclusao(patchOriginal, previous);
      if (snapshot) {
        qc.setQueryData(KEY, {
          ...snapshot,
          tasks: snapshot.tasks.map((t) => (t.id === id ? normalizeTask({ ...t, ...patch }) : t)),
        });
      }
      return { snapshot };
    },
    onError: (error, _vars, context) => {
      if (context?.snapshot) qc.setQueryData(KEY, context.snapshot);
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a tarefa.");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      void qc.invalidateQueries({ queryKey: ["thc-activity"] });
    },
  });

  // Soft delete: a tarefa vai para a lixeira e é apagada de vez após 30 dias.
  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from("tasks")
        .update({ deletada_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /** Transforma a tarefa em uma série mensal: as próximas ocorrências são criadas já agora,
   * no mesmo dia de cada mês, como tarefas normais ligadas pela mesma serie_id. */
  const repeatTask = useMutation({
    mutationFn: async ({
      task,
      recorrencia,
      statusInicial,
    }: {
      task: Task;
      recorrencia: Exclude<Recorrencia, "nenhuma">;
      statusInicial: string;
    }) => {
      // "mensal" não tem fim: total = null e o banco cria as próximas ocorrências.
      const total = RECORRENCIAS.find((r) => r.id === recorrencia)?.meses ?? null;
      const serieId = crypto.randomUUID();
      const hoje = new Date().toISOString().slice(0, 10);
      const base = task.data_vencimento ?? task.data_inicio ?? hoje;
      const { error } = await db
        .from("tasks")
        .update({
          recorrencia,
          serie_id: serieId,
          serie_indice: 1,
          serie_total: total,
          serie_status_inicial: statusInicial,
          data_vencimento: base,
        })
        .eq("id", task.id);
      if (error) throw error;
      const copias = Array.from({ length: (total ?? 1) - 1 }, (_, i) => ({
        titulo: task.titulo,
        descricao: sanitizeRichHtml(task.descricao ?? ""),
        status: statusInicial,
        prioridade: task.prioridade,
        board_id: task.board_id,
        projeto_id: task.projeto_id,
        usuario_id: task.usuario_id,
        data_inicio: hoje,
        data_vencimento: addMesesISO(base, i + 1),
        tag: task.tag,
        cor_da_tag: task.cor_da_tag,
        tags: task.tags,
        anexos: task.anexos,
        is_master: task.is_master,
        subtarefas: task.subtarefas.map((st) => ({ ...st, id: crypto.randomUUID(), done: false })),
        criador_id: userId,
        ordem: task.ordem,
        versao: task.versao,
        area: task.area,
        solicitante: task.solicitante,
        recorrencia,
        serie_id: serieId,
        serie_indice: i + 2,
        serie_total: total,
        serie_status_inicial: statusInicial,
        ...(task.lembrete ? { lembrete: true } : {}),
      }));
      if (copias.length) {
        const { error: erroCopias } = await db.from("tasks").insert(copias);
        if (erroCopias) throw erroCopias;
      }
      if (total === null) {
        // Sem fim: o banco mantém sempre as ocorrências dos próximos 2 meses criadas.
        const { error: erroSerie } = await db.rpc("estender_series_mensais");
        if (erroSerie) throw erroSerie;
      }
      await log(
        task.id,
        total === null
          ? "definiu repetição todo mês, sem data para acabar"
          : `definiu repetição mensal por ${total} meses`,
      );
      return { total, serieId, base };
    },
    onSuccess: invalidate,
    onError: (error) => {
      invalidate();
      toast.error(error instanceof Error ? error.message : "Não foi possível repetir a tarefa.");
    },
  });

  // Exclui (lixeira) todas as ocorrências ainda ativas de uma série de repetição.
  const deleteSeries = useMutation({
    mutationFn: async (serieId: string) => {
      const { error } = await db
        .from("tasks")
        .update({ deletada_em: new Date().toISOString() })
        .eq("serie_id", serieId)
        .is("deletada_em", null);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const comment = useMutation({
    mutationFn: async ({
      taskId,
      body,
      mentions,
      taskTitle,
      anexos = [],
    }: {
      taskId: string;
      body: string;
      mentions: string[];
      taskTitle: string;
      anexos?: Anexo[];
    }) => {
      if (!userId) return;
      const { error } = await db.from("activity_logs").insert({
        task_id: taskId,
        user_id: userId,
        kind: "comment",
        body: sanitizeRichHtml(body),
        mentions,
        anexos,
      });
      if (error) throw error;

      // Mencionado vira responsável pela tarefa e passa a receber todas as notificações.
      if (mentions.length) {
        const { data: atual } = await db
          .from("tasks")
          .select("usuario_id")
          .eq("id", taskId)
          .maybeSingle();
        const atuais = (atual?.usuario_id ?? []) as string[];
        const novos = mentions.filter((m) => m && !atuais.includes(m));
        if (novos.length) {
          await db
            .from("tasks")
            .update({ usuario_id: [...atuais, ...novos] })
            .eq("id", taskId);
        }
      }

      const autor = profile?.nome ?? "Alguém";
      await notify(
        mentions,
        taskId,
        "mencao",
        "Você foi mencionado",
        `${autor} mencionou você nos comentários da tarefa "${taskTitle}".`,
      );

      // Demais participantes também acompanham a linha do tempo.
      const envolvidos = await participantes(taskId);
      await notify(
        envolvidos.filter((u) => !mentions.includes(u)),
        taskId,
        "comentario",
        "Novo comentário",
        `${autor} adicionou um comentário na tarefa "${taskTitle}".`,
      );
    },

    onSuccess: invalidate,
  });

  const updateComment = useMutation({
    mutationFn: async ({
      id,
      body,
      taskId,
      taskTitle,
    }: {
      id: string;
      body: string;
      taskId?: string | undefined;
      taskTitle?: string | undefined;
    }) => {
      const { error } = await db
        .from("activity_logs")
        .update({ body: sanitizeRichHtml(body), edited_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;

      if (taskId) {
        const envolvidos = await participantes(taskId);
        await notify(
          envolvidos,
          taskId,
          "comentario",
          "Comentário atualizado",
          `${profile?.nome ?? "Alguém"} atualizou um comentário em "${taskTitle ?? "uma tarefa"}".`,
        );
      }
    },
    onSuccess: invalidate,
  });

  const deleteComment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("activity_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const restoreTask = useMutation({
    mutationFn: async (id: string) => {
      // O .select() confirma que a linha mudou: sem permissão o banco não dá erro, só ignora.
      const { data, error } = await db
        .from("tasks")
        .update({ deletada_em: null })
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Você não tem permissão para restaurar esta tarefa.");
      let task = normalizeTask(data as unknown as Task);

      // A coluna da tarefa pode ter sido excluída enquanto ela estava na lixeira.
      // Sem coluna o card não aparece em nenhum quadro, então volta para a primeira.
      const cache = qc.getQueryData<Awaited<ReturnType<typeof fetchWorkspace>>>(KEY);
      if (cache && !isEventTask(task.status)) {
        const temColuna =
          cache.statuses.some((s) => s.chave === task.status) ||
          cache.columns.some(
            (c) =>
              c.chave === task.status &&
              (c.project_id === task.board_id || c.project_id === task.projeto_id),
          );
        const primeira = [...cache.statuses]
          .sort((a, b) => a.posicao - b.posicao)
          .find((s) => !s.is_done && !isEventTask(s.chave));
        if (!temColuna && primeira) {
          const { error: erroColuna } = await db
            .from("tasks")
            .update({ status: primeira.chave, concluida_em: null })
            .eq("id", id);
          if (!erroColuna) task = { ...task, status: primeira.chave, concluida_em: null };
        }
      }

      const doneKeys = (cache?.statuses ?? []).filter((s) => s.is_done).map((s) => s.chave);
      return { task, arquivada: isArquivada(task, doneKeys) };
    },
    onSuccess: () => {
      invalidate();
      void qc.invalidateQueries({ queryKey: ["thc-trash"] });
    },
  });

  const purgeTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      void qc.invalidateQueries({ queryKey: ["thc-trash"] });
    },
  });

  return {
    createTask,
    updateTask,
    deleteTask,
    deleteSeries,
    repeatTask,
    restoreTask,
    purgeTask,
    comment,
    updateComment,
    deleteComment,
  };
}

export function useActivity(taskId: string | null) {
  return useQuery({
    queryKey: ["thc-activity", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data } = await db
        .from("activity_logs")
        .select("*")
        .eq("task_id", taskId!)
        .order("created_at");
      return ((data ?? []) as unknown as ActivityLog[]).map((l) => ({
        ...l,
        anexos: Array.isArray(l.anexos) ? l.anexos : [],
        mentions: l.mentions ?? [],
      }));
    },
  });
}

export function useNotifications() {
  const qc = useQueryClient();
  const { userId } = useAuth();
  const query = useQuery({
    queryKey: ["thc-notifications", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await db
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(40);
      return (data ?? []) as AppNotification[];
    },
  });

  // Tempo real: novas notificações do usuário entram na lista sem recarregar a página.
  useEffect(() => {
    if (!userId) return;
    const filtro = { coluna: "user_id", valor: userId };
    const channel = db
      .canal()
      .escutar({ tabela: "notifications", evento: "INSERT", filtro }, (aviso) => {
        const nova = aviso.nova as AppNotification;
        qc.setQueryData<AppNotification[]>(["thc-notifications", userId], (old) => {
          const atual = old ?? [];
          if (atual.some((n) => n.id === nova.id)) return atual;
          return [nova, ...atual].slice(0, 40);
        });
      })
      .escutar({ tabela: "notifications", evento: "UPDATE", filtro }, (aviso) => {
        const upd = aviso.nova as AppNotification;
        qc.setQueryData<AppNotification[]>(["thc-notifications", userId], (old) =>
          (old ?? []).map((n) => (n.id === upd.id ? upd : n)),
        );
      })
      .iniciar();
    return () => {
      db.removerCanal(channel);
    };
  }, [qc, userId]);

  const markAllRead = async () => {
    if (!userId) return;
    await db.from("notifications").update({ lida: true }).eq("user_id", userId).eq("lida", false);
    void qc.invalidateQueries({ queryKey: ["thc-notifications"] });
  };

  return {
    items: query.data ?? [],
    unread: (query.data ?? []).filter((n) => !n.lida).length,
    markAllRead,
  };
}

/** Histórico completo de notificações do usuário (página dedicada). */
export function useNotificationHistory() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: ["thc-notifications-history", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await db
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(400);
      return (data ?? []) as AppNotification[];
    },
  });
}

/** Curtidas dos comentários de uma tarefa. */
export function useCommentLikes(taskId: string | null, logIds: string[]) {
  const qc = useQueryClient();
  const { userId, profile } = useAuth();

  const query = useQuery({
    queryKey: ["thc-likes", taskId],
    enabled: !!taskId && logIds.length > 0,
    queryFn: async () => {
      const { data } = await db
        .from("comment_likes")
        .select("log_id, user_id")
        .in("log_id", logIds);
      return (data ?? []) as { log_id: string; user_id: string }[];
    },
  });

  const likes = query.data ?? [];

  const toggle = async (log: ActivityLog, taskTitle: string) => {
    if (!userId) return;
    const jaCurtiu = likes.some((l) => l.log_id === log.id && l.user_id === userId);
    if (jaCurtiu) {
      await db.from("comment_likes").delete().eq("log_id", log.id).eq("user_id", userId);
    } else {
      const { error } = await db.from("comment_likes").insert({ log_id: log.id, user_id: userId });
      if (error) throw error;
      if (log.user_id && log.user_id !== userId) {
        await enviarNotificacao(
          [log.user_id],
          log.task_id,
          "curtida",
          "Curtiram seu comentário",
          `${profile?.nome ?? "Alguém"} curtiu seu comentário na tarefa "${taskTitle}".`,
          userId,
        );
      }
    }
    void qc.invalidateQueries({ queryKey: ["thc-likes", taskId] });
    void qc.invalidateQueries({ queryKey: ["thc-notifications"] });
  };

  return {
    countOf: (logId: string) => likes.filter((l) => l.log_id === logId).length,
    likedByMe: (logId: string) => likes.some((l) => l.log_id === logId && l.user_id === userId),
    toggle,
  };
}

const OPTIONS_KEY = ["thc-request-options"];

/** Áreas e solicitantes reutilizáveis, compartilhados pela equipe. */
export function useRequestOptions() {
  const qc = useQueryClient();
  const { userId } = useAuth();

  const query = useQuery({
    queryKey: OPTIONS_KEY,
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await db
        .from("request_options")
        .select("id, tipo, nome, created_by")
        .order("nome");
      return (data ?? []) as RequestOption[];
    },
  });

  const options = query.data ?? [];
  const invalidate = () => qc.invalidateQueries({ queryKey: OPTIONS_KEY });

  const listOf = (tipo: RequestOptionTipo) => options.filter((o) => o.tipo === tipo);

  const create = async (tipo: RequestOptionTipo, nomeBruto: string) => {
    const nome = nomeBruto.trim();
    if (!nome || !userId) return null;
    const existente = listOf(tipo).find((o) => o.nome.trim().toLowerCase() === nome.toLowerCase());
    if (existente) return existente.nome;
    const { error } = await db.from("request_options").insert({ tipo, nome, created_by: userId });
    if (error) {
      toast.error("Não foi possível salvar o nome.");
      return null;
    }
    await invalidate();
    return nome;
  };

  const remove = async (id: string) => {
    const { error } = await db.from("request_options").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível excluir o nome.");
      return;
    }
    await invalidate();
  };

  return { options, listOf, create, remove };
}

/** Tarefas na lixeira (últimos 30 dias). Gestor vê todas; membro vê as suas. */
export function useTrash() {
  const { userId, isGestor } = useAuth();
  return useQuery({
    queryKey: ["thc-trash", userId, isGestor],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await db
        .from("tasks")
        .select("*")
        .not("deletada_em", "is", null)
        .order("deletada_em", { ascending: false });
      if (error) throw error;
      const todas = ((data ?? []) as unknown as Task[]).map(normalizeTask);
      if (isGestor) return todas;
      // Dono do quadro também pode excluir e restaurar as tarefas dele.
      const { data: meus } = await db
        .from("projects")
        .select("id")
        .eq("owner_id", userId ?? "");
      const meusQuadros = new Set((meus ?? []).map((p) => p.id as string));
      return todas.filter(
        (t) =>
          t.criador_id === userId ||
          (t.usuario_id ?? []).includes(userId ?? "") ||
          (!!t.board_id && meusQuadros.has(t.board_id)) ||
          (!!t.projeto_id && meusQuadros.has(t.projeto_id)),
      );
    },
  });
}
