type ErroAuth = { message?: unknown; code?: unknown };

/** Traduz os códigos de erro do login e da conta para mensagens em pt-BR. */
const MAPA: { teste: RegExp; texto: string }[] = [
  { teste: /credenciais_invalidas/, texto: "E-mail ou senha incorretos." },
  { teste: /email_ja_cadastrado/, texto: "Este e-mail já está cadastrado." },
  { teste: /senha_curta/, texto: "A senha precisa ter ao menos 6 caracteres." },
  {
    teste: /senha_vazada/,
    texto:
      "Esta senha é muito comum ou já apareceu em vazamentos. Escolha uma senha mais segura e diferente.",
  },
  { teste: /senha_igual_a_atual/, texto: "A nova senha deve ser diferente da atual." },
  { teste: /senha_atual_incorreta/, texto: "A senha atual está incorreta." },
  { teste: /sessao_expirada/, texto: "Sua sessão expirou. Entre novamente." },
  { teste: /link_invalido/, texto: "Este link expirou ou já foi usado. Peça um novo link." },
  {
    teste: /muitas_tentativas/,
    texto: "Muitas tentativas de login. Aguarde alguns minutos e tente novamente.",
  },
  {
    teste: /limite_de_emails/,
    texto: "Muitos e-mails enviados. Aguarde alguns minutos e tente novamente.",
  },
  { teste: /aguarde_para_tentar/, texto: "Aguarde alguns segundos antes de tentar novamente." },
  { teste: /email_invalido|invalid email/i, texto: "E-mail inválido." },
  { teste: /usuario_nao_encontrado/, texto: "Usuário não encontrado." },
  {
    teste: /falha_conexao|network|failed to fetch/i,
    texto: "Falha de conexão. Verifique sua internet e tente novamente.",
  },
];

export function traduzErroAuth(err: unknown, padrao = "Não foi possível continuar.") {
  const objeto = typeof err === "object" && err !== null ? (err as ErroAuth) : null;
  const mensagem =
    err instanceof Error ? err.message : typeof err === "string" ? err : objeto?.message;
  const codigo = objeto?.code;
  const textoBusca = [codigo, mensagem].filter((valor) => typeof valor === "string").join(" ");
  if (!textoBusca) return padrao;
  const achado = MAPA.find((m) => m.teste.test(textoBusca));
  return achado ? achado.texto : padrao;
}
