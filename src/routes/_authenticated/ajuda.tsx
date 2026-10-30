import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  Columns3,
  Folder,
  Inbox,
  LayoutDashboard,
  Lightbulb,
  MessageSquare,
  NotebookPen,
  Package,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  User,
  Users,
  X,
} from "@/components/ui/icon";
import { useAuth } from "@/lib/thc/auth";
import {
  FAQ,
  SECOES,
  buscar,
  palavrasDaBusca,
  type IconeSecao,
  type Secao,
  type Topico,
} from "@/lib/ajuda/conteudo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ajuda")({
  validateSearch: (search: Record<string, unknown>): { topico?: string } =>
    typeof search["topico"] === "string" ? { topico: search["topico"] as string } : {},
  head: () => ({
    meta: [
      { title: "Como usar — TH Flow" },
      {
        name: "description",
        content:
          "Guia de uso e perguntas frequentes do TH Flow, com busca por como fazer cada coisa.",
      },
      { property: "og:title", content: "Como usar — TH Flow" },
      { property: "og:description", content: "Guia de uso e perguntas frequentes do TH Flow." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AjudaPage,
});

const ICONES: Record<IconeSecao, typeof Inbox> = {
  Inbox,
  Folder,
  User,
  Columns3,
  CalendarDays,
  CheckSquare,
  LayoutDashboard,
  Users,
  Package,
  NotebookPen,
  Bell,
  Trash2,
  Settings,
  MessageSquare,
};

const SUGESTOES = ["coluna individual", "criar projeto", "evento", "lembrete", "recuperar tarefa"];

function AjudaPage() {
  const { isGestor } = useAuth();
  const { topico: topicoUrl } = Route.useSearch();
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set(topicoUrl ? [topicoUrl] : []));

  // Tópicos de administrador só aparecem para administradores.
  const secoes = useMemo(() => {
    const visivel = (s: Secao) => ({
      ...s,
      topicos: s.topicos.filter((t) => !t.admin || isGestor),
    });
    return { guia: SECOES.map(visivel), faq: visivel(FAQ) };
  }, [isGestor]);
  const todas = useMemo(() => [...secoes.guia, secoes.faq], [secoes]);
  const resultados = useMemo(() => buscar(busca, todas), [busca, todas]);
  const buscando = palavrasDaBusca(busca).length > 0;

  // Link direto (/ajuda?topico=id): abre e rola até o tópico.
  useEffect(() => {
    if (!topicoUrl) return;
    setAbertos((a) => new Set(a).add(topicoUrl));
    const t = window.setTimeout(
      () =>
        document
          .getElementById(`topico-${topicoUrl}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      80,
    );
    return () => window.clearTimeout(t);
  }, [topicoUrl]);

  const alternar = (id: string) =>
    setAbertos((a) => {
      const n = new Set(a);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const irPara = (id: string) =>
    document.getElementById(`secao-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const abrirTopico = (id: string) => {
    setBusca("");
    void navigate({ to: "/ajuda", search: { topico: id }, replace: true });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        <header className="px-4 py-4 md:px-8 md:py-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Guia e FAQ
          </p>
          <h1 className="mt-1 text-[30px] font-light leading-[1.05] tracking-[-0.02em] md:text-[44px]">
            Como usar
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">
            Tudo o que o TH Flow faz, explicado passo a passo. Pesquise do jeito que você falaria,
            como "criar coluna individual" ou "recuperar tarefa".
          </p>

          <div className="relative mt-5 max-w-2xl">
            <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Como faço para…"
              aria-label="Pesquisar no guia"
              className="h-12 w-full rounded-full border border-[var(--glass-border)] bg-tile pl-12 pr-11 text-[14px] text-foreground shadow-[var(--shadow-soft)] outline-none transition-colors focus:border-primary/60"
            />
            {busca && (
              <button
                onClick={() => setBusca("")}
                aria-label="Limpar busca"
                className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground fluid hover:bg-surface hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          {!buscando && (
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  onClick={() => setBusca(s)}
                  className="rounded-full border border-[var(--glass-border)] bg-surface px-3 py-1 text-[12px] text-muted-foreground fluid hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </header>

        <div className="px-4 pb-10 md:px-8 rise-in">
          {buscando ? (
            <section className="max-w-3xl space-y-3">
              <p className="text-[12px] text-muted-foreground">
                {resultados.length
                  ? `${resultados.length} ${resultados.length === 1 ? "resposta encontrada" : "respostas encontradas"}`
                  : "Nada encontrado. Tente outras palavras ou veja os temas abaixo."}
              </p>
              {resultados.map(({ secao, topico }, i) => (
                <TopicoCard
                  key={`${secao.id}-${topico.id}`}
                  topico={topico}
                  rotulo={secao.titulo}
                  aberto={i < 2 || abertos.has(topico.id)}
                  onToggle={() => alternar(topico.id)}
                />
              ))}
              {!resultados.length && (
                <div className="grid gap-3 pt-2 sm:grid-cols-2">
                  {todas.map((s) => (
                    <CartaoSecao
                      key={s.id}
                      secao={s}
                      onClick={() => {
                        setBusca("");
                        window.setTimeout(() => irPara(s.id), 50);
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          ) : (
            <>
              <MapaOrganizacao onAbrir={abrirTopico} />

              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {todas.map((s) => (
                  <CartaoSecao key={s.id} secao={s} onClick={() => irPara(s.id)} />
                ))}
              </div>

              <div className="mt-10 max-w-3xl space-y-10">
                {todas.map((s) => {
                  const Icone = ICONES[s.icone];
                  return (
                    <section key={s.id} id={`secao-${s.id}`} className="scroll-mt-4">
                      <div className="mb-3 flex items-center gap-2.5">
                        <span className="grid size-9 place-items-center rounded-full bg-primary/15 text-primary-ink">
                          <Icone className="size-5" />
                        </span>
                        <div>
                          <h2 className="text-[22px] font-light leading-tight tracking-[-0.01em]">
                            {s.titulo}
                          </h2>
                          <p className="text-[12px] text-muted-foreground">{s.resumo}</p>
                        </div>
                      </div>
                      <div className="space-y-2.5">
                        {s.topicos.map((t) => (
                          <TopicoCard
                            key={t.id}
                            topico={t}
                            aberto={abertos.has(t.id)}
                            onToggle={() => alternar(t.id)}
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CartaoSecao({ secao, onClick }: { secao: Secao; onClick: () => void }) {
  const Icone = ICONES[secao.icone];
  return (
    <button
      onClick={onClick}
      className="panel group flex items-start gap-3 p-4 text-left fluid hover:-translate-y-0.5"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary-ink">
        <Icone className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold">{secao.titulo}</span>
        <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
          {secao.resumo}
        </span>
        <span className="mt-2 block text-[11px] font-medium text-muted-foreground">
          {secao.topicos.length} {secao.topicos.length === 1 ? "tópico" : "tópicos"}
        </span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

function TopicoCard({
  topico,
  rotulo,
  aberto,
  onToggle,
}: {
  topico: Topico;
  rotulo?: string;
  aberto: boolean;
  onToggle: () => void;
}) {
  return (
    <article id={`topico-${topico.id}`} className="panel scroll-mt-24 overflow-hidden">
      <button
        onClick={onToggle}
        aria-expanded={aberto}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left md:px-5"
      >
        <span className="min-w-0 flex-1">
          {rotulo && (
            <span className="mb-0.5 block text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {rotulo}
            </span>
          )}
          <span className="flex items-center gap-2 text-[14px] font-medium">
            {topico.pergunta}
            {topico.admin && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <ShieldCheck className="size-3" /> Admin
              </span>
            )}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-5 shrink-0 text-muted-foreground transition-transform",
            aberto && "rotate-180",
          )}
        />
      </button>
      {aberto && (
        <div className="space-y-3 px-4 pb-4 text-[13px] leading-relaxed md:px-5">
          <p className="text-foreground/85">{topico.resposta}</p>
          {topico.passos && (
            <ol className="space-y-2">
              {topico.passos.map((p, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[10.5px] font-semibold text-primary-foreground">
                    {i + 1}
                  </span>
                  <span className="text-foreground/85">{p}</span>
                </li>
              ))}
            </ol>
          )}
          {topico.dica && (
            <p className="flex gap-2 rounded-[16px] bg-surface-2 px-3 py-2.5 text-[12.5px] text-muted-foreground">
              <Lightbulb className="size-4 shrink-0 text-primary-ink" />
              <span>{topico.dica}</span>
            </p>
          )}
        </div>
      )}
    </article>
  );
}

/** Desenho de como uma tarefa é espelhada: Quadro Mãe, projeto e quadros individuais. */
function MapaOrganizacao({ onAbrir }: { onAbrir: (id: string) => void }) {
  const caixas = [
    {
      id: "quadro-mae",
      icone: Inbox,
      titulo: "Quadro Mãe",
      sub: "Gestão de Demandas",
      texto: "Todas as tarefas da operação. Suas colunas são os status de todos os quadros.",
    },
    {
      id: "projetos",
      icone: Folder,
      titulo: "Projetos",
      sub: "as pastas",
      texto: "Tarefas de um tema. Os responsáveis padrão entram sozinhos em cada tarefa.",
    },
    {
      id: "quadro-individual",
      icone: User,
      titulo: "Quadro individual",
      sub: "um por pessoa",
      texto: "Tudo em que a pessoa é responsável, com colunas próprias se quiser.",
    },
  ];
  return (
    <section className="glass rounded-[28px] p-5 md:p-7">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        Comece por aqui
      </p>
      <h2 className="mt-1 text-[22px] font-light tracking-[-0.01em] md:text-[26px]">
        Uma tarefa, três lugares
      </h2>
      <p className="mt-1 max-w-2xl text-[12.5px] text-muted-foreground">
        Você cria a tarefa uma vez. Ela aparece no Quadro Mãe, no projeto e no quadro de cada
        responsável, sempre igual. Os eventos aparecem em todos os quadros.
      </p>
      <div className="mt-5 grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
        {caixas.map((c, i) => {
          const Icone = c.icone;
          return (
            <div key={c.id} className="contents">
              {i > 0 && (
                <span className="grid place-items-center text-muted-foreground max-md:rotate-90">
                  <ArrowRight className="size-5" />
                </span>
              )}
              <button
                onClick={() => onAbrir(c.id)}
                className="flex flex-col items-start gap-1.5 rounded-[22px] border border-[var(--glass-border)] bg-tile p-4 text-left fluid hover:-translate-y-0.5"
              >
                <span className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Icone className="size-5" />
                </span>
                <span className="text-[15px] font-semibold">{c.titulo}</span>
                <span className="-mt-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  {c.sub}
                </span>
                <span className="text-[12.5px] leading-snug text-muted-foreground">{c.texto}</span>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
