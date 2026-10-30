/** Página simples mostrada quando o servidor falha ao montar uma tela. */
export function paginaDeErro(): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>TH Flow · erro ao carregar</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #f7f5ef; color: #23254d; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .cartao { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #5d6080; margin: 0 0 1.5rem; }
      .acoes { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 999px; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .principal { background: #23254d; color: #fff; }
      .secundario { background: #fff; color: #23254d; border-color: #d8d4c6; }
    </style>
  </head>
  <body>
    <div class="cartao">
      <h1>Não foi possível carregar a página</h1>
      <p>Algo deu errado no servidor. Tente de novo ou volte para o início.</p>
      <div class="acoes">
        <button class="principal" onclick="location.reload()">Tentar de novo</button>
        <a class="secundario" href="/">Ir para o início</a>
      </div>
    </div>
  </body>
</html>`;
}
