import { useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarCheck,
  CalendarOff,
  CalendarRange,
  CheckCircle2,
  Clock,
  Download,
  Gauge,
  Info,
  ListTodo,
  RefreshCw,
  ShieldCheck,
  Timer,
  UserPlus,
  UserX,
} from "@/components/ui/icon";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useWorkspace } from "@/lib/thc/store";
import { useAuth } from "@/lib/thc/auth";
import { useStoredState } from "@/lib/thc/filters";
import { Avatar, ProgressBar } from "@/components/thc/atoms";
import { BotaoAtualizar } from "@/components/thc/BotaoAtualizar";
import { EVENT_STATUS_KEY, PRIORITIES, type Task } from "@/lib/thc/types";
import { baixarXlsx, type Celula } from "@/lib/thc/xlsx";
import { daysUntil, formatDate, isDoneStatus, isOverdue, todayISO } from "@/lib/thc/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — TH Flow" },
      {
        name: "description",
        content: "Métricas globais de tarefas, atrasos, produtividade e entregas da operação.",
      },
      { property: "og:title", content: "Dashboard — TH Flow" },
      {
        property: "og:description",
        content: "Acompanhe tarefas, atrasos, gráficos e carga do time em tempo real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const METRIC_RITMO = "Considera as tarefas criadas no período selecionado no filtro de datas.";
const METRIC_CONCLUIDAS =
  "Tarefas concluídas dentro do período, pela data de conclusão: entregues na coluna de entrega ou marcadas como concluídas, mesmo que tenham sido criadas antes.";

/** Cores dos solicitantes no painel de áreas (paleta da identidade). */
const CORES_SOLICITANTES = [
  "#eab343",
  "#293785",
  "#7abba2",
  "#85b645",
  "#d0574a",
  "#9a9cb0",
  "#c98a2e",
  "#4a5be0",
];

type Periodo = 7 | 30 | 90 | 365 | "personalizado";

const isoLocal = (d: Date) => format(d, "yyyy-MM-dd");

function Metric({
  icon: Icon,
  label,
  value,
  tone,
  info,
  destaque,
}: {
  icon: typeof ListTodo;
  label: string;
  value: string | number;
  tone?: string;
  info?: string;
  /** Card de destaque visual (sólido em azul escuro ou amarelo). */
  destaque?: "escuro" | "amarelo";
}) {
  return (
    <div
      className={cn(
        "panel flex flex-col p-4 sm:p-5",
        destaque === "escuro" && "border-transparent !bg-highlight text-white",
        destaque === "amarelo" && "border-transparent !bg-primary text-primary-foreground",
      )}
    >
      <div
        className={cn(
          "flex items-start gap-2.5",
          destaque ? "opacity-90" : "text-muted-foreground",
        )}
      >
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full",
            destaque ? "bg-white/15" : "bg-surface",
          )}
        >
          <Icon className="size-[18px]" style={tone && !destaque ? { color: tone } : undefined} />
        </span>
        <span className="min-w-0 flex-1 pt-1.5 text-[12.5px] font-medium leading-snug">
          {label}
        </span>
        {info && <InfoTip text={info} />}
      </div>
      <p className="mt-3 text-[34px] font-light leading-none tracking-[-0.03em] sm:mt-4 sm:text-[46px]">
        {value}
      </p>
    </div>
  );
}

/** Balão de hover dos gráficos: fundo escuro e texto branco em qualquer tema. */
const tooltipStyle = {
  background: "#23254d",
  border: "none",
  borderRadius: 14,
  boxShadow: "0 12px 30px -12px rgb(0 0 0 / 0.45)",
  fontSize: 12,
  color: "#fff",
} as const;

/** Rótulos dos eixos acompanham o tema ativo. */
const axisTick = { fill: "var(--muted-foreground)", fontSize: 11 } as const;

/** Ícone de informação com tooltip explicativo, legível em qualquer tema. */
function InfoTip({ text }: { text: string }) {
  return (
    <UITooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Informação"
          className="shrink-0 pt-1 opacity-60 transition-opacity hover:opacity-100"
        >
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] text-left leading-snug">
        {text}
      </TooltipContent>
    </UITooltip>
  );
}

function Panel({
  title,
  info,
  children,
}: {
  title: string;
  info?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel p-6">
      <h2 className="flex items-center gap-2 text-[19px] font-normal tracking-[-0.01em]">
        {title}
        {info && <InfoTip text={info} />}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Dashboard() {
  const celular = useIsMobile();
  const { tasks, statuses, profiles, projects } = useWorkspace();
  const { userId, isGestor } = useAuth();
  const [periodo, setPeriodo] = useState<Periodo>(30);
  /** Período personalizado (datas em yyyy-MM-dd), usado quando periodo = "personalizado". */
  const [intervalo, setIntervalo] = useState<{ de: string; ate: string } | null>(null);
  const personalizado = periodo === "personalizado" && !!intervalo;
  const [escopo, setEscopo] = useStoredState<"equipe" | "individual">(
    "thc-dashboard-escopo",
    "equipe",
  );
  const [membroSalvo, setMembroSalvo] = useStoredState<string>("thc-dashboard-membro", "");

  /** Membros só podem ver o próprio desempenho. */
  const membroId = isGestor ? membroSalvo || userId || "" : (userId ?? "");
  const membro = profiles.find((p) => p.id === membroId) ?? null;
  const individual = escopo === "individual";

  const isEvento = (status: string) => status === EVENT_STATUS_KEY || status === "eventos";
  /** Tarefas de trabalho: eventos têm indicadores próprios e ficam fora das contas. */
  const tarefas = useMemo(() => tasks.filter((t) => !isEvento(t.status)), [tasks]);

  /** Concluída = está na coluna de entrega OU recebeu o tick de concluída. */
  const concluida = (t: Task) => isDoneStatus(t.status, statuses) || !!t.is_completed;
  const atrasada = (t: Task) => !concluida(t) && isOverdue(t, statuses);

  /** Base de cálculo: toda a operação ou apenas as tarefas do membro. */
  const base = useMemo(
    () =>
      individual && membroId ? tarefas.filter((t) => t.usuario_id.includes(membroId)) : tarefas,
    [tarefas, individual, membroId],
  );

  /** Limites do período: últimos N dias até hoje, ou o intervalo personalizado. */
  const { inicioPeriodo, fimPeriodo } = useMemo(() => {
    if (personalizado && intervalo) {
      return {
        inicioPeriodo: new Date(`${intervalo.de}T00:00:00`),
        fimPeriodo: new Date(`${intervalo.ate}T23:59:59.999`),
      };
    }
    const ini = new Date();
    ini.setHours(0, 0, 0, 0);
    // "Últimos N dias" inclui hoje: hoje e os N - 1 dias anteriores.
    ini.setDate(ini.getDate() - ((typeof periodo === "number" ? periodo : 30) - 1));
    const fim = new Date();
    fim.setHours(23, 59, 59, 999);
    return { inicioPeriodo: ini, fimPeriodo: fim };
  }, [periodo, personalizado, intervalo]);

  const criadaNoPeriodo = (t: Task) => {
    if (!t.created_at) return true;
    const d = new Date(t.created_at);
    return d >= inicioPeriodo && d <= fimPeriodo;
  };

  /** Tarefas criadas dentro do período: base de todos os indicadores. */
  const noPeriodo = useMemo(
    () => base.filter(criadaNoPeriodo),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, inicioPeriodo, fimPeriodo],
  );

  /** Concluídas no período pela data de conclusão, independentemente de quando foram criadas. */
  const done = base.filter((t) => {
    if (!concluida(t) || !t.concluida_em) return false;
    const d = new Date(t.concluida_em);
    return d >= inicioPeriodo && d <= fimPeriodo;
  });
  /** Das tarefas criadas no período, as que já foram concluídas (base da taxa). */
  const doneDoPeriodo = noPeriodo.filter(concluida);
  const overdue = noPeriodo.filter(atrasada);
  const week = noPeriodo.filter((t) => {
    const d = daysUntil(t.data_vencimento);
    return d !== null && d >= 0 && d <= 7 && !concluida(t);
  });

  /** Lista operacional de atrasos/próximas entregas: sempre a situação atual. */
  const overdueAgora = base.filter(atrasada);
  const weekAgora = base.filter((t) => {
    const d = daysUntil(t.data_vencimento);
    return d !== null && d >= 0 && d <= 7 && !concluida(t);
  });

  const porStatus = statuses.map((s) => ({
    name: s.label,
    value: noPeriodo.filter((t) => t.status === s.chave).length,
    cor: s.cor,
  }));

  const porPrioridade = PRIORITIES.map((p) => ({
    name: p.label,
    value: noPeriodo.filter((t) => t.prioridade === p.id).length,
    cor: p.color,
  }));

  const porPessoa = profiles
    .map((p) => ({
      name: p.nome.split(" ")[0] ?? p.nome,
      value: tarefas.filter((t) => t.usuario_id.includes(p.id) && !concluida(t)).length,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  /** Solicitações por área, com quem pediu dentro de cada área, no período. */
  const porArea = useMemo(() => {
    const mapa = new Map<string, Map<string, number>>();
    for (const t of noPeriodo) {
      const area = (t.area ?? "").trim();
      if (!area) continue;
      const pessoa = (t.solicitante ?? "").trim() || "Sem solicitante";
      const pessoas = mapa.get(area) ?? new Map<string, number>();
      pessoas.set(pessoa, (pessoas.get(pessoa) ?? 0) + 1);
      mapa.set(area, pessoas);
    }
    return [...mapa.entries()]
      .map(([name, pessoas]) => ({
        name,
        value: [...pessoas.values()].reduce((s, n) => s + n, 0),
        pessoas: [...pessoas.entries()]
          .map(([nome, qtd]) => ({ nome, qtd }))
          .sort((a, b) => b.qtd - a.qtd),
      }))
      .sort((a, b) => b.value - a.value);
  }, [noPeriodo]);

  /** Uma cor fixa por solicitante (mais frequente primeiro). */
  const corSolicitante = useMemo(() => {
    const totais = new Map<string, number>();
    for (const a of porArea)
      for (const p of a.pessoas) totais.set(p.nome, (totais.get(p.nome) ?? 0) + p.qtd);
    const ordem = [...totais.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
    return (nome: string) =>
      nome === "Sem solicitante"
        ? "var(--muted-foreground)"
        : CORES_SOLICITANTES[ordem.indexOf(nome) % CORES_SOLICITANTES.length];
  }, [porArea]);
  const maiorArea = porArea[0]?.value ?? 0;

  /** Concluídas acumuladas por semana dentro do período. */
  const burnup = useMemo(() => {
    const dias = Math.max(
      1,
      Math.round((fimPeriodo.getTime() - inicioPeriodo.getTime()) / 86_400_000),
    );
    const semanas = Math.max(1, Math.round(dias / 7));
    const pontos: { name: string; value: number }[] = [];
    let acumulado = 0;
    for (let i = semanas - 1; i >= 0; i--) {
      const fim = new Date(fimPeriodo);
      fim.setDate(fim.getDate() - i * 7);
      const inicio = new Date(fim);
      inicio.setDate(inicio.getDate() - 7);
      const n = base.filter(
        (t) =>
          concluida(t) &&
          t.concluida_em &&
          new Date(t.concluida_em) > inicio &&
          new Date(t.concluida_em) <= fim,
      ).length;
      acumulado += n;
      pontos.push({
        name: fim.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        value: acumulado,
      });
    }
    return pontos;
  }, [base, inicioPeriodo, fimPeriodo]);

  const porQuadro = projects
    .map((p) => {
      const doQuadro = base.filter((t) => t.board_id === p.id || t.projeto_id === p.id);
      const concl = doQuadro.filter(concluida).length;
      return {
        id: p.id,
        nome: p.nome,
        total: doQuadro.length,
        concl,
        pct: doQuadro.length ? Math.round((concl / doQuadro.length) * 100) : 0,
      };
    })
    .filter((p) => p.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const taxa = noPeriodo.length ? Math.round((doneDoPeriodo.length / noPeriodo.length) * 100) : 0;

  const tempoMedio = (() => {
    const amostras = done
      .filter((t) => t.concluida_em && t.created_at)
      .map(
        (t) =>
          (new Date(t.concluida_em!).getTime() - new Date(t.created_at!).getTime()) / 86_400_000,
      );
    if (!amostras.length) return "—";
    const media = amostras.reduce((a, b) => a + b, 0) / amostras.length;
    return `${media.toFixed(1)} d`;
  })();

  const semResponsavel = noPeriodo.filter((t) => !t.usuario_id.length && !concluida(t)).length;
  const semData = noPeriodo.filter((t) => !t.data_vencimento && !concluida(t)).length;

  /** Entregas no prazo: concluídas do período cuja conclusão não passou da data de entrega. */
  const comPrazo = done.filter((t) => t.data_vencimento && t.concluida_em);
  // Compara no dia local (uma conclusão às 22h não pode virar o dia seguinte em UTC).
  const noPrazo = comPrazo.filter(
    (t) => isoLocal(new Date(t.concluida_em!)) <= t.data_vencimento!.slice(0, 10),
  ).length;
  const pctNoPrazo = comPrazo.length ? `${Math.round((noPrazo / comPrazo.length) * 100)}%` : "—";

  /** Tarefas do período que já foram replanejadas ao menos uma vez (V2 ou mais). */
  const replanejadas = noPeriodo.filter((t) => (t.versao ?? 0) >= 2).length;

  const criadasPorMim = tarefas.filter(
    (t) => t.criador_id === membroId && criadaNoPeriodo(t),
  ).length;

  const v6Tasks = useMemo(() => noPeriodo.filter((t) => t.versao === 6), [noPeriodo]);

  /** Distribuição de demandas por canal (tags cadastradas nas tarefas). */
  const porTag = useMemo(() => {
    const mapa = new Map<string, { name: string; value: number; cor: string }>();
    for (const t of noPeriodo) {
      for (const tag of t.tags ?? []) {
        const nome = (tag?.nome ?? "").trim();
        if (!nome) continue;
        const atual = mapa.get(nome.toLowerCase());
        if (atual) atual.value += 1;
        else
          mapa.set(nome.toLowerCase(), {
            name: nome,
            value: 1,
            cor: tag.cor || "var(--primary)",
          });
      }
    }
    return [...mapa.values()].sort((a, b) => b.value - a.value).slice(0, 10);
  }, [noPeriodo]);

  /** Eventos: tarefas na coluna global de Eventos. Data passada = já aconteceu. */
  const eventos = useMemo(() => tasks.filter((t) => isEvento(t.status)), [tasks]);
  const hoje = todayISO();
  const dataEvento = (t: (typeof eventos)[number]) => t.data_vencimento ?? t.evento_inicio ?? null;
  const eventosFuturos = eventos.filter((t) => {
    const d = dataEvento(t);
    return !!d && d >= hoje;
  });
  /** Histórico de eventos: ano vigente por padrão; no período personalizado, só o intervalo escolhido. */
  const anoAtual = new Date().getFullYear();
  const noHistorico = (t: (typeof eventos)[number]) => {
    const d = dataEvento(t);
    if (!d) return false;
    if (personalizado && intervalo) return d >= intervalo.de && d <= intervalo.ate;
    return d.slice(0, 4) === String(anoAtual);
  };
  const eventosHistorico = eventos.filter(noHistorico);
  const eventosPassados = eventosHistorico.filter((t) => (dataEvento(t) ?? "") < hoje).length;

  /** Progresso por campanha/evento: tarefas relacionadas por tag ou título do evento. */
  const campanhas = useMemo(() => {
    const norm = (s: string) => s.toLowerCase().trim();
    return eventos
      .map((ev) => {
        const alvo = norm(ev.titulo);
        const rel = base.filter(
          (t) => !isEvento(t.status) && (t.tags ?? []).some((tg) => norm(tg?.nome ?? "") === alvo),
        );
        const passou = (() => {
          const d = dataEvento(ev);
          return !!d && d < hoje;
        })();
        const concl = rel.filter(concluida).length;
        const total = rel.length;
        const pct = total ? Math.round((concl / total) * 100) : passou ? 100 : 0;
        return {
          id: ev.id,
          nome: ev.titulo,
          data: dataEvento(ev),
          inicio: ev.evento_inicio,
          passou,
          concl,
          total,
          pct,
          historico: noHistorico(ev),
        };
      })
      .filter((c) => !c.passou || c.historico)
      .sort(
        (a, b) => Number(a.passou) - Number(b.passou) || (a.data ?? "").localeCompare(b.data ?? ""),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventos, base, statuses, hoje, personalizado, intervalo]);

  const nomeQuadro = (id: string | null | undefined) =>
    projects.find((p) => p.id === id)?.nome ?? "—";

  const rotuloPeriodo =
    personalizado && intervalo
      ? `${formatDate(intervalo.de)} a ${formatDate(intervalo.ate)}`
      : periodo === 365
        ? "Últimos 12 meses"
        : `Últimos ${periodo} dias`;

  /** Planilha com os números do painel (equipe ou membro selecionado) para apresentações. */
  const exportar = () => {
    const nomePessoa = (id: string) => profiles.find((p) => p.id === id)?.nome ?? "";
    const statusLabel = (chave: string) => statuses.find((s) => s.chave === chave)?.label ?? chave;
    const prioridadeLabel = (id: string) => PRIORITIES.find((p) => p.id === id)?.label ?? id;
    const data = (v: string | null | undefined) =>
      v ? format(new Date(`${v.slice(0, 10)}T00:00:00`), "dd/MM/yyyy") : "";

    const resumo: Celula[][] = [
      ["Indicador", "Valor"],
      ["Visão", individual ? `Individual · ${membro?.nome ?? ""}` : "Equipe"],
      ["Período", rotuloPeriodo],
      ["Gerado em", format(new Date(), "dd/MM/yyyy HH:mm")],
      ["Tarefas", noPeriodo.length],
      ["Concluídas no período", done.length],
      ["Próximos 7 dias", week.length],
      ["Atrasadas", overdue.length],
      ["Taxa de conclusão (%)", taxa],
      ["Tempo médio de conclusão", tempoMedio],
      individual ? ["Criadas pelo membro", criadasPorMim] : ["Sem responsável", semResponsavel],
      ["Sem data de entrega", semData],
      ["Entregas no prazo", pctNoPrazo],
      ["Replanejadas (V2+)", replanejadas],
      ["Eventos futuros", eventosFuturos.length],
      [`Eventos ${personalizado ? "no período" : `em ${anoAtual}`}`, eventosHistorico.length],
      ["Eventos já realizados", eventosPassados],
    ];

    const linhasTarefas: Celula[][] = [
      [
        "Título",
        "Status",
        "Prioridade",
        "Quadro",
        "Projeto",
        "Área solicitante",
        "Solicitante",
        "Responsáveis",
        "Criada em",
        "Entrega",
        "Concluída em",
        "Versão",
        "Tags",
      ],
      ...noPeriodo.map((t) => [
        t.titulo,
        statusLabel(t.status),
        prioridadeLabel(t.prioridade),
        t.board_id ? nomeQuadro(t.board_id) : "",
        t.projeto_id ? nomeQuadro(t.projeto_id) : "",
        t.area ?? "",
        t.solicitante ?? "",
        t.usuario_id.map(nomePessoa).filter(Boolean).join(", "),
        data(t.created_at),
        data(t.data_vencimento),
        data(t.concluida_em),
        t.versao != null ? `V${t.versao}` : "",
        (t.tags ?? []).map((tg) => tg.nome).join(", "),
      ]),
    ];

    const solicitacoes: Celula[][] = [
      ["Área", "Solicitante", "Solicitações"],
      ...porArea.flatMap((a) => a.pessoas.map((p) => [a.name, p.nome, p.qtd] as Celula[])),
    ];

    const pessoasAbas: Celula[][] = [
      ["Membro", "Tarefas no período", "Concluídas", "Atrasadas", "Abertas hoje"],
      ...profiles.map((p) => {
        const doMembro = noPeriodo.filter((t) => t.usuario_id.includes(p.id));
        return [
          p.nome,
          doMembro.length,
          done.filter((t) => t.usuario_id.includes(p.id)).length,
          doMembro.filter(atrasada).length,
          tarefas.filter((t) => t.usuario_id.includes(p.id) && !concluida(t)).length,
        ];
      }),
    ];

    const eventosAba: Celula[][] = [
      ["Evento", "Início", "Fim", "Situação", "Tarefas vinculadas", "Concluídas", "Progresso (%)"],
      ...campanhas.map((c) => [
        c.nome,
        data(c.inicio ?? c.data),
        data(c.data),
        c.passou ? "Realizado" : "A acontecer",
        c.total,
        c.concl,
        c.pct,
      ]),
    ];

    const abas = [
      { nome: "Resumo", linhas: resumo },
      { nome: "Tarefas", linhas: linhasTarefas },
      {
        nome: "Por status",
        linhas: [["Status", "Tarefas"], ...porStatus.map((s) => [s.name, s.value])],
      },
      {
        nome: "Por prioridade",
        linhas: [["Prioridade", "Tarefas"], ...porPrioridade.map((p) => [p.name, p.value])],
      },
      { nome: "Solicitações por área", linhas: solicitacoes },
      ...(individual ? [] : [{ nome: "Por membro", linhas: pessoasAbas }]),
      { nome: "Tags", linhas: [["Tag", "Tarefas"], ...porTag.map((t) => [t.name, t.value])] },
      { nome: "Eventos", linhas: eventosAba },
      {
        nome: "Progresso por quadro",
        linhas: [
          ["Quadro", "Tarefas", "Concluídas", "Progresso (%)"],
          ...porQuadro.map((q) => [q.nome, q.total, q.concl, q.pct]),
        ],
      },
    ];
    const sufixo = individual ? (membro?.nome ?? "membro") : "equipe";
    baixarXlsx(
      `th-flow-dashboard-${sufixo}-${format(new Date(), "yyyy-MM-dd")}`
        .toLowerCase()
        .replace(/\s+/g, "-"),
      abas,
    );
  };

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col">
        <header className="flex flex-wrap items-end justify-between gap-3 px-4 py-4 md:px-8 md:py-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Visão macro
            </p>
            <h1 className="mt-1 text-[30px] font-light leading-[1.05] tracking-[-0.02em] md:text-[44px]">
              Dashboard
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <BotaoAtualizar className="max-md:size-[46px]" />
            <div className="flex items-center gap-0.5 rounded-full border border-[var(--glass-border)] bg-surface p-1">
              {(["equipe", "individual"] as const).map((e) => (
                <button
                  key={e}
                  onClick={() => setEscopo(e)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-[12px] fluid max-md:h-9",
                    escopo === e
                      ? "bg-selected text-selected-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {e === "equipe" ? "Equipe" : "Individual"}
                </button>
              ))}
            </div>
            {individual && isGestor && (
              <select
                value={membroId}
                onChange={(ev) => setMembroSalvo(ev.target.value)}
                className="h-9 rounded-full border border-[var(--glass-border)] bg-surface px-3.5 text-[12px] outline-none"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex min-w-0 items-center gap-2 max-md:w-full">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-muted-foreground max-md:hidden">
              Filtrar por:
            </span>
            <div className="sem-barra flex items-center gap-0.5 overflow-x-auto rounded-full border border-[var(--glass-border)] bg-surface p-1 max-md:w-full">
              {([7, 30, 90, 365] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setPeriodo(d)}
                  className={cn(
                    "shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12px] fluid max-md:h-9",
                    periodo === d
                      ? "bg-selected text-selected-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {d === 365 ? "Anual" : `${d} dias`}
                </button>
              ))}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12px] fluid max-md:h-9",
                      personalizado
                        ? "bg-selected text-selected-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <CalendarRange className="size-3.5" />
                    {personalizado && intervalo
                      ? `${formatDate(intervalo.de)} – ${formatDate(intervalo.ate)}`
                      : "Personalizado"}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto p-0">
                  <p className="px-3 pt-3 text-[11.5px] text-muted-foreground">
                    Escolha o primeiro e o último dia do período.
                  </p>
                  <Calendar
                    mode="range"
                    numberOfMonths={celular ? 1 : 2}
                    defaultMonth={
                      new Date(
                        new Date().getFullYear(),
                        new Date().getMonth() - (celular ? 0 : 1),
                        1,
                      )
                    }
                    selected={
                      intervalo
                        ? {
                            from: new Date(`${intervalo.de}T00:00:00`),
                            to: new Date(`${intervalo.ate}T00:00:00`),
                          }
                        : undefined
                    }
                    onSelect={(r) => {
                      if (!r?.from) return;
                      setIntervalo({ de: isoLocal(r.from), ate: isoLocal(r.to ?? r.from) });
                      setPeriodo("personalizado");
                    }}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-auto px-4 py-4 md:px-8 md:py-6 rise-in">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <Metric
              icon={ListTodo}
              label="Tarefas"
              value={noPeriodo.length}
              info={METRIC_RITMO}
              destaque="escuro"
            />
            <Metric
              icon={CheckCircle2}
              label="Concluídas"
              value={done.length}
              tone="var(--success)"
              info={METRIC_CONCLUIDAS}
            />
            <Metric
              icon={Clock}
              label="Próximos 7 dias"
              value={week.length}
              tone="var(--warning)"
              info={METRIC_RITMO}
            />
            <Metric
              icon={AlertTriangle}
              label="Atrasadas"
              value={overdue.length}
              tone="var(--destructive)"
              info={METRIC_RITMO}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <Metric
              icon={Gauge}
              label="Taxa de conclusão"
              value={`${taxa}%`}
              info={METRIC_RITMO}
              destaque="amarelo"
            />
            <Metric icon={Timer} label="Tempo médio" value={tempoMedio} info={METRIC_RITMO} />
            {individual ? (
              <Metric
                icon={UserPlus}
                label="Criadas por mim"
                value={criadasPorMim}
                info="Total de tarefas criadas por você no período do filtro."
              />
            ) : (
              <Metric
                icon={UserX}
                label="Sem responsável"
                value={semResponsavel}
                info="Tarefas ativas que ainda não têm nenhum responsável atribuído."
              />
            )}
            <Metric
              icon={CalendarOff}
              label="Sem data de entrega"
              value={semData}
              info="Tarefas ativas que estão sem data limite definida no cronograma."
            />
            <Metric
              icon={CalendarCheck}
              label="Eventos futuros"
              value={eventosFuturos.length}
              tone="var(--warning)"
              info="Eventos cadastrados no fluxo cuja data ainda não chegou."
            />
            <Metric
              icon={CalendarRange}
              label={`Eventos ${personalizado ? "no período" : `em ${anoAtual}`} · ${eventosPassados} já realizados`}
              value={eventosHistorico.length}
              info={
                personalizado
                  ? "Eventos com data dentro do período personalizado, incluindo os já realizados."
                  : `Eventos com data em ${anoAtual}, incluindo os já realizados. Use o período personalizado para ver outros anos.`
              }
            />
            <Metric
              icon={ShieldCheck}
              label="Entregas no prazo"
              value={pctNoPrazo}
              tone="var(--success)"
              info="Das tarefas concluídas no período que tinham data de entrega, quantas foram finalizadas até essa data."
            />
            <Metric
              icon={RefreshCw}
              label="Replanejadas"
              value={replanejadas}
              tone="var(--destructive)"
              info="Tarefas do período que já tiveram a entrega replanejada ao menos uma vez (versão V2 ou maior)."
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Panel
              title="Tarefas por status"
              info="Distribuição percentual e quantitativa do volume de trabalho dividido pelas etapas do fluxo ou níveis de urgência."
            >
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={porStatus}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={78}
                      outerRadius={92}
                      paddingAngle={4}
                      cornerRadius={99}
                      stroke="none"
                    >
                      {porStatus.map((s) => (
                        <Cell key={s.name} fill={s.cor} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                {porStatus.map((s) => (
                  <span key={s.name} className="flex items-center gap-1.5 text-[11.5px]">
                    <span className="size-2 rounded-full" style={{ background: s.cor }} />
                    {s.name} · {s.value}
                  </span>
                ))}
              </div>
            </Panel>

            <Panel
              title="Tarefas por prioridade"
              info="Distribuição percentual e quantitativa do volume de trabalho dividido pelas etapas do fluxo ou níveis de urgência."
            >
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={porPrioridade}>
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={axisTick} />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      tick={axisTick}
                    />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--surface)" }} />
                    <Bar dataKey="value" radius={[99, 99, 99, 99]} barSize={16}>
                      {porPrioridade.map((p) => (
                        <Cell key={p.name} fill={p.cor} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            {individual ? (
              <Panel
                title="Resumo do membro"
                info="Síntese das tarefas abertas, atrasadas e concluídas do membro no período filtrado."
              >
                <div className="flex items-center gap-3">
                  <Avatar user={membro} size={44} />
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold">{membro?.nome ?? "—"}</p>
                    <p className="text-[12px] text-muted-foreground">{membro?.cargo ?? ""}</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: "Abertas", value: noPeriodo.length - doneDoPeriodo.length },
                    { label: "Atrasadas", value: overdue.length },
                    { label: "Concluídas", value: done.length },
                  ].map((i) => (
                    <div key={i.label} className="rounded-2xl bg-surface py-4">
                      <p className="text-[32px] font-light leading-none tracking-[-0.02em]">
                        {i.value}
                      </p>
                      <p className="mt-1.5 text-[11.5px] text-muted-foreground">{i.label}</p>
                    </div>
                  ))}
                </div>
              </Panel>
            ) : (
              <Panel
                title="Tarefas abertas por responsável"
                info="Visão geral da distribuição de tarefas ativas e carga de trabalho por membro da equipe."
              >
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={porPessoa} layout="vertical" margin={{ left: 8 }}>
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                        tick={axisTick}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={80}
                        tickLine={false}
                        axisLine={false}
                        tick={axisTick}
                      />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--surface)" }} />
                      <Bar
                        dataKey="value"
                        fill="var(--primary)"
                        radius={[99, 99, 99, 99]}
                        barSize={12}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            )}

            <Panel
              title={`Solicitações por área · ${porArea.reduce((s, a) => s + a.value, 0)}`}
              info="Demandas de cada área solicitante no período, com quantas vieram de cada pessoa."
            >
              {porArea.length ? (
                <div className="max-h-[300px] space-y-5 overflow-y-auto pr-1">
                  {porArea.map((a) => (
                    <div key={a.name}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate text-[13.5px] font-medium">{a.name}</span>
                        <span className="shrink-0 text-[12px] text-muted-foreground">
                          <span className="text-[20px] font-light text-foreground">{a.value}</span>{" "}
                          {a.value === 1 ? "solicitação" : "solicitações"}
                        </span>
                      </div>
                      {/* Barra proporcional ao volume da área, dividida por solicitante. */}
                      <div className="mt-2 h-2.5 rounded-full bg-surface">
                        <div
                          className="flex h-full gap-0.5 overflow-hidden rounded-full"
                          style={{ width: `${maiorArea ? (a.value / maiorArea) * 100 : 0}%` }}
                        >
                          {a.pessoas.map((p) => (
                            <span
                              key={p.nome}
                              title={`${p.nome} · ${p.qtd}`}
                              className="h-full first:rounded-l-full last:rounded-r-full"
                              style={{ flexGrow: p.qtd, background: corSolicitante(p.nome) }}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {a.pessoas.map((p) => (
                          <span
                            key={p.nome}
                            className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[11.5px]"
                          >
                            <span
                              className="size-2 rounded-full"
                              style={{ background: corSolicitante(p.nome) }}
                            />
                            {p.nome}
                            <span className="font-semibold">{p.qtd}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-[12px] text-muted-foreground">
                  Nenhuma área solicitante registrada no período.
                </p>
              )}
            </Panel>

            <Panel
              title="Entregas acumuladas (burn-up)"
              info="Gráfico de progresso acumulado das entregas realizadas dia a dia ao longo do período filtrado."
            >
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={burnup}>
                    <defs>
                      <linearGradient id="burnup" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={axisTick} />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      tick={axisTick}
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="var(--primary)"
                      strokeWidth={3}
                      fill="url(#burnup)"
                      activeDot={{
                        r: 6,
                        fill: "var(--selected)",
                        stroke: "var(--card)",
                        strokeWidth: 3,
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel
              title={`Demandas por canal (tags) · ${porTag.reduce((s, t) => s + t.value, 0)}`}
              info="Calcula o mix de foco do marketing somando as tags cadastradas nas tarefas ativas do período."
            >
              {porTag.length ? (
                <>
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={porTag}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={78}
                          outerRadius={92}
                          paddingAngle={4}
                          cornerRadius={99}
                          stroke="none"
                        >
                          {porTag.map((t) => (
                            <Cell key={t.name} fill={t.cor} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                    {porTag.map((t) => (
                      <span key={t.name} className="flex items-center gap-1.5 text-[11.5px]">
                        <span className="size-2 rounded-full" style={{ background: t.cor }} />
                        {t.name} · {t.value}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="py-8 text-center text-[12px] text-muted-foreground">
                  Nenhuma tag registrada no período.
                </p>
              )}
            </Panel>

            <Panel
              title={`Campanhas e eventos · ${eventosFuturos.length} a acontecer`}
              info="Mostra o progresso percentual de conclusão das tarefas vinculadas a cada campanha ou evento sazonal."
            >
              <div className="space-y-2.5">
                {campanhas.map((c) => (
                  <div key={c.id} className={cn(c.passou && "opacity-60")}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-[12px]">
                      <span className="min-w-0 truncate">
                        {c.nome}
                        {c.passou && (
                          <span className="ml-1.5 text-muted-foreground">· realizado</span>
                        )}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {c.inicio && c.inicio !== c.data ? `${formatDate(c.inicio)} – ` : ""}
                        {formatDate(c.data)} · {c.concl}/{c.total} · {c.pct}%
                      </span>
                    </div>
                    <ProgressBar pct={c.pct} />
                  </div>
                ))}
                {!campanhas.length && (
                  <p className="py-8 text-center text-[12px] text-muted-foreground">
                    Nenhum evento ou campanha cadastrada.
                  </p>
                )}
              </div>
            </Panel>
            <Panel
              title="Progresso por quadro"
              info="Percentual de conclusão das tarefas em cada quadro ou projeto da operação."
            >
              <div className="space-y-2.5">
                {porQuadro.map((p) => (
                  <div key={p.id}>
                    <div className="mb-1 flex items-center justify-between text-[12px]">
                      <span className="truncate">{p.nome}</span>
                      <span className="text-muted-foreground">
                        {p.concl}/{p.total} · {p.pct}%
                      </span>
                    </div>
                    <ProgressBar pct={p.pct} />
                  </div>
                ))}
                {!porQuadro.length && (
                  <p className="text-[12px] text-muted-foreground">Nenhuma tarefa nos quadros.</p>
                )}
              </div>
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {!individual && (
              <Panel
                title="Tarefas por pessoa"
                info="Visão geral da distribuição de tarefas ativas e carga de trabalho por membro da equipe."
              >
                <div className="space-y-2">
                  {profiles.map((p) => {
                    const abertas = tarefas.filter(
                      (t) => t.usuario_id.includes(p.id) && !concluida(t),
                    ).length;
                    return (
                      <div key={p.id} className="flex items-center gap-2 text-[12.5px]">
                        <Avatar user={p} size={24} />
                        <span className="flex-1 truncate">{p.nome}</span>
                        <span className="text-muted-foreground">{abertas} abertas</span>
                      </div>
                    );
                  })}
                  {!profiles.length && (
                    <p className="text-[12px] text-muted-foreground">Nenhum membro cadastrado.</p>
                  )}
                </div>
              </Panel>
            )}
          </div>

          <Panel
            title={`Tarefas replanejadas · ${v6Tasks.length}`}
            info="Tarefas que passaram por replanejamento e atingiram o nível máximo de replanejamento (V6)."
          >
            <div className="space-y-1.5">
              {v6Tasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-full border border-destructive/25 bg-destructive/5 px-4 py-2.5 text-[12.5px]"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{t.titulo}</span>
                  <span className="hidden shrink-0 text-[11.5px] text-muted-foreground sm:inline">
                    {nomeQuadro(t.board_id ?? t.projeto_id)}
                  </span>
                  <span className="flex shrink-0 -space-x-1.5">
                    {t.usuario_id.slice(0, 3).map((uid) => (
                      <Avatar
                        key={uid}
                        user={profiles.find((p) => p.id === uid) ?? null}
                        size={20}
                      />
                    ))}
                  </span>
                </div>
              ))}
              {v6Tasks.length === 0 && (
                <p className="text-[12px] text-muted-foreground">
                  Nenhuma tarefa precisou ser replanejada.
                </p>
              )}
            </div>
          </Panel>

          <Panel
            title="Atrasos e próximas entregas"
            info="Tarefas atrasadas ou com vencimento nos próximos 7 dias."
          >
            <div className="space-y-1.5">
              {[...overdueAgora, ...weekAgora].slice(0, 12).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-full bg-surface px-4 py-2.5 text-[12.5px]"
                >
                  <span className="min-w-0 flex-1 truncate">{t.titulo}</span>
                  <span className="hidden shrink-0 text-[11.5px] text-muted-foreground sm:inline">
                    {nomeQuadro(t.board_id ?? t.projeto_id)}
                  </span>
                  <span className="flex shrink-0 -space-x-1.5">
                    {t.usuario_id.slice(0, 3).map((uid) => (
                      <Avatar
                        key={uid}
                        user={profiles.find((p) => p.id === uid) ?? null}
                        size={20}
                      />
                    ))}
                  </span>
                  <span
                    className={cn(
                      "w-[86px] shrink-0 text-right text-[11.5px]",
                      atrasada(t) ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {formatDate(t.data_vencimento)}
                  </span>
                </div>
              ))}
              {!overdueAgora.length && !weekAgora.length && (
                <p className="text-[12px] text-muted-foreground">Nada urgente no radar.</p>
              )}
            </div>
          </Panel>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11.5px] text-muted-foreground">
              {projects.length} quadros ativos na operação.
            </p>
            {/* Exportação em planilha: exclusiva para administradores. */}
            {isGestor && (
              <button
                type="button"
                onClick={exportar}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-selected px-5 text-[13px] font-medium text-selected-foreground shadow-[var(--shadow-soft)] transition-opacity hover:opacity-90"
              >
                <Download className="size-[18px]" />
                Exportar dados
              </button>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
