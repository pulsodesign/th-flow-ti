# TH Flow

Plataforma interna de gestão de tarefas e projetos da equipe. Reúne quadros Kanban, lista, calendário, dashboard de métricas, notificações (sino, push e e-mail), lembretes diários, anotações pessoais, controle de estoque e um guia de uso integrado ("Como usar").

## Tecnologias

| Camada           | Ferramenta                                                          |
| ---------------- | ------------------------------------------------------------------- |
| Front-end        | React 19, TypeScript, Tailwind CSS 4, componentes shadcn/ui (Radix) |
| Framework        | TanStack Start (roteamento por arquivos, SSR e funções de servidor) |
| Build e servidor | Vite 8 + Nitro (servidor Node.js)                                   |
| Banco            | PostgreSQL 16+ (sem extensões obrigatórias)                         |
| Login            | Próprio do app (bcrypt + cookie de sessão)                          |
| Arquivos         | Guardados no PostgreSQL                                             |
| E-mail           | Resend                                                              |

Segurança, dados tratados e pontos em aberto: veja [SECURITY.md](SECURITY.md).

## Como rodar localmente

Requisitos: Node.js 22 ou mais recente, npm e um PostgreSQL 16+.

```sh
npm install
cp .env.example .env      # preencha DATABASE_URL e, para testes locais, COOKIE_SEGURO=false
npm run db:semente        # cria o banco e carrega dados de teste
npm run dev
```

Usuários de teste criados pela semente: `gestor@exemplo.com` e `membro@exemplo.com`, senha `TesteTHFlow#2026`. Use a semente só em desenvolvimento.

Sem `RESEND_API_KEY`, os links de convite e de redefinição de senha aparecem no log do servidor.

| Comando              | O que faz                                           |
| -------------------- | --------------------------------------------------- |
| `npm run dev`        | Servidor de desenvolvimento                         |
| `npm run build`      | Build de produção (gera `.output/`)                 |
| `npm start`          | Roda o build de produção                            |
| `npm run db:migrar`  | Aplica as migrações pendentes de `db/migracoes/`    |
| `npm run db:semente` | Migrações + dados de teste (desenvolvimento)        |
| `npm run db:tipos`   | Regenera `src/lib/dados/tipos.ts` a partir do banco |
| `npm run lint`       | ESLint + Prettier                                   |
| `npm run typecheck`  | Checagem de tipos (TypeScript)                      |

## Implantação

```sh
npm ci
npm run build
npm run db:migrar          # com DATABASE_URL do ambiente
npm start                  # escuta em PORT (padrão 3000)
```

O servidor precisa ficar atrás de HTTPS e com `APP_URL` configurado com o endereço público (usado nos links dos e-mails). O checklist completo está em [SECURITY.md](SECURITY.md#5-implantação-segura-checklist-para-o-ti).

### Rotinas diárias

Rodam dentro do próprio servidor, no horário de Brasília:

| Horário | Rotina                                                   |
| ------- | -------------------------------------------------------- |
| 03:05   | Conclui eventos vencidos e limpa sessões e links antigos |
| 03:15   | Cria as próximas ocorrências das tarefas mensais         |
| 09:00   | Cria os lembretes do dia no sino e envia push e e-mail   |

Cada rotina roda uma vez por dia, mesmo com várias instâncias (controle em `app.rotinas_execucoes`). Se o servidor estava parado no horário, ela roda quando ele voltar. Para usar um agendador externo, defina `ROTINAS_INTERNAS=false`.

## Estrutura

```
src/
  routes/            páginas (cada arquivo é uma rota)
    _authenticated/  telas que exigem login (dashboard, quadros, equipe...)
    api/             rotas de servidor: dados, login, arquivos, tempo real
  servidor/          código só do servidor: banco, login, SQL, e-mail, rotinas
  lib/dados/         cliente de dados usado pelas telas (fala com /api/dados)
  components/        componentes de interface (ui/ = base shadcn)
  lib/thc/           regras do app: tarefas, notificações, push, e-mail
  lib/estoque/       módulo de estoque
  lib/ajuda/         conteúdo do guia "Como usar"
db/
  migracoes/         estrutura do banco em SQL (tabelas, funções, regras de acesso)
  desenvolvimento/   dados de teste
scripts/             migração do banco e geração de tipos
public/              ícones, manifesto PWA e service worker (sw.js)
```

## Como os dados são acessados

As telas montam consultas com `db.from("tabela").select(...)`. O navegador envia a descrição da consulta para `POST /api/dados`; o servidor valida tabela e colunas contra o banco, monta o SQL com parâmetros e executa como o papel `thflow_usuario`, com o id do usuário logado. As regras de acesso (RLS) do PostgreSQL decidem o que cada pessoa vê e altera.

Mudanças nas tabelas principais chegam às telas abertas pelo `/api/tempo-real` (PostgreSQL `LISTEN/NOTIFY`). Só o aviso de que a tabela mudou é enviado, e a tela busca os dados de novo, já filtrados pelas regras de acesso. A exceção são as notificações, que vão com o conteúdo, mas só para o próprio destinatário.

## Variáveis de ambiente

Veja `.env.example`. `DATABASE_URL` e `RESEND_API_KEY` são secretas e ficam só no servidor.
