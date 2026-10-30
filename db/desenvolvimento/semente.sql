-- Dados de exemplo para um banco de testes (NÃO use em produção).
-- Usuários: gestor@exemplo.com e membro@exemplo.com, senha "TesteTHFlow#2026".

INSERT INTO app.usuarios (id, email, senha_hash, metadados, email_confirmado_em) VALUES
  ('00000000-0000-4000-8000-000000000001', 'gestor@exemplo.com', '$2b$12$fKfmgU53hT/2fbaolREP/.bStLmBR5AgaS7l525HafYwVHxIj9bS6', '{"nome":"Gestor Exemplo","cargo":"Coordenação","nivel_acesso":"gestor"}', now()),
  ('00000000-0000-4000-8000-000000000002', 'membro@exemplo.com', '$2b$12$fKfmgU53hT/2fbaolREP/.bStLmBR5AgaS7l525HafYwVHxIj9bS6', '{"nome":"Membro Exemplo","cargo":"Design","nivel_acesso":"membro"}', now())
ON CONFLICT DO NOTHING;

INSERT INTO public.statuses (chave, label, cor, posicao, is_done) VALUES
  ('backlog', 'Backlog', 'oklch(0.68 0.017 260)', 10, false),
  ('em_andamento', 'Em andamento', 'oklch(0.6 0.14 259)', 20, false),
  ('em_aprovacao', 'Em aprovação', 'oklch(0.78 0.15 78)', 30, false),
  ('aprovado', 'Aprovado', 'oklch(0.7 0.15 160)', 40, false),
  ('com_fornecedor', 'Com fornecedor', 'oklch(0.66 0.13 330)', 50, false),
  ('entregue', 'Entregue', 'oklch(0.72 0.16 150)', 60, true),
  ('standby', 'Standby', 'oklch(0.66 0.09 300)', 70, false)
ON CONFLICT (chave) DO NOTHING;

INSERT INTO public.projects (id, nome, kind, icon, owner_id) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'Gestão de Demandas', 'mae', 'Inbox', NULL),
  ('00000000-0000-4000-8000-0000000000a2', 'Quadro de Gestor Exemplo', 'individual', 'User', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-0000000000a3', 'Quadro de Membro Exemplo', 'individual', 'User', '00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-0000000000a4', 'Social', 'departamento', 'Folder', NULL)
ON CONFLICT DO NOTHING;

INSERT INTO public.tasks (titulo, descricao, status, board_id, usuario_id, criador_id, data_vencimento, lembrete) VALUES
  ('Tarefa de exemplo', 'Descrição da tarefa.', 'backlog', '00000000-0000-4000-8000-0000000000a3',
   '{00000000-0000-4000-8000-000000000002}', '00000000-0000-4000-8000-000000000001', current_date, true);
