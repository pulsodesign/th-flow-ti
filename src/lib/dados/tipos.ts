// Arquivo gerado por scripts/gerar-tipos.mjs a partir do banco. Não edite à mão.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Enums = {
  app_role: "gestor" | "membro";
  project_kind: "mae" | "departamento" | "individual";
};

export type Tabelas = {
  activity_logs: {
    id: string;
    task_id: string | null;
    user_id: string | null;
    kind: string;
    body: string;
    mentions: string[];
    created_at: string;
    anexos: Json;
    edited_at: string | null;
  };
  app_config: {
    chave: string;
    valor: Json;
    created_at: string;
  };
  board_status_order: {
    project_id: string;
    status_chave: string;
    posicao: number;
    created_at: string;
    updated_at: string;
  };
  comment_likes: {
    id: string;
    log_id: string;
    user_id: string;
    created_at: string;
  };
  estoque_comentarios: {
    id: string;
    item_id: string;
    user_id: string | null;
    body: string;
    mentions: string[] | null;
    created_at: string;
  };
  estoque_itens: {
    id: string;
    nome: string;
    foto_url: string | null;
    cor: string | null;
    tem_variacao_tamanho: boolean;
    quantidade: number | null;
    created_by: string | null;
    created_at: string;
    locais: string[];
    deletado_em: string | null;
  };
  estoque_movimentacoes: {
    id: string;
    item_id: string;
    variacao_id: string | null;
    tipo: string;
    quantidade: number;
    observacao: string | null;
    user_id: string | null;
    created_at: string;
  };
  estoque_variacoes: {
    id: string;
    item_id: string;
    tamanho: string;
    quantidade: number;
  };
  notification_prefs: {
    user_id: string;
    email_ativo: boolean;
    email_tipos: string[];
    updated_at: string;
  };
  notifications: {
    id: string;
    user_id: string;
    task_id: string | null;
    tipo: string;
    titulo: string;
    body: string;
    lida: boolean;
    created_at: string;
    nivel: string;
    entrega_pendente: boolean;
  };
  personal_notes: {
    id: string;
    user_id: string;
    title: string;
    content: string;
    is_pinned: boolean;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  };
  profiles: {
    id: string;
    nome: string;
    cargo: string;
    foto_perfil: string | null;
    cor: string;
    created_at: string;
    updated_at: string;
  };
  project_columns: {
    id: string;
    project_id: string;
    chave: string;
    label: string;
    cor: string;
    posicao: number;
    created_at: string;
  };
  projects: {
    id: string;
    nome: string;
    kind: Enums["project_kind"];
    descricao: string;
    icon: string;
    owner_id: string | null;
    posicao: number;
    created_at: string;
    updated_at: string;
    responsaveis_padrao: string[];
  };
  push_subscriptions: {
    id: string;
    user_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    aparelho: string | null;
    created_at: string;
  };
  request_options: {
    id: string;
    tipo: string;
    nome: string;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  };
  statuses: {
    id: string;
    chave: string;
    label: string;
    cor: string;
    posicao: number;
    is_done: boolean;
    created_at: string;
    updated_at: string;
  };
  tasks: {
    id: string;
    projeto_id: string | null;
    board_id: string | null;
    usuario_id: string[];
    titulo: string;
    descricao: string;
    status: string;
    prioridade: string;
    data_inicio: string | null;
    data_vencimento: string | null;
    tag: string | null;
    cor_da_tag: string | null;
    is_master: boolean;
    subtarefas: Json;
    criador_id: string | null;
    concluida_em: string | null;
    ordem: number;
    created_at: string;
    updated_at: string;
    tags: Json;
    anexos: Json;
    versao: number | null;
    area: string | null;
    solicitante: string | null;
    deletada_em: string | null;
    is_completed: boolean;
    evento_inicio: string | null;
    recorrencia: string;
    serie_id: string | null;
    serie_indice: number | null;
    serie_total: number | null;
    serie_status_inicial: string | null;
    lembrete: boolean;
  };
  user_board_column_order: {
    id: string;
    user_id: string;
    project_id: string;
    column_chave: string;
    posicao: number;
    created_at: string;
    updated_at: string;
  };
  user_emails: {
    user_id: string;
    email: string;
    updated_at: string;
  };
  user_project_order: {
    id: string;
    user_id: string;
    project_id: string;
    posicao: number;
    created_at: string;
    updated_at: string;
  };
  user_roles: {
    id: string;
    user_id: string;
    role: Enums["app_role"];
    created_at: string;
  };
};

export type NomeTabela = keyof Tabelas;
