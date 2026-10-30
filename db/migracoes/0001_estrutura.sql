-- TH Flow: estrutura completa do banco (PostgreSQL 15 ou mais recente).
--
-- Modelo de acesso:
--   * O app conecta com um único usuário (o dono das tabelas). Rotinas internas
--     do servidor (convites, lembretes, envio de e-mails) rodam com esse usuário.
--   * Toda consulta feita em nome de uma pessoa logada roda dentro de uma
--     transação com `SET LOCAL ROLE thflow_usuario` e `app.user_id` definido.
--     As políticas de Row Level Security (RLS) abaixo valem para esse papel.

-- ---------------------------------------------------------------------------
-- Papel usado nas consultas feitas em nome dos usuários
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'thflow_usuario') THEN
    CREATE ROLE thflow_usuario NOLOGIN NOINHERIT;
  END IF;
END $$;
GRANT thflow_usuario TO CURRENT_USER;

-- ---------------------------------------------------------------------------
-- Schema "app": autenticação, sessões e arquivos (acesso só pelo servidor)
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS app;
REVOKE ALL ON SCHEMA app FROM PUBLIC;
GRANT USAGE ON SCHEMA app TO thflow_usuario;

-- Usuário logado na transação atual (definido pelo servidor a cada requisição).
CREATE OR REPLACE FUNCTION app.usuario_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
REVOKE ALL ON FUNCTION app.usuario_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.usuario_id() TO thflow_usuario;

CREATE TABLE app.usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  senha_hash text,
  metadados jsonb NOT NULL DEFAULT '{}'::jsonb,
  email_confirmado_em timestamptz,
  ultimo_login_em timestamptz,
  bloqueado_ate timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX usuarios_email_uniq ON app.usuarios (lower(email));

-- Sessões de login. Só o hash SHA-256 do token fica no banco.
CREATE TABLE app.sessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES app.usuarios(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expira_em timestamptz NOT NULL,
  ultimo_uso_em timestamptz NOT NULL DEFAULT now(),
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessoes_usuario_idx ON app.sessoes (usuario_id);
CREATE INDEX sessoes_expira_idx ON app.sessoes (expira_em);

-- Links de uso único enviados por e-mail (convite, redefinição de senha, troca de e-mail).
CREATE TABLE app.tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES app.usuarios(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('convite', 'recuperacao', 'troca_email')),
  token_hash text NOT NULL UNIQUE,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  expira_em timestamptz NOT NULL,
  usado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tokens_usuario_idx ON app.tokens (usuario_id, tipo);

-- Tentativas de login e envios de e-mail, para limitar abuso (força bruta).
CREATE TABLE app.tentativas (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  acao text NOT NULL,
  chave text NOT NULL,
  sucesso boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tentativas_busca_idx ON app.tentativas (acao, chave, created_at DESC);

-- Registro de eventos de segurança (login, falhas, troca de senha, convites).
CREATE TABLE app.auditoria (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id uuid,
  evento text NOT NULL,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auditoria_data_idx ON app.auditoria (created_at DESC);

-- Arquivos enviados (anexos de tarefas e comentários).
CREATE TABLE app.arquivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caminho text NOT NULL UNIQUE,
  dono_id uuid REFERENCES app.usuarios(id) ON DELETE SET NULL,
  tipo text NOT NULL DEFAULT 'application/octet-stream',
  tamanho integer NOT NULL,
  conteudo bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX arquivos_dono_idx ON app.arquivos (dono_id);

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
CREATE TYPE public.app_role AS ENUM ('gestor', 'membro');
CREATE TYPE public.project_kind AS ENUM ('mae', 'departamento', 'individual');

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
CREATE TABLE public.app_config (
  chave text PRIMARY KEY,
  valor jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES app.usuarios(id) ON DELETE CASCADE,
  nome text NOT NULL DEFAULT '',
  cargo text NOT NULL DEFAULT 'Membro',
  foto_perfil text,
  cor text NOT NULL DEFAULT 'oklch(0.6 0.14 259)',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app.usuarios(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'membro',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role)
);

CREATE TABLE public.user_emails (
  user_id uuid PRIMARY KEY,
  email text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  kind public.project_kind NOT NULL DEFAULT 'departamento',
  descricao text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT 'Folder',
  owner_id uuid REFERENCES app.usuarios(id) ON DELETE CASCADE,
  posicao integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  responsaveis_padrao uuid[] NOT NULL DEFAULT '{}'::uuid[]
);

CREATE TABLE public.statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL,
  label text NOT NULL,
  cor text NOT NULL DEFAULT 'oklch(0.68 0.017 260)',
  posicao integer NOT NULL DEFAULT 0,
  is_done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT statuses_chave_key UNIQUE (chave)
);

CREATE TABLE public.project_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  chave text NOT NULL,
  label text NOT NULL,
  cor text NOT NULL DEFAULT 'oklch(0.66 0.09 300)',
  posicao integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_columns_project_id_chave_key UNIQUE (project_id, chave)
);

CREATE TABLE public.board_status_order (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status_chave text NOT NULL REFERENCES public.statuses(chave) ON UPDATE CASCADE ON DELETE CASCADE,
  posicao integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, status_chave)
);

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  board_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  usuario_id uuid[] NOT NULL DEFAULT '{}'::uuid[],
  titulo text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'backlog',
  prioridade text NOT NULL DEFAULT 'media',
  data_inicio date,
  data_vencimento date,
  tag text,
  cor_da_tag text,
  is_master boolean NOT NULL DEFAULT false,
  subtarefas jsonb NOT NULL DEFAULT '[]'::jsonb,
  criador_id uuid REFERENCES app.usuarios(id) ON DELETE SET NULL,
  concluida_em timestamptz,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  anexos jsonb NOT NULL DEFAULT '[]'::jsonb,
  versao smallint,
  area text,
  solicitante text,
  deletada_em timestamptz,
  is_completed boolean NOT NULL DEFAULT false,
  evento_inicio date,
  recorrencia text NOT NULL DEFAULT 'nenhuma',
  serie_id uuid,
  serie_indice integer,
  serie_total integer,
  serie_status_inicial text,
  lembrete boolean NOT NULL DEFAULT false,
  CONSTRAINT tasks_recorrencia_check CHECK (recorrencia = ANY (ARRAY['nenhuma', 'mensal', 'mensal_3', 'mensal_6'])),
  CONSTRAINT tasks_versao_check CHECK (versao IS NULL OR (versao >= 1 AND versao <= 6))
);
CREATE INDEX tasks_lembrete_idx ON public.tasks (data_vencimento) WHERE (lembrete AND deletada_em IS NULL);
CREATE INDEX idx_tasks_deletada_em ON public.tasks (deletada_em);
CREATE INDEX tasks_serie_id_idx ON public.tasks (serie_id) WHERE serie_id IS NOT NULL;
CREATE INDEX idx_tasks_projeto ON public.tasks (projeto_id);
CREATE INDEX idx_tasks_board ON public.tasks (board_id);
CREATE INDEX idx_tasks_usuarios ON public.tasks USING gin (usuario_id);

CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES app.usuarios(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'event',
  body text NOT NULL DEFAULT '',
  mentions uuid[] NOT NULL DEFAULT '{}'::uuid[],
  created_at timestamptz NOT NULL DEFAULT now(),
  anexos jsonb NOT NULL DEFAULT '[]'::jsonb,
  edited_at timestamptz
);
CREATE INDEX idx_activity_task ON public.activity_logs (task_id);

CREATE TABLE public.comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id uuid NOT NULL REFERENCES public.activity_logs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app.usuarios(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comment_likes_log_id_user_id_key UNIQUE (log_id, user_id)
);
CREATE INDEX comment_likes_log_idx ON public.comment_likes (log_id);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app.usuarios(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'mencao',
  titulo text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  lida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  nivel text NOT NULL DEFAULT 'media',
  entrega_pendente boolean NOT NULL DEFAULT false,
  CONSTRAINT notifications_nivel_check CHECK (nivel = ANY (ARRAY['alta', 'media', 'baixa']))
);
CREATE INDEX idx_notifications_user ON public.notifications (user_id, lida);
CREATE INDEX notifications_entrega_pendente_idx ON public.notifications (created_at) WHERE entrega_pendente;

CREATE TABLE public.notification_prefs (
  user_id uuid PRIMARY KEY REFERENCES app.usuarios(id) ON DELETE CASCADE,
  email_ativo boolean NOT NULL DEFAULT true,
  email_tipos text[] NOT NULL DEFAULT ARRAY['lembrete', 'atribuicao', 'mencao', 'comentario', 'status', 'conclusao', 'entrega', 'data', 'atualizacao', 'curtida'],
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app.usuarios(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  aparelho text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint)
);
CREATE INDEX push_subscriptions_user_idx ON public.push_subscriptions (user_id);

CREATE TABLE public.personal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app.usuarios(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  is_pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX personal_notes_user_deleted_idx ON public.personal_notes (user_id, deleted_at);

CREATE TABLE public.request_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  nome text NOT NULL,
  created_by uuid REFERENCES app.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT request_options_tipo_check CHECK (tipo = ANY (ARRAY['area', 'solicitante']))
);
CREATE UNIQUE INDEX request_options_tipo_nome_uniq ON public.request_options (tipo, lower(btrim(nome)));

CREATE TABLE public.user_board_column_order (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app.usuarios(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  column_chave text NOT NULL,
  posicao integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_board_column_order_user_id_project_id_column_chave_key UNIQUE (user_id, project_id, column_chave)
);
CREATE INDEX idx_ubco_user_project ON public.user_board_column_order (user_id, project_id);

CREATE TABLE public.user_project_order (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app.usuarios(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  posicao integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_project_order_user_id_project_id_key UNIQUE (user_id, project_id)
);

CREATE TABLE public.estoque_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  foto_url text,
  cor text,
  tem_variacao_tamanho boolean NOT NULL DEFAULT false,
  quantidade integer DEFAULT 0,
  created_by uuid REFERENCES app.usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  locais text[] NOT NULL DEFAULT '{}'::text[],
  deletado_em timestamptz
);

CREATE TABLE public.estoque_variacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.estoque_itens(id) ON DELETE CASCADE,
  tamanho text NOT NULL,
  quantidade integer NOT NULL DEFAULT 0,
  CONSTRAINT estoque_variacoes_item_id_tamanho_key UNIQUE (item_id, tamanho),
  CONSTRAINT estoque_variacoes_tamanho_check CHECK (tamanho = ANY (ARRAY['P', 'M', 'G', 'GG', 'EG', 'EGG']))
);

CREATE TABLE public.estoque_movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.estoque_itens(id) ON DELETE CASCADE,
  variacao_id uuid REFERENCES public.estoque_variacoes(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  quantidade integer NOT NULL,
  observacao text,
  user_id uuid REFERENCES app.usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT estoque_movimentacoes_tipo_check CHECK (tipo = ANY (ARRAY['entrada', 'saida']))
);

CREATE TABLE public.estoque_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.estoque_itens(id) ON DELETE CASCADE,
  user_id uuid REFERENCES app.usuarios(id),
  body text NOT NULL,
  mentions uuid[] DEFAULT '{}'::uuid[],
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Funções
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.validate_task_tags()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $$
BEGIN
  IF jsonb_typeof(NEW.tags) <> 'array' THEN
    RAISE EXCEPTION 'tags deve ser uma lista';
  END IF;
  IF jsonb_array_length(NEW.tags) > 5 THEN
    RAISE EXCEPTION 'no máximo 5 tags por tarefa';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_gestor()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = app.usuario_id() AND role = 'gestor'::public.app_role
  )
$$;

CREATE OR REPLACE FUNCTION public.tem_papel(_user_id uuid, _role public.app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Cria perfil, e-mail e papel de cada usuário novo.
CREATE OR REPLACE FUNCTION public.criar_perfil_do_usuario()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, cargo)
  VALUES (
    NEW.id,
    COALESCE(NEW.metadados->>'nome', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.metadados->>'cargo', 'Membro')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_emails (user_id, email)
  VALUES (NEW.id, COALESCE(NEW.email, ''))
  ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE(NULLIF(NEW.metadados->>'nivel_acesso', ''), 'membro')::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_movimentacao_estoque(_item_id uuid, _variacao_id uuid, _tipo text, _quantidade integer, _observacao text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $$
declare
  _atual integer;
  _delta integer;
begin
  if _quantidade is null or _quantidade <= 0 then
    raise exception 'Quantidade deve ser maior que zero';
  end if;
  _delta := case when _tipo = 'saida' then -_quantidade else _quantidade end;

  if _variacao_id is not null then
    select quantidade into _atual from public.estoque_variacoes where id = _variacao_id for update;
    if _atual is null then raise exception 'Variação não encontrada'; end if;
    if _atual + _delta < 0 then raise exception 'Estoque insuficiente'; end if;
    update public.estoque_variacoes set quantidade = _atual + _delta where id = _variacao_id;
  else
    select coalesce(quantidade, 0) into _atual from public.estoque_itens where id = _item_id for update;
    if _atual is null then raise exception 'Item não encontrado'; end if;
    if _atual + _delta < 0 then raise exception 'Estoque insuficiente'; end if;
    update public.estoque_itens set quantidade = _atual + _delta where id = _item_id;
  end if;

  insert into public.estoque_movimentacoes (item_id, variacao_id, tipo, quantidade, observacao, user_id)
  values (_item_id, _variacao_id, _tipo, _quantidade, _observacao, app.usuario_id());
end;
$$;

-- Rotina diária: conclui eventos cuja data já passou.
CREATE OR REPLACE FUNCTION public.concluir_eventos_vencidos()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE n integer;
BEGIN
  UPDATE public.tasks
     SET concluida_em = now(), is_completed = true
   WHERE status = 'evento' AND concluida_em IS NULL AND deletada_em IS NULL
     AND COALESCE(data_vencimento, evento_inicio) IS NOT NULL
     AND COALESCE(data_vencimento, evento_inicio) < (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END; $$;

-- Rotina diária: cria as próximas ocorrências das tarefas mensais.
CREATE OR REPLACE FUNCTION public.estender_series_mensais()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  ultima public.tasks%ROWTYPE;
  serie uuid;
  base date;
  proxima date;
  limite date := ((now() AT TIME ZONE 'America/Sao_Paulo')::date + interval '2 months')::date;
  n integer := 0;
BEGIN
  FOR serie IN
    SELECT DISTINCT t.serie_id FROM public.tasks t
     WHERE t.recorrencia = 'mensal' AND t.serie_id IS NOT NULL AND t.deletada_em IS NULL
  LOOP
    -- A ocorrência de maior índice (mesmo que só ela tenha sido excluída) é o modelo.
    SELECT * INTO ultima FROM public.tasks
     WHERE serie_id = serie ORDER BY serie_indice DESC NULLS LAST LIMIT 1;
    -- O dia original da série vem da primeira ocorrência.
    SELECT data_vencimento INTO base FROM public.tasks
     WHERE serie_id = serie AND serie_indice = 1 LIMIT 1;
    base := COALESCE(base, ultima.data_vencimento);
    IF base IS NULL THEN CONTINUE; END IF;

    LOOP
      proxima := (base + make_interval(months => ultima.serie_indice))::date;
      EXIT WHEN proxima > limite;
      INSERT INTO public.tasks (
        titulo, descricao, status, prioridade, board_id, projeto_id, usuario_id,
        data_inicio, data_vencimento, tag, cor_da_tag, tags, anexos, is_master,
        subtarefas, criador_id, ordem, versao, area, solicitante,
        recorrencia, serie_id, serie_indice, serie_total, serie_status_inicial, lembrete
      ) VALUES (
        ultima.titulo, ultima.descricao,
        COALESCE(ultima.serie_status_inicial, 'backlog'),
        ultima.prioridade, ultima.board_id, ultima.projeto_id, ultima.usuario_id,
        (now() AT TIME ZONE 'America/Sao_Paulo')::date, proxima,
        ultima.tag, ultima.cor_da_tag, ultima.tags, ultima.anexos, ultima.is_master,
        COALESCE((
          SELECT jsonb_agg(jsonb_set(jsonb_set(s, '{done}', 'false'::jsonb), '{id}', to_jsonb(gen_random_uuid()::text)))
            FROM jsonb_array_elements(ultima.subtarefas) s
        ), '[]'::jsonb),
        ultima.criador_id, ultima.ordem, ultima.versao, ultima.area, ultima.solicitante,
        'mensal', serie, ultima.serie_indice + 1, NULL, ultima.serie_status_inicial, ultima.lembrete
      ) RETURNING * INTO ultima;
      n := n + 1;
    END LOOP;
  END LOOP;
  RETURN n;
END; $$;

-- Rotina diária (9h): cria as notificações de lembrete do dia no sino.
-- O envio de push e e-mail é feito pelo servidor do app logo em seguida.
CREATE OR REPLACE FUNCTION public.criar_lembretes_do_dia()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  inicio_do_dia timestamptz := (hoje::timestamp AT TIME ZONE 'America/Sao_Paulo');
  n integer;
BEGIN
  INSERT INTO public.notifications (user_id, task_id, tipo, titulo, body, nivel, entrega_pendente)
  SELECT d.user_id, t.id, 'lembrete', 'Lembrete de tarefa',
         'Hoje é o dia da tarefa "' || t.titulo || '".', 'alta', true
    FROM public.tasks t
    CROSS JOIN LATERAL (
      SELECT DISTINCT u AS user_id
        FROM unnest(
          CASE WHEN cardinality(t.usuario_id) > 0 THEN t.usuario_id
               ELSE ARRAY[t.criador_id] END
        ) u
       WHERE u IS NOT NULL
    ) d
    WHERE t.lembrete
     AND t.deletada_em IS NULL
     AND NOT t.is_completed
     AND NOT EXISTS (SELECT 1 FROM public.statuses s WHERE s.chave = t.status AND s.is_done)
     AND CASE WHEN t.status = 'evento' THEN COALESCE(t.evento_inicio, t.data_vencimento)
              ELSE t.data_vencimento END = hoje
     AND EXISTS (SELECT 1 FROM app.usuarios au WHERE au.id = d.user_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.notifications n
         WHERE n.task_id = t.id AND n.user_id = d.user_id
          AND n.tipo = 'lembrete' AND n.created_at >= inicio_do_dia
     );
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END; $$;

-- Avisa o servidor do app sobre mudanças, para atualizar as telas em tempo real.
-- Só a tabela e o tipo de mudança são enviados; as notificações levam a linha,
-- que o servidor entrega apenas ao próprio destinatário.
CREATE OR REPLACE FUNCTION app.notificar_mudanca()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
DECLARE
  linha jsonb := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  carga jsonb := jsonb_build_object('tabela', TG_TABLE_NAME, 'evento', TG_OP);
BEGIN
  IF TG_TABLE_NAME = 'notifications' THEN
    carga := carga || jsonb_build_object('user_id', linha->>'user_id', 'linha', linha);
    IF octet_length(carga::text) > 7900 THEN
      carga := carga - 'linha';
    END IF;
  END IF;
  PERFORM pg_notify('thflow_mudancas', carga::text);
  RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- Gatilhos
-- ---------------------------------------------------------------------------
CREATE TRIGGER on_usuario_criado AFTER INSERT ON app.usuarios FOR EACH ROW EXECUTE FUNCTION public.criar_perfil_do_usuario();
CREATE TRIGGER trg_usuarios_updated BEFORE UPDATE ON app.usuarios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_statuses_updated BEFORE UPDATE ON public.statuses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tasks_tags BEFORE INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.validate_task_tags();
CREATE TRIGGER trg_request_options_updated BEFORE UPDATE ON public.request_options FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_board_status_order_updated BEFORE UPDATE ON public.board_status_order FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ubco_updated BEFORE UPDATE ON public.user_board_column_order FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_upo_updated BEFORE UPDATE ON public.user_project_order FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_personal_notes_updated BEFORE UPDATE ON public.personal_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER tempo_real AFTER INSERT OR UPDATE OR DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION app.notificar_mudanca();
CREATE TRIGGER tempo_real AFTER INSERT OR UPDATE OR DELETE ON public.projects FOR EACH ROW EXECUTE FUNCTION app.notificar_mudanca();
CREATE TRIGGER tempo_real AFTER INSERT OR UPDATE OR DELETE ON public.statuses FOR EACH ROW EXECUTE FUNCTION app.notificar_mudanca();
CREATE TRIGGER tempo_real AFTER INSERT OR UPDATE OR DELETE ON public.project_columns FOR EACH ROW EXECUTE FUNCTION app.notificar_mudanca();
CREATE TRIGGER tempo_real AFTER INSERT OR UPDATE OR DELETE ON public.tasks FOR EACH ROW EXECUTE FUNCTION app.notificar_mudanca();
CREATE TRIGGER tempo_real AFTER INSERT OR UPDATE OR DELETE ON public.activity_logs FOR EACH ROW EXECUTE FUNCTION app.notificar_mudanca();
CREATE TRIGGER tempo_real AFTER INSERT OR UPDATE OR DELETE ON public.notifications FOR EACH ROW EXECUTE FUNCTION app.notificar_mudanca();
CREATE TRIGGER tempo_real AFTER INSERT OR UPDATE OR DELETE ON public.board_status_order FOR EACH ROW EXECUTE FUNCTION app.notificar_mudanca();

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA app FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO thflow_usuario;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO thflow_usuario;
REVOKE ALL ON public.app_config FROM thflow_usuario;
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM thflow_usuario;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_gestor() TO thflow_usuario;
GRANT EXECUTE ON FUNCTION public.estender_series_mensais() TO thflow_usuario;
GRANT EXECUTE ON FUNCTION public.registrar_movimentacao_estoque(uuid, uuid, text, integer, text) TO thflow_usuario;
GRANT EXECUTE ON FUNCTION public.validate_task_tags() TO thflow_usuario;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO thflow_usuario;
REVOKE ALL ON FUNCTION app.notificar_mudanca() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.notificar_mudanca() TO thflow_usuario;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_status_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_comentarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_variacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_board_column_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_project_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY activity_delete_own_or_gestor ON public.activity_logs FOR DELETE TO thflow_usuario
  USING (user_id = app.usuario_id() OR is_gestor());
CREATE POLICY activity_insert_authenticated ON public.activity_logs FOR INSERT TO thflow_usuario
  WITH CHECK (user_id = app.usuario_id());
CREATE POLICY activity_select_related ON public.activity_logs FOR SELECT TO thflow_usuario
  USING (is_gestor() OR user_id = app.usuario_id() OR app.usuario_id() = ANY (mentions) OR EXISTS (
    SELECT 1 FROM tasks t
     WHERE t.id = activity_logs.task_id AND (t.criador_id = app.usuario_id() OR app.usuario_id() = ANY (t.usuario_id) OR EXISTS (
       SELECT 1 FROM projects p WHERE p.id = ANY (ARRAY[t.projeto_id, t.board_id]) AND p.owner_id = app.usuario_id()))));
CREATE POLICY activity_update_own ON public.activity_logs FOR UPDATE TO thflow_usuario
  USING (user_id = app.usuario_id())
  WITH CHECK (user_id = app.usuario_id());

CREATE POLICY board_status_order_select_authenticated ON public.board_status_order FOR SELECT TO thflow_usuario
  USING (true);
CREATE POLICY board_status_order_write_owner_or_gestor ON public.board_status_order FOR ALL TO thflow_usuario
  USING (is_gestor() OR EXISTS (SELECT 1 FROM projects p WHERE p.id = board_status_order.project_id AND p.owner_id = app.usuario_id()))
  WITH CHECK (is_gestor() OR EXISTS (SELECT 1 FROM projects p WHERE p.id = board_status_order.project_id AND p.owner_id = app.usuario_id()));

CREATE POLICY comment_likes_delete_own ON public.comment_likes FOR DELETE TO thflow_usuario
  USING (user_id = app.usuario_id());
CREATE POLICY comment_likes_insert_own ON public.comment_likes FOR INSERT TO thflow_usuario
  WITH CHECK (user_id = app.usuario_id());
CREATE POLICY comment_likes_select_related ON public.comment_likes FOR SELECT TO thflow_usuario
  USING (user_id = app.usuario_id() OR is_gestor() OR EXISTS (
    SELECT 1 FROM activity_logs l
     WHERE l.id = comment_likes.log_id AND (l.user_id = app.usuario_id() OR app.usuario_id() = ANY (l.mentions) OR EXISTS (
       SELECT 1 FROM tasks t
        WHERE t.id = l.task_id AND (t.criador_id = app.usuario_id() OR app.usuario_id() = ANY (t.usuario_id) OR EXISTS (
          SELECT 1 FROM projects p WHERE p.id = ANY (ARRAY[t.projeto_id, t.board_id]) AND p.owner_id = app.usuario_id()))))));

CREATE POLICY estoque_coment_delete_own_or_gestor ON public.estoque_comentarios FOR DELETE TO thflow_usuario
  USING (user_id = app.usuario_id() OR is_gestor());
CREATE POLICY estoque_coment_insert_own ON public.estoque_comentarios FOR INSERT TO thflow_usuario
  WITH CHECK (user_id = app.usuario_id());
CREATE POLICY estoque_coment_select ON public.estoque_comentarios FOR SELECT TO thflow_usuario
  USING (true);
CREATE POLICY estoque_coment_update_own ON public.estoque_comentarios FOR UPDATE TO thflow_usuario
  USING (user_id = app.usuario_id())
  WITH CHECK (user_id = app.usuario_id());

CREATE POLICY estoque_itens_all_auth ON public.estoque_itens FOR ALL TO thflow_usuario
  USING (true) WITH CHECK (true);

CREATE POLICY estoque_mov_delete_gestor ON public.estoque_movimentacoes FOR DELETE TO thflow_usuario
  USING (is_gestor());
CREATE POLICY estoque_mov_insert_own ON public.estoque_movimentacoes FOR INSERT TO thflow_usuario
  WITH CHECK (user_id = app.usuario_id());
CREATE POLICY estoque_mov_select ON public.estoque_movimentacoes FOR SELECT TO thflow_usuario
  USING (true);
CREATE POLICY estoque_mov_update_gestor ON public.estoque_movimentacoes FOR UPDATE TO thflow_usuario
  USING (is_gestor()) WITH CHECK (is_gestor());

CREATE POLICY estoque_variacoes_all_auth ON public.estoque_variacoes FOR ALL TO thflow_usuario
  USING (true) WITH CHECK (true);

CREATE POLICY notification_prefs_own ON public.notification_prefs FOR ALL TO thflow_usuario
  USING (user_id = app.usuario_id())
  WITH CHECK (user_id = app.usuario_id());

CREATE POLICY notifications_delete_own ON public.notifications FOR DELETE TO thflow_usuario
  USING (user_id = app.usuario_id());
CREATE POLICY notifications_insert_authenticated ON public.notifications FOR INSERT TO thflow_usuario
  WITH CHECK (user_id = app.usuario_id() OR is_gestor() OR (task_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM tasks t
     WHERE t.id = notifications.task_id AND (t.criador_id = app.usuario_id() OR app.usuario_id() = ANY (t.usuario_id) OR EXISTS (
       SELECT 1 FROM projects p WHERE p.id = ANY (ARRAY[t.projeto_id, t.board_id]) AND p.owner_id = app.usuario_id())))));
CREATE POLICY notifications_select_own ON public.notifications FOR SELECT TO thflow_usuario
  USING (user_id = app.usuario_id());
CREATE POLICY notifications_update_own ON public.notifications FOR UPDATE TO thflow_usuario
  USING (user_id = app.usuario_id())
  WITH CHECK (user_id = app.usuario_id());

CREATE POLICY notes_delete_own ON public.personal_notes FOR DELETE TO thflow_usuario
  USING (user_id = app.usuario_id());
CREATE POLICY notes_insert_own ON public.personal_notes FOR INSERT TO thflow_usuario
  WITH CHECK (user_id = app.usuario_id());
CREATE POLICY notes_select_own ON public.personal_notes FOR SELECT TO thflow_usuario
  USING (user_id = app.usuario_id());
CREATE POLICY notes_update_own ON public.personal_notes FOR UPDATE TO thflow_usuario
  USING (user_id = app.usuario_id())
  WITH CHECK (user_id = app.usuario_id());

CREATE POLICY profiles_delete_gestor ON public.profiles FOR DELETE TO thflow_usuario
  USING (is_gestor());
CREATE POLICY profiles_insert_self_or_gestor ON public.profiles FOR INSERT TO thflow_usuario
  WITH CHECK (id = app.usuario_id() OR is_gestor());
CREATE POLICY profiles_select_authenticated ON public.profiles FOR SELECT TO thflow_usuario
  USING (id = app.usuario_id() OR is_gestor()
    OR EXISTS (SELECT 1 FROM tasks t WHERE t.criador_id = profiles.id OR profiles.id = ANY (t.usuario_id))
    OR EXISTS (SELECT 1 FROM projects p WHERE p.owner_id = profiles.id));
CREATE POLICY profiles_update_self_or_gestor ON public.profiles FOR UPDATE TO thflow_usuario
  USING (id = app.usuario_id() OR is_gestor())
  WITH CHECK (id = app.usuario_id() OR is_gestor());

CREATE POLICY project_columns_select_authenticated ON public.project_columns FOR SELECT TO thflow_usuario
  USING (true);
CREATE POLICY project_columns_write_owner_or_gestor ON public.project_columns FOR ALL TO thflow_usuario
  USING (is_gestor() OR EXISTS (SELECT 1 FROM projects p WHERE p.id = project_columns.project_id AND p.owner_id = app.usuario_id()))
  WITH CHECK (is_gestor() OR EXISTS (SELECT 1 FROM projects p WHERE p.id = project_columns.project_id AND p.owner_id = app.usuario_id()));

CREATE POLICY projects_delete_gestor ON public.projects FOR DELETE TO thflow_usuario
  USING (is_gestor());
CREATE POLICY projects_insert_gestor ON public.projects FOR INSERT TO thflow_usuario
  WITH CHECK (is_gestor());
CREATE POLICY projects_select_authenticated ON public.projects FOR SELECT TO thflow_usuario
  USING (true);
CREATE POLICY projects_update_gestor ON public.projects FOR UPDATE TO thflow_usuario
  USING (is_gestor()) WITH CHECK (is_gestor());

CREATE POLICY push_subscriptions_own ON public.push_subscriptions FOR ALL TO thflow_usuario
  USING (user_id = app.usuario_id())
  WITH CHECK (user_id = app.usuario_id());

CREATE POLICY request_options_delete_authenticated ON public.request_options FOR DELETE TO thflow_usuario
  USING (created_by = app.usuario_id() OR is_gestor());
CREATE POLICY request_options_insert_authenticated ON public.request_options FOR INSERT TO thflow_usuario
  WITH CHECK (created_by = app.usuario_id());
CREATE POLICY request_options_select_authenticated ON public.request_options FOR SELECT TO thflow_usuario
  USING (true);

CREATE POLICY statuses_select_authenticated ON public.statuses FOR SELECT TO thflow_usuario
  USING (true);
CREATE POLICY statuses_write_gestor ON public.statuses FOR ALL TO thflow_usuario
  USING (is_gestor()) WITH CHECK (is_gestor());

CREATE POLICY tasks_delete_related ON public.tasks FOR DELETE TO thflow_usuario
  USING (is_gestor() OR criador_id = app.usuario_id() OR EXISTS (
    SELECT 1 FROM projects p WHERE p.id = ANY (ARRAY[tasks.projeto_id, tasks.board_id]) AND p.owner_id = app.usuario_id()));
CREATE POLICY tasks_insert_authenticated ON public.tasks FOR INSERT TO thflow_usuario
  WITH CHECK (is_gestor() OR criador_id = app.usuario_id());
CREATE POLICY tasks_select_authenticated ON public.tasks FOR SELECT TO thflow_usuario
  USING (true);
CREATE POLICY tasks_update_related ON public.tasks FOR UPDATE TO thflow_usuario
  USING (is_gestor() OR criador_id = app.usuario_id() OR app.usuario_id() = ANY (usuario_id) OR EXISTS (
    SELECT 1 FROM projects p WHERE p.id = ANY (ARRAY[tasks.projeto_id, tasks.board_id]) AND p.owner_id = app.usuario_id()))
  WITH CHECK (is_gestor() OR criador_id = app.usuario_id() OR app.usuario_id() = ANY (usuario_id) OR EXISTS (
    SELECT 1 FROM projects p WHERE p.id = ANY (ARRAY[tasks.projeto_id, tasks.board_id]) AND p.owner_id = app.usuario_id()));

CREATE POLICY ubco_delete_own ON public.user_board_column_order FOR DELETE TO thflow_usuario
  USING (user_id = app.usuario_id());
CREATE POLICY ubco_insert_own ON public.user_board_column_order FOR INSERT TO thflow_usuario
  WITH CHECK (user_id = app.usuario_id());
CREATE POLICY ubco_select_own ON public.user_board_column_order FOR SELECT TO thflow_usuario
  USING (user_id = app.usuario_id());
CREATE POLICY ubco_update_own ON public.user_board_column_order FOR UPDATE TO thflow_usuario
  USING (user_id = app.usuario_id())
  WITH CHECK (user_id = app.usuario_id());

CREATE POLICY user_emails_insert_self_or_gestor ON public.user_emails FOR INSERT TO thflow_usuario
  WITH CHECK (user_id = app.usuario_id() OR is_gestor());
CREATE POLICY user_emails_select_self_or_gestor ON public.user_emails FOR SELECT TO thflow_usuario
  USING (user_id = app.usuario_id() OR is_gestor());
CREATE POLICY user_emails_update_self_or_gestor ON public.user_emails FOR UPDATE TO thflow_usuario
  USING (user_id = app.usuario_id() OR is_gestor())
  WITH CHECK (user_id = app.usuario_id() OR is_gestor());

CREATE POLICY upo_delete_own ON public.user_project_order FOR DELETE TO thflow_usuario
  USING (user_id = app.usuario_id());
CREATE POLICY upo_insert_own ON public.user_project_order FOR INSERT TO thflow_usuario
  WITH CHECK (user_id = app.usuario_id());
CREATE POLICY upo_select_own ON public.user_project_order FOR SELECT TO thflow_usuario
  USING (user_id = app.usuario_id());
CREATE POLICY upo_update_own ON public.user_project_order FOR UPDATE TO thflow_usuario
  USING (user_id = app.usuario_id())
  WITH CHECK (user_id = app.usuario_id());

CREATE POLICY user_roles_select_self ON public.user_roles FOR SELECT TO thflow_usuario
  USING (user_id = app.usuario_id());

-- Controle das rotinas diárias do servidor (evita rodar duas vezes no mesmo dia).
CREATE TABLE app.rotinas_execucoes (
  rotina text NOT NULL,
  dia date NOT NULL,
  iniciada_em timestamptz NOT NULL DEFAULT now(),
  resultado jsonb,
  PRIMARY KEY (rotina, dia)
);
