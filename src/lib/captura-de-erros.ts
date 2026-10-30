// Guarda o último erro do servidor para que o server.ts consiga registrar a
// pilha completa quando o framework já transformou a falha em uma resposta 500.

let ultimoErro: { erro: unknown; em: number } | undefined;
const VALIDADE_MS = 5_000;

function registrar(erro: unknown) {
  ultimoErro = { erro, em: Date.now() };
}

// Um erro HTTP do framework vira só {"status":500,...} ao ser serializado, sem a
// pilha nem a causa. Aqui o erro é expandido em texto com mensagem, pilha e a
// cadeia de causas, para o log do servidor ficar útil.
const LIMITE_CAUSAS = 5;
const LIMITE_TEXTO = 8_000;

export function descreverErro(erro: unknown): string {
  const partes: string[] = [];
  let atual: unknown = erro;
  for (let nivel = 0; nivel < LIMITE_CAUSAS && atual != null; nivel++) {
    if (!(atual instanceof Error)) {
      partes.push(typeof atual === "string" ? atual : textoSeguro(atual));
      break;
    }
    const rotulo = nivel === 0 ? "" : "causado por: ";
    partes.push(
      `${rotulo}${atual.stack ?? `${atual.name}: ${atual.message}`}${descreverStatus(atual)}`,
    );
    atual = atual.cause;
  }
  return partes.join("\n").slice(0, LIMITE_TEXTO);
}

function descreverStatus(erro: Error): string {
  const { status, statusCode } = erro as { status?: unknown; statusCode?: unknown };
  const valor = status ?? statusCode;
  return typeof valor === "number" ? ` (status ${valor})` : "";
}

function textoSeguro(valor: unknown): string {
  try {
    return JSON.stringify(valor) ?? String(valor);
  } catch {
    return String(valor);
  }
}

// Envolve o console.error para que erros registrados por qualquer camada fiquem
// guardados (consumirUltimoErro) e sejam expandidos antes de ir para o log.
const consoleErrorOriginal = console.error.bind(console);
console.error = (...args: unknown[]) => {
  const expandidos = args.map((arg) => {
    if (!(arg instanceof Error)) return arg;
    registrar(arg);
    return descreverErro(arg);
  });
  consoleErrorOriginal(...expandidos);
};

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (evento) =>
    registrar((evento as ErrorEvent).error ?? evento),
  );
  globalThis.addEventListener("unhandledrejection", (evento) =>
    registrar((evento as PromiseRejectionEvent).reason),
  );
}

export function consumirUltimoErro(): unknown {
  if (!ultimoErro) return undefined;
  if (Date.now() - ultimoErro.em > VALIDADE_MS) {
    ultimoErro = undefined;
    return undefined;
  }
  const { erro } = ultimoErro;
  ultimoErro = undefined;
  return erro;
}
