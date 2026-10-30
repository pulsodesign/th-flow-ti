/**
 * Conteúdo do guia "Como usar". Texto em arquivo (sem banco): quando uma
 * função do app mudar, atualize o tópico correspondente aqui.
 *
 * - `termos`: sinônimos e palavras que a pessoa pode digitar na busca.
 * - `admin`: tópico visível só para administradores.
 */

export type Topico = {
  id: string;
  pergunta: string;
  resposta: string;
  passos?: string[];
  dica?: string;
  termos?: string[];
  admin?: boolean;
};

export type Secao = {
  id: string;
  titulo: string;
  /** Nome do ícone exportado em `@/components/ui/icon`. */
  icone: IconeSecao;
  resumo: string;
  topicos: Topico[];
};

export type IconeSecao =
  | "Inbox"
  | "Folder"
  | "User"
  | "Columns3"
  | "CalendarDays"
  | "CheckSquare"
  | "LayoutDashboard"
  | "Users"
  | "Package"
  | "NotebookPen"
  | "Bell"
  | "Trash2"
  | "Settings"
  | "MessageSquare";

export const SECOES: Secao[] = [
  {
    id: "organizacao",
    titulo: "Como o TH Flow se organiza",
    icone: "Inbox",
    resumo: "Quadro Mãe, projetos e quadros individuais: a mesma tarefa aparece em vários lugares.",
    topicos: [
      {
        id: "espelhamento",
        pergunta: "Por que a mesma tarefa aparece em mais de um quadro?",
        resposta:
          "O TH Flow trabalha com espelhamento. Uma tarefa existe uma vez só, mas aparece em três lugares: no Quadro Mãe (Gestão de Demandas), no quadro do projeto escolhido e no quadro individual de cada responsável. Mudou num lugar, mudou em todos.",
        passos: [
          "Quadro Mãe: mostra todas as tarefas da operação.",
          'Projeto: mostra as tarefas daquele projeto (a "pasta").',
          "Quadro individual: mostra as tarefas em que a pessoa é responsável.",
        ],
        dica: "Por isso não é preciso criar a tarefa duas vezes. Crie uma vez e escolha o projeto e os responsáveis.",
        termos: [
          "espelhar",
          "duplicada",
          "repetida em dois lugares",
          "aparece em todos",
          "sincronizar",
        ],
      },
      {
        id: "quadro-mae",
        pergunta: "O que é o Quadro Mãe (Gestão de Demandas)?",
        resposta:
          "É o quadro central da operação, no topo do menu em Operação Geral. Ele reúne todas as tarefas de todos os projetos e de todas as pessoas, num só lugar. É aqui que se tem a visão completa das demandas.",
        passos: [
          "Abra o menu e clique em Gestão de Demandas, em Operação Geral.",
          "Use Quadros, Lista ou Calendário no topo para mudar a forma de ver.",
          "Tarefas criadas aqui ficam marcadas como do Quadro Mãe e também são espelhadas no projeto e nos quadros dos responsáveis.",
        ],
        termos: [
          "gestão de demandas",
          "quadro principal",
          "quadro geral",
          "operação geral",
          "master",
        ],
      },
      {
        id: "colunas-mae",
        pergunta: "O que são as colunas mães (status globais)?",
        resposta:
          "As colunas do Quadro Mãe são os status oficiais do fluxo, como A fazer, Em andamento e Concluído. Elas valem para todos os quadros: uma coluna criada no Quadro Mãe aparece em todos os projetos e em todos os quadros individuais.",
        passos: [
          "No Quadro Mãe, vá até o fim das colunas e clique em Novo status (todos os quadros).",
          "Digite o nome e pressione Enter.",
          "A coluna passa a existir em todos os quadros, para toda a equipe.",
        ],
        dica: "Criar, excluir e mudar a ordem padrão dessas colunas é função de administrador. Excluir uma coluna mãe remove o status de todos os quadros, então o app pede confirmação.",
        termos: [
          "status global",
          "coluna global",
          "novo status",
          "colunas oficiais",
          "criar status",
        ],
      },
      {
        id: "colunas-locais",
        pergunta: "O que são as colunas personalizadas de um projeto ou quadro individual?",
        resposta:
          "Fora do Quadro Mãe, qualquer quadro pode ter colunas próprias. Elas existem só naquele quadro e não aparecem nos outros. Servem para etapas que só fazem sentido ali, como Aprovação do cliente num projeto ou Esta semana no seu quadro.",
        passos: [
          "Abra o projeto ou o quadro individual.",
          "No fim das colunas, clique em Coluna personalizada.",
          "Digite o nome e pressione Enter.",
        ],
        dica: "Colunas personalizadas aparecem com um ícone ao lado do nome. Você pode trocar a cor ou excluir pelo menu da coluna.",
        termos: [
          "coluna local",
          "coluna pessoal",
          "coluna individual",
          "criar coluna",
          "nova coluna",
          "etapa",
        ],
      },
      {
        id: "ordem-colunas",
        pergunta: "Como mudar a ordem das colunas?",
        resposta:
          "Arraste o cabeçalho da coluna para o lugar que quiser. A nova ordem vale só para você, naquele quadro, e não muda o que os colegas veem.",
        passos: [
          "Clique e segure no título da coluna.",
          "Solte na posição desejada.",
          "Para voltar ao padrão, clique em Restaurar ordem padrão, no fim das colunas.",
        ],
        dica: "Quando um administrador reordena o Quadro Mãe, ele também define a ordem padrão de quem nunca personalizou.",
        termos: [
          "reordenar coluna",
          "mover coluna",
          "arrastar coluna",
          "ordem padrão",
          "restaurar ordem",
        ],
      },
      {
        id: "quadro-individual",
        pergunta: "O que é o quadro individual?",
        resposta:
          "Cada pessoa da equipe tem um quadro com o próprio nome, na seção Equipe do menu. Ele mostra todas as tarefas em que ela é responsável, venham de qual projeto vierem. O seu aparece como Meu quadro.",
        passos: [
          "Abra o menu e procure seu nome em Equipe (marcado como Meu quadro).",
          "Tarefas criadas dentro do seu quadro já entram com você como responsável.",
          "Você pode criar colunas personalizadas para organizar seu dia.",
        ],
        termos: ["meu quadro", "quadro pessoal", "quadro da pessoa", "minhas demandas"],
      },
      {
        id: "projetos",
        pergunta: 'Como funcionam os projetos (as "pastas")?',
        resposta:
          "Projetos ficam na seção Projetos do menu e agrupam as tarefas de um tema, cliente ou área. Cada projeto pode ter responsáveis padrão: as pessoas que sempre cuidam daquele assunto. Toda tarefa ligada ao projeto já recebe essas pessoas como responsáveis automaticamente.",
        passos: [
          "Ao criar uma tarefa dentro do projeto, os responsáveis padrão entram sozinhos.",
          "Ao escolher o projeto no campo Projeto de uma tarefa, os responsáveis padrão são adicionados.",
          "Ao colocar numa tarefa uma tag com o mesmo nome do projeto, os responsáveis padrão também são adicionados.",
        ],
        dica: "Os responsáveis padrão só são somados, nunca removidos. Você pode tirar alguém da tarefa depois, se precisar.",
        termos: [
          "pasta",
          "departamento",
          "responsáveis padrão",
          "atribuir automático",
          "cliente",
          "área",
        ],
      },
      {
        id: "criar-projeto",
        pergunta: "Como criar ou editar um projeto e escolher as pessoas dele?",
        resposta: "Projetos são criados e editados por administradores, pelo menu lateral.",
        passos: [
          "Clique no + ao lado de Projetos, no menu.",
          "Dê um nome ao projeto (ex.: Social).",
          "Marque as pessoas em Responsáveis padrão e salve.",
          "Para editar ou excluir, passe o mouse no projeto e use os ícones de lápis ou lixeira.",
        ],
        dica: "Excluir um projeto remove as tarefas dele. Qualquer pessoa pode mudar a ordem dos projetos no próprio menu pelas setas, e essa ordem vale só para ela.",
        termos: [
          "novo projeto",
          "nova pasta",
          "renomear projeto",
          "excluir projeto",
          "selecionar pessoas",
        ],
        admin: true,
      },
      {
        id: "eventos",
        pergunta: "Para que serve a coluna Eventos?",
        resposta:
          "Eventos são compromissos com data, como uma feira, uma ação ou uma reunião importante, e não tarefas de produção. A coluna Eventos é global: um evento aparece em todos os quadros, para toda a equipe, para ninguém perder a data.",
        passos: [
          "Crie um card na coluna Eventos, ou mude o Status de uma tarefa para Eventos.",
          "Preencha Datas do evento com o início e o fim.",
          "No Calendário, o evento ocupa todos os dias do período.",
          "Depois que a data final passa, ou quando o evento é marcado como concluído, ele sai dos quadros sozinho.",
        ],
        dica: "Eventos não contam como carga de trabalho: ficam fora da contagem de tarefas do menu e das métricas de tarefas do Dashboard, que mostra os eventos em números próprios.",
        termos: ["evento", "agenda", "compromisso", "feira", "data do evento", "coluna de eventos"],
      },
    ],
  },
  {
    id: "tarefas",
    titulo: "Tarefas",
    icone: "CheckSquare",
    resumo: "Criar, mover, atribuir, comentar, anexar e repetir tarefas.",
    topicos: [
      {
        id: "criar-tarefa",
        pergunta: "Como criar uma tarefa?",
        resposta: "Há três jeitos, todos dentro de um quadro.",
        passos: [
          "Clique em Nova tarefa, no topo do quadro, para abrir a tarefa completa.",
          "Ou clique em Adicionar uma tarefa no rodapé de uma coluna, digite o título e pressione Enter.",
          "Ou, no Calendário, clique no + de um dia para criar a tarefa já com aquela data.",
        ],
        dica: "Onde você cria importa: no projeto, ela já vai para o projeto com os responsáveis padrão; no seu quadro, já entra com você como responsável.",
        termos: [
          "nova tarefa",
          "adicionar tarefa",
          "cadastrar demanda",
          "criar demanda",
          "novo card",
        ],
      },
      {
        id: "mover-tarefa",
        pergunta: "Como mudar o status ou concluir uma tarefa?",
        resposta: "Arraste o card para outra coluna, ou troque o campo Status dentro da tarefa.",
        passos: [
          "No modo Quadros, arraste o card até a coluna desejada.",
          "Para concluir, leve até a coluna de concluído ou marque o tick de conclusão.",
          "Dentro de uma coluna, arraste para cima ou para baixo para mudar a ordem (com a ordenação Ordem do quadro).",
        ],
        termos: ["arrastar", "mover card", "finalizar", "concluir", "status", "mudar coluna"],
      },
      {
        id: "responsaveis",
        pergunta: "Como atribuir responsáveis, prioridade e entrega?",
        resposta: "Abra a tarefa clicando no card e preencha os campos.",
        passos: [
          "Responsáveis: escolha uma ou mais pessoas. A tarefa passa a aparecer no quadro individual delas.",
          "Prioridade: indica a urgência.",
          "Entrega: a data de vencimento. Ela alimenta o Calendário, os atrasos e o Dashboard.",
          "Área solicitante e Solicitante: quem pediu. Use Gerenciar opções para cadastrar novas.",
        ],
        termos: [
          "atribuir",
          "delegar",
          "responsável",
          "prazo",
          "vencimento",
          "data de entrega",
          "urgência",
          "solicitante",
        ],
      },
      {
        id: "subtarefas-tags",
        pergunta: "Como usar subtarefas e tags?",
        resposta: "Subtarefas quebram a tarefa em passos; tags ajudam a classificar e buscar.",
        passos: [
          "Em subtarefas, digite e pressione Enter para cada item. Marque conforme for fazendo.",
          "Adicione até 5 tags por tarefa, cada uma com cor.",
          "Uma tag com o nome de um projeto adiciona os responsáveis padrão dele.",
        ],
        termos: ["checklist", "subtarefa", "etiqueta", "tag", "marcador"],
      },
      {
        id: "comentarios",
        pergunta: "Como comentar e mencionar alguém?",
        resposta: "Na parte de Atividade e comentários da tarefa, escreva e use @ para mencionar.",
        passos: [
          "Abra a tarefa e desça até Atividade e comentários.",
          "Digite @ e escolha a pessoa.",
          "Ela recebe uma notificação no sino (e no celular ou e-mail, se ativado).",
        ],
        dica: "O histórico mostra tudo o que mudou na tarefa e quem mudou.",
        termos: [
          "comentar",
          "mencionar",
          "marcar pessoa",
          "arroba",
          "@",
          "histórico da tarefa",
          "atividade",
        ],
      },
      {
        id: "anexos-link",
        pergunta: "Como anexar arquivos ou mandar o link de uma tarefa?",
        resposta: "Use os botões no topo da tarefa.",
        passos: [
          "Clique em Anexar para enviar arquivos.",
          "Clique no ícone de link para copiar o endereço da tarefa e mandar para alguém.",
          "Quem abrir o link cai direto na tarefa.",
        ],
        termos: [
          "anexo",
          "arquivo",
          "upload",
          "enviar arquivo",
          "copiar link",
          "compartilhar tarefa",
        ],
      },
      {
        id: "repetir",
        pergunta: "Como fazer uma tarefa se repetir todo mês?",
        resposta: "Use o campo Repetir dentro da tarefa.",
        passos: [
          "Escolha: todo mês sem data para acabar, por 3 meses ou por 6 meses.",
          "As próximas ocorrências são criadas com a mesma data em cada mês.",
          "Para apagar a série inteira, use Excluir tarefa repetida.",
        ],
        termos: ["recorrente", "recorrência", "mensal", "repetir", "todo mês"],
      },
      {
        id: "lembrete",
        pergunta: "Como criar um lembrete?",
        resposta: "Ligue a chave Lembrete dentro da tarefa.",
        passos: [
          "Abra a tarefa e ative Lembrete.",
          "No dia da entrega (ou do início do evento), às 9h, os responsáveis recebem o aviso.",
          "O aviso chega no sino e, se ativados, no celular e por e-mail.",
        ],
        termos: ["lembrar", "alarme", "aviso", "notificar no dia", "9h"],
      },
      {
        id: "excluir-arquivar",
        pergunta: "Excluí ou não acho uma tarefa. E agora?",
        resposta:
          "Tarefas excluídas vão para a Lixeira por 30 dias. Tarefas entregues há mais de 60 dias são arquivadas: somem do quadro, mas aparecem quando você busca pelo título.",
        passos: [
          "Para excluir: abra a tarefa e clique no ícone de lixeira.",
          "Para recuperar: vá em Lixeira, no rodapé do menu, e clique em Restaurar.",
          "Para achar uma arquivada: digite o título na busca do quadro.",
        ],
        termos: [
          "apagar",
          "deletar",
          "remover",
          "recuperar",
          "restaurar",
          "sumiu",
          "arquivada",
          "antiga",
        ],
      },
    ],
  },
  {
    id: "visualizacoes",
    titulo: "Quadros, Lista e Calendário",
    icone: "Columns3",
    resumo: "Três formas de ver o mesmo quadro, com busca, filtros e ordenação.",
    topicos: [
      {
        id: "modos",
        pergunta: "Qual a diferença entre Quadros, Lista e Calendário?",
        resposta:
          "São só formas diferentes de ver as mesmas tarefas do quadro. O app lembra a última que você usou.",
        passos: [
          "Quadros: colunas por status, para arrastar os cards.",
          "Lista: uma tabela com tarefa, status, responsáveis, prioridade e entrega.",
          "Calendário: tarefas pela data de entrega, em Mês ou Semana, com feriados marcados.",
        ],
        termos: [
          "kanban",
          "tabela",
          "agenda",
          "visualização",
          "modo de ver",
          "semana",
          "mês",
          "feriado",
        ],
      },
      {
        id: "filtros",
        pergunta: "Como buscar, filtrar e ordenar tarefas?",
        resposta: "Use a barra no topo do quadro.",
        passos: [
          "Busca: procura no título, área, solicitante e tags.",
          "Filtros: Todas, Tarefas por concluir ou Tarefas concluídas.",
          "Só minhas tarefas: mostra apenas as suas.",
          "Ordenar por: ordem do quadro, conclusão, responsável, criador, entrega ou urgência.",
        ],
        termos: ["pesquisar", "procurar", "filtrar", "ordenar", "só minhas", "classificar"],
      },
    ],
  },
  {
    id: "telas",
    titulo: "Telas do menu",
    icone: "LayoutDashboard",
    resumo: "Dashboard, Minhas Tarefas, Equipe, Visão Geral e Anotações.",
    topicos: [
      {
        id: "dashboard",
        pergunta: "O que mostra o Dashboard?",
        resposta:
          "Os números da operação no período escolhido: tarefas, concluídas, atrasadas, próximos 7 dias, taxa de conclusão, tempo médio, entregas no prazo, replanejadas e eventos, além de gráficos por status, prioridade, pessoa e quadro.",
        passos: [
          "Escolha o período no topo (ou um intervalo personalizado).",
          "Passe o mouse no ícone de informação de cada número para entender o cálculo.",
          "Clique em Exportar dados para baixar uma planilha com os números.",
        ],
        dica: "Administradores podem ver a equipe toda ou o resumo de um membro. Membros veem o próprio desempenho.",
        termos: [
          "métricas",
          "indicadores",
          "relatório",
          "gráfico",
          "planilha",
          "excel",
          "exportar",
          "desempenho",
        ],
      },
      {
        id: "minhas-tarefas",
        pergunta: "O que é Minhas Tarefas?",
        resposta:
          "Uma lista com todas as tarefas em que você é responsável, de todos os quadros, num só lugar.",
        termos: ["minhas", "o que tenho pra fazer", "pendências"],
      },
      {
        id: "visao-geral",
        pergunta: "O que é a Visão Geral?",
        resposta:
          "Uma tela onde cada coluna é uma pessoa da equipe, com as tarefas sob responsabilidade dela, mais uma coluna de Eventos. Serve para ver a carga de cada um de uma vez.",
        passos: ["Use a busca, os filtros e a ordenação no topo, como nos quadros."],
        termos: ["carga de trabalho", "quem está com o quê", "por pessoa", "distribuição"],
      },
      {
        id: "equipe",
        pergunta: "O que é a tela Equipe?",
        resposta:
          "A lista de membros com cargo, nível de acesso e quantas tarefas cada um tem abertas.",
        termos: ["membros", "pessoas", "time", "colaboradores"],
      },
      {
        id: "acesso",
        pergunta: "Como convidar alguém ou mudar o nível de acesso?",
        resposta: "Na tela Equipe, a área Acesso & Administração aparece só para administradores.",
        passos: [
          "Em Novo usuário, preencha nome, e-mail corporativo e cargo.",
          "Escolha Membro ou Administrador e envie: a pessoa recebe um e-mail para criar a senha.",
          "Use o botão de reenviar para mandar o convite de novo ou copiar o link de acesso.",
          "Na lista, troque o nível de acesso, a cor do avatar ou remova o membro.",
        ],
        termos: [
          "convidar",
          "novo usuário",
          "adicionar pessoa",
          "permissão",
          "administrador",
          "admin",
          "remover membro",
        ],
        admin: true,
      },
      {
        id: "anotacoes",
        pergunta: "Para que servem as Anotações?",
        resposta: "Um bloco de notas pessoal e privado: só você vê o que escreve ali.",
        passos: [
          "Clique em Anotações, no menu, e crie uma nova.",
          "Use a busca para achar uma anotação.",
          "Anotações excluídas vão para a lixeira delas, onde dá para restaurar ou apagar de vez.",
        ],
        termos: ["notas", "bloco de notas", "rascunho", "privado"],
      },
    ],
  },
  {
    id: "estoque",
    titulo: "Estoque",
    icone: "Package",
    resumo: "Itens, tamanhos, entradas e saídas, com histórico.",
    topicos: [
      {
        id: "estoque-item",
        pergunta: "Como cadastrar um item no estoque?",
        resposta: "Na tela Estoque, crie um novo item.",
        passos: [
          "Informe o nome (ex.: Camiseta institucional), o estoque onde ele fica e uma foto, se quiser.",
          "Itens com tamanho (P a EGG) têm quantidade separada por tamanho.",
          "Use a busca, o filtro por estoque e a ordenação para achar itens.",
        ],
        termos: ["produto", "novo item", "cadastrar item", "tamanho", "camiseta", "brinde"],
      },
      {
        id: "estoque-movimentacao",
        pergunta: "Como registrar entrada ou saída?",
        resposta: "Use Registrar movimentação.",
        passos: [
          "Escolha Entrada ou Saída, o item, o tamanho (se houver) e a quantidade.",
          "Em Observação, anote o motivo, destino ou responsável.",
          "Abra o item para ver o histórico de movimentações e comentar (com @ para mencionar).",
        ],
        dica: "O painel do estoque mostra total de itens, itens zerados e entradas x saídas no período (semana, mês ou data específica).",
        termos: ["entrada", "saída", "baixa", "retirada", "movimentação", "histórico", "zerado"],
      },
    ],
  },
  {
    id: "conta",
    titulo: "Notificações, perfil e aparência",
    icone: "Bell",
    resumo: "Sino, avisos no celular, e-mail, senha e tema.",
    topicos: [
      {
        id: "sino",
        pergunta: "Como funcionam as notificações?",
        resposta:
          "O sino no topo do menu mostra menções, mudanças de status e lembretes. Em Ver histórico completo você filtra por menções, status e importância.",
        termos: ["sino", "notificação", "aviso", "histórico de notificações", "alerta"],
      },
      {
        id: "push-email",
        pergunta: "Como receber avisos no celular ou por e-mail?",
        resposta: "Em Perfil, na seção Notificações.",
        passos: [
          "Clique em Ativar notificações para receber avisos neste aparelho. Use Enviar teste para conferir.",
          "No iPhone, primeiro adicione o TH Flow à tela de início (Compartilhar > Adicionar à Tela de Início) e abra por esse atalho.",
          "Em Notificações por e-mail, escolha quais tipos de aviso também chegam por e-mail.",
        ],
        termos: [
          "push",
          "celular",
          "iphone",
          "android",
          "e-mail",
          "email",
          "ativar notificações",
          "tela de início",
        ],
      },
      {
        id: "perfil-senha",
        pergunta: "Como mudar meus dados ou a senha?",
        resposta: "Clique no seu nome no rodapé do menu para abrir o Perfil.",
        passos: [
          "Em Perfil: nome, cargo e foto.",
          "Em Senha e segurança: digite a senha atual e a nova (mínimo 6 caracteres).",
          "Esqueceu a senha? Use a opção de redefinição para receber o link por e-mail.",
        ],
        termos: ["senha", "trocar senha", "esqueci a senha", "foto", "nome", "cargo", "redefinir"],
      },
      {
        id: "tema-menu",
        pergunta: "Como mudar o tema ou minimizar o menu?",
        resposta:
          "Em Aparência, no menu, escolha o tema claro ou escuro. O botão ao lado do logo minimiza o menu para só os ícones.",
        termos: ["tema", "modo escuro", "dark", "claro", "minimizar menu", "esconder menu"],
      },
    ],
  },
];

/** Perguntas frequentes: entram na busca como qualquer outro tópico. */
export const FAQ: Secao = {
  id: "faq",
  titulo: "Perguntas frequentes",
  icone: "MessageSquare",
  resumo: "Dúvidas comuns do dia a dia, com resposta curta.",
  topicos: [
    {
      id: "faq-coluna-individual",
      pergunta: "Como criar uma coluna só minha, no meu quadro individual?",
      resposta:
        "Abra seu quadro (seu nome em Equipe, marcado como Meu quadro), vá até o fim das colunas e clique em Coluna personalizada. Ela existe só no seu quadro: não aparece no Quadro Mãe nem nos projetos.",
      termos: ["coluna individual", "coluna pessoal", "coluna no meu quadro", "criar coluna"],
    },
    {
      id: "faq-1",
      pergunta: "Criei a tarefa no projeto. Preciso criar de novo no Quadro Mãe?",
      resposta:
        "Não. Ela já aparece no Quadro Mãe e no quadro de cada responsável automaticamente.",
    },
    {
      id: "faq-2",
      pergunta: "Criei uma coluna no meu quadro e ela não apareceu no Quadro Mãe. Está certo?",
      resposta:
        "Sim. Colunas personalizadas existem só no quadro onde foram criadas. Para uma coluna valer em todos os quadros, um administrador cria um novo status no Quadro Mãe.",
    },
    {
      id: "faq-3",
      pergunta: "Por que entrou gente que eu não escolhi na minha tarefa?",
      resposta:
        "Porque a tarefa foi ligada a um projeto (ou recebeu uma tag com o nome dele) que tem responsáveis padrão. Você pode remover a pessoa na tarefa, se for o caso.",
      termos: ["responsável automático", "entrou sozinho"],
    },
    {
      id: "faq-4",
      pergunta: "Mudei a ordem das colunas. Mudou para todo mundo?",
      resposta:
        "Não. A ordem das colunas é pessoal. Só a ordem dentro de uma coluna (dos cards) é compartilhada.",
    },
    {
      id: "faq-5",
      pergunta: "Um evento sumiu do quadro. Foi apagado?",
      resposta:
        "Provavelmente não: eventos saem dos quadros depois da data final ou quando são concluídos.",
    },
    {
      id: "faq-6",
      pergunta: "Uma tarefa antiga sumiu.",
      resposta:
        "Tarefas entregues há mais de 60 dias ficam arquivadas. Busque pelo título no quadro. Se foi excluída, veja a Lixeira (30 dias).",
    },
    {
      id: "faq-7",
      pergunta: "Não recebo avisos no celular.",
      resposta:
        "Ative em Perfil > Notificações neste aparelho e use Enviar teste. No iPhone, abra o app pelo atalho da tela de início.",
    },
  ],
};

/** Normaliza para busca: sem acento, minúsculo, espaços simples. */
export function normalizar(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export type Resultado = { secao: Secao; topico: Topico; pontos: number };

// Palavras que não ajudam a achar nada ("como faço para criar…").
const VAZIAS = new Set(
  "a o as os e de do da dos das um uma uns umas em no na nos nas para pra pro por com sem que se eu meu minha meus minhas como onde quando qual quais faco fazer posso consigo tem ter ser esta isso essa esse".split(
    " ",
  ),
);

/** Reduz plural simples para casar "colunas" com "coluna" e "individuais" com "individual". */
function radical(p: string) {
  if (p.length <= 3) return p;
  return p.replace(/ais$/, "al").replace(/oes$/, "ao").replace(/aes$/, "ao").replace(/s$/, "");
}

/** Palavras úteis da consulta, já normalizadas. */
export function palavrasDaBusca(consulta: string) {
  return normalizar(consulta)
    .split(" ")
    .filter((p) => p.length > 1 && !VAZIAS.has(p))
    .map(radical);
}

/**
 * Busca por pontuação: cada palavra vale mais na pergunta e nos sinônimos do que
 * no texto. Entra o tópico que casar com a maior parte das palavras digitadas.
 */
export function buscar(consulta: string, secoes: Secao[]): Resultado[] {
  const palavras = palavrasDaBusca(consulta);
  if (!palavras.length) return [];
  const minimo = Math.max(1, Math.ceil(palavras.length * 0.6));

  const resultados: Resultado[] = [];
  for (const secao of secoes) {
    for (const topico of secao.topicos) {
      const titulo = normalizar(topico.pergunta);
      const termos = normalizar((topico.termos ?? []).join(" | "));
      const corpo = normalizar(
        [topico.resposta, ...(topico.passos ?? []), topico.dica ?? "", secao.titulo].join(" "),
      );
      let pontos = 0;
      let casadas = 0;
      for (const p of palavras) {
        const naPergunta = titulo.includes(p);
        const nosTermos = termos.includes(p);
        const noCorpo = corpo.includes(p);
        if (naPergunta || nosTermos || noCorpo) casadas++;
        pontos += (naPergunta ? 3 : 0) + (nosTermos ? 3 : 0) + (noCorpo ? 1 : 0);
      }
      // Frase exata nos sinônimos ("coluna individual") vale bônus.
      const frase = palavras.join(" ");
      if (palavras.length > 1 && (termos.includes(frase) || titulo.includes(frase))) pontos += 6;
      if (casadas >= minimo) resultados.push({ secao, topico, pontos: pontos + casadas * 2 });
    }
  }
  return resultados.sort((a, b) => b.pontos - a.pontos);
}
