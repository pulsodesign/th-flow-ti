# Segurança do TH Flow

Este documento resume como o TH Flow protege os dados, o que já está aplicado no
código e o que **não** foi aplicado de propósito, com o motivo. Ele existe para
apoiar a revisão de código e a validação de SecOps.

Para reportar uma vulnerabilidade, fale com o responsável pelo sistema na empresa
(não abra issue pública).

## 1. Visão geral

| Item              | Como funciona                                                                                                                                                                                         |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aplicação         | Um único servidor Node.js 22 (TanStack Start + Nitro, preset `node-server`). Serve as páginas e a API.                                                                                                |
| Banco             | PostgreSQL 16 ou mais recente, sem extensões obrigatórias. Estrutura em `db/migracoes/`.                                                                                                              |
| Login             | Próprio do app: e-mail e senha, sessão em cookie. Sem provedores externos.                                                                                                                            |
| Arquivos (anexos) | Guardados no próprio PostgreSQL (`app.arquivos`, coluna `bytea`).                                                                                                                                     |
| Tempo real        | `LISTEN/NOTIFY` do PostgreSQL, repassado ao navegador por Server-Sent Events (`/api/tempo-real`).                                                                                                     |
| Rotinas diárias   | Agendador dentro do servidor (03:05, 03:15 e 09:00, horário de Brasília), sem extensões no banco.                                                                                                     |
| Serviços externos | Resend (envio de e-mail), serviço de push do navegador (Web Push/VAPID), `brasilapi.com.br` (feriados, chamado pelo navegador), `api.pwnedpasswords.com` (checagem de senha vazada, por k-anonimato). |

Não há dependência de nenhuma plataforma de terceiros para banco, login ou
arquivos: tudo roda no servidor do app e no PostgreSQL.

## 2. Dados tratados (LGPD)

| Dado                                             | Onde fica                                               | Observação                                                                                                                     |
| ------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Nome, e-mail, cargo, foto de perfil              | `app.usuarios`, `public.profiles`, `public.user_emails` | Dados pessoais de colaboradores.                                                                                               |
| Hash de senha                                    | `app.usuarios.senha_hash`                               | bcrypt (custo 12). A senha nunca é guardada nem registrada em log.                                                             |
| Sessões                                          | `app.sessoes`                                           | Só o hash SHA-256 do token; o token em si fica apenas no cookie do navegador. IP e navegador ficam registrados para auditoria. |
| Tarefas, comentários, anexos, anotações, estoque | Tabelas `public.*` e `app.arquivos`                     | Conteúdo de trabalho.                                                                                                          |
| Inscrições de push                               | `public.push_subscriptions`                             | Endereço do serviço de push do navegador.                                                                                      |
| Auditoria                                        | `app.auditoria`                                         | Logins, falhas, bloqueios, troca de senha/e-mail, convites e exclusões. Guardada por 1 ano.                                    |

Retenção automática (rotina das 03:05): sessões vencidas são apagadas; links de
acesso 7 dias após vencer; tentativas de login após 7 dias; auditoria após 1 ano.

## 3. Controles aplicados

### Autenticação e sessão

- Senhas com **bcrypt custo 12**; hashes antigos de custo menor são atualizados no próximo login.
- Cookie de sessão `thflow_sessao`: `HttpOnly`, `SameSite=Lax`, `Secure` em produção, validade de 30 dias renovada com o uso. No banco só fica o hash do token.
- **Limite de tentativas**: 10 falhas por e-mail ou 50 por IP a cada 15 minutos bloqueiam novas tentativas. Pedido de redefinição: 1 por minuto por e-mail e 20 por hora por IP.
- A tela de "esqueci a senha" responde igual para e-mails existentes e inexistentes (não revela quem tem conta).
- Links de convite (24 h), redefinição (1 h) e troca de e-mail (24 h) são de **uso único**; no banco só fica o hash.
- Troca de senha encerra as outras sessões do usuário.
- Senhas novas são checadas contra a base pública de senhas vazadas (Have I Been Pwned) por k-anonimato: só os 5 primeiros caracteres do hash SHA-1 saem do servidor.
- Redirecionamentos depois do login só aceitam endereços do próprio app.

### Autorização (quem vê o quê)

- Toda consulta feita em nome do usuário roda numa transação com o papel `thflow_usuario` e `app.user_id` definido. As **políticas RLS do PostgreSQL** decidem o que cada pessoa pode ler e alterar.
- O papel `thflow_usuario` não tem acesso às tabelas do esquema `app` (senhas, sessões, links, auditoria, arquivos) nem à tabela `app_config` (chaves VAPID).
- Ações de administrador (convidar, remover, mudar nível de acesso) checam `is_gestor` no servidor antes de executar.
- Chamadas de função pelo navegador só são aceitas para uma lista fixa (`is_gestor`, `estender_series_mensais`, `registrar_movimentacao_estoque`).

- Tempo real: o servidor só avisa que uma tabela mudou; os dados são buscados de novo pela API, sob as regras de acesso. Notificações vão com conteúdo, apenas para o destinatário.

### Proteção da API

- O SQL é sempre montado no servidor, **com parâmetros**. Nomes de tabela e coluna são validados contra o catálogo do banco antes de entrar na consulta; qualquer nome desconhecido é recusado.
- `update` e `delete` sem filtro são recusados.
- Limite de 15 s por consulta (`statement_timeout`) e de tamanho de corpo nas requisições.
- **CSRF**: toda chamada que altera dados exige o cabeçalho `x-thflow-requisicao: 1` e é recusada se `Sec-Fetch-Site` indicar outro site. Não há CORS liberado.
- Erros inesperados são registrados no servidor e o navegador recebe só uma mensagem genérica.

### Arquivos

- Limite de 10 MB por arquivo. Nome do arquivo é saneado e o caminho recebe um UUID.
- Download só para usuários logados. Imagens e PDF abrem no navegador; os demais tipos são sempre baixados como anexo.
- Respostas de arquivo com `X-Content-Type-Options: nosniff` e `Content-Security-Policy: sandbox`, o que impede que um arquivo enviado execute scripts no domínio do app.
- Só quem enviou o arquivo ou um administrador pode apagá-lo.

### Cabeçalhos HTTP (todas as respostas)

`Content-Security-Policy` (em produção), `Strict-Transport-Security` (em produção com HTTPS),
`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (câmera, microfone,
localização, pagamento e USB desligados) e `Cross-Origin-Opener-Policy: same-origin`.
Definidos em `src/servidor/cabecalhos.ts`.

### Código e dependências

- `npm audit`: 0 vulnerabilidades conhecidas na data desta versão.
- CI no GitHub (`.github/workflows/ci.yml`): auditoria de dependências, lint, checagem de tipos, build e aplicação das migrações num PostgreSQL limpo.
- CodeQL (`.github/workflows/codeql.yml`) com o conjunto `security-extended`, semanal e em cada PR. O job falha em qualquer alerta novo; os falsos positivos já analisados ficam em `.github/codeql-aceitos.json`, cada um com o motivo (hoje 3: SHA-1 exigido pela API do Have I Been Pwned e duas telas que só escolhem o que mostrar a partir do link do e-mail, com a validação feita no servidor). Como o repositório é privado e sem code scanning ativado, o resultado completo fica como artefato da execução.
- Dependabot semanal para npm e mensal para GitHub Actions.
- Código de servidor fica em `src/servidor/`, e o build **recusa** importar essa pasta no código do navegador (bcrypt, pg e credenciais nunca chegam ao navegador).
- Nenhuma credencial no repositório: tudo vem de variáveis de ambiente (`.env.example`).

## 4. Pontos não aplicados (para não mudar o funcionamento)

O pedido foi não alterar nenhuma funcionalidade. Os itens abaixo melhorariam a
segurança, mas mudariam o comportamento que os usuários conhecem, então ficaram
registrados aqui para decisão da empresa.

| #   | Recomendação                                                             | Por que não foi aplicada                                                                                                 | Impacto se aplicar                                                                                                          |
| --- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| 1   | Senha mínima de 12 caracteres (hoje 6)                                   | As senhas atuais têm a regra de 6 e as telas avisam "mínimo de 6".                                                       | Usuários precisariam trocar a senha; mudar textos das telas. A checagem de senha vazada já reduz o risco.                   |
| 2   | Login corporativo (Microsoft Entra ID / SSO) e MFA                       | Muda a forma de entrar no app.                                                                                           | Integração com o tenant da empresa; o login próprio pode ser mantido como alternativa ou removido.                          |
| 3   | Anexos visíveis só para quem tem acesso à tarefa                         | Hoje qualquer usuário logado abre um anexo pelo link, e a equipe usa assim. O caminho tem UUID, então não é adivinhável. | Exige ligar cada arquivo à tarefa/comentário e checar a permissão no download.                                              |
| 4   | Antivírus nos anexos                                                     | Não existia antes e depende de um serviço da empresa (ex.: ClamAV, Defender).                                            | Envio fica mais lento; precisa de infraestrutura.                                                                           |
| 5   | CSP sem `'unsafe-inline'` em scripts                                     | O framework injeta o estado inicial da página como script inline. Remover quebraria o carregamento.                      | Exige suporte a _nonce_ no framework. Os demais pontos da CSP (origens, `frame-ancestors`, `object-src`) já estão fechados. |
| 6   | `img-src` restrito a domínios conhecidos (hoje aceita qualquer `https:`) | Fotos de perfil e imagens em descrições podem vir de links externos.                                                     | Imagens externas já cadastradas deixariam de aparecer.                                                                      |
| 7   | Sessão mais curta (ex.: 8 h) ou expiração por inatividade                | Hoje a sessão dura 30 dias renovados com o uso, como antes.                                                              | Usuários teriam que entrar de novo com frequência.                                                                          |
| 8   | Tempo real também no módulo de estoque                                   | Hoje o estoque não atualiza em tempo real, e a equipe usa assim.                                                         | Só funcionalidade; não é risco. Listado para registro.                                                                      |

## 5. Implantação segura (checklist para o TI)

1. PostgreSQL 16+ com TLS (`?sslmode=require` na `DATABASE_URL`) e backup diário com retenção definida pela empresa (ex.: 30 dias) e teste de restauração.
2. Usuário do banco dono do esquema só para o app (não usar superusuário). Ele precisa de `CREATEROLE` só na primeira migração, para criar o papel `thflow_usuario`.
3. App atrás de HTTPS (proxy reverso ou load balancer) com `APP_URL` apontando para o endereço público.
4. Variáveis secretas (`DATABASE_URL`, `RESEND_API_KEY`) num cofre (ex.: Azure Key Vault), nunca em arquivo versionado.
5. Domínio de e-mail verificado no Resend (SPF/DKIM) ou troca por outro provedor SMTP da empresa (código em `src/servidor/email.ts`).
6. Logs do servidor (stdout) enviados ao sistema de logs da empresa. O servidor não registra senhas nem tokens.
7. Para mais de uma instância do app: as rotinas diárias já evitam execução dupla pela tabela `app.rotinas_execucoes`; o tempo real funciona em todas as instâncias.
