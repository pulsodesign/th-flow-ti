import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Pin, PinOff, Plus, RotateCcw, Search, Trash2, X } from "@/components/ui/icon";
import { RichText } from "@/components/thc/RichText";
import { useAuth } from "@/lib/thc/auth";
import { useNotes, type PersonalNote } from "@/lib/thc/notes";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/anotacoes")({
  head: () => ({
    meta: [
      { title: "Anotações — TH Flow" },
      {
        name: "description",
        content: "Bloco de anotações pessoais e privadas de cada membro da equipe no TH Flow.",
      },
      { property: "og:title", content: "Anotações — TH Flow" },
      { property: "og:description", content: "Anotações pessoais privadas, com lixeira e busca." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AnotacoesPage,
});

type Ordem = "recente" | "antigo" | "criacao" | "atualizacao" | "az";

const ORDENS: { id: Ordem; label: string }[] = [
  { id: "recente", label: "Mais recente" },
  { id: "antigo", label: "Mais antigo" },
  { id: "criacao", label: "Criação" },
  { id: "atualizacao", label: "Atualização" },
  { id: "az", label: "A–Z" },
];

const textoDe = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const dataCurta = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

function AnotacoesPage() {
  const { userId } = useAuth();
  const { notes, loading, criar, salvar, fixar, mover, excluir } = useNotes(userId);

  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("recente");
  const [naLixeira, setNaLixeira] = useState(false);
  const [selecionada, setSelecionada] = useState<string | null>(null);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const filtradas = notes
      .filter((n) => (naLixeira ? !!n.deleted_at : !n.deleted_at))
      .filter(
        (n) =>
          !q || n.title.toLowerCase().includes(q) || textoDe(n.content).toLowerCase().includes(q),
      );
    const cmp = (a: PersonalNote, b: PersonalNote) => {
      switch (ordem) {
        case "antigo":
          return a.created_at.localeCompare(b.created_at);
        case "criacao":
          return b.created_at.localeCompare(a.created_at);
        case "atualizacao":
          return b.updated_at.localeCompare(a.updated_at);
        case "az":
          return a.title.localeCompare(b.title, "pt-BR");
        default:
          return b.updated_at.localeCompare(a.updated_at);
      }
    };
    return filtradas.sort((a, b) => {
      if (!naLixeira && a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return cmp(a, b);
    });
  }, [notes, busca, ordem, naLixeira]);

  const nota = notes.find((n) => n.id === selecionada && !n.deleted_at) ?? null;

  // Estado local do editor + auto-save com debounce de 1s
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [status, setStatus] = useState<"" | "salvando" | "salvo">("");
  const timer = useRef<number | null>(null);
  const notaId = nota?.id ?? null;

  useEffect(() => {
    setTitulo(nota?.title ?? "");
    setConteudo(nota?.content ?? "");
    setStatus("");
    // Recarrega o editor apenas quando muda a anotação selecionada
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notaId]);

  const agendarSalvar = (patch: { title?: string; content?: string }) => {
    if (!notaId) return;
    setStatus("salvando");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      salvar.mutate(
        { id: notaId, ...patch },
        { onSuccess: () => setStatus("salvo"), onError: () => setStatus("") },
      );
    }, 1000);
  };

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const novaAnotacao = () => {
    criar.mutate(undefined, {
      onSuccess: (n) => {
        setNaLixeira(false);
        setSelecionada(n.id);
      },
    });
  };

  return (
    <div className="flex h-full min-h-0 w-full">
      {/* Lista */}
      <div
        className={cn(
          "flex min-h-0 w-full flex-col border-r border-border md:w-[32%] md:max-w-[380px]",
          nota && "hidden md:flex",
        )}
      >
        <div className="space-y-2 border-b border-border px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-[26px] font-light tracking-[-0.02em]">Anotações</h1>
            <button
              onClick={novaAnotacao}
              className="flex items-center gap-1.5 rounded-full bg-primary font-semibold px-2.5 py-1.5 text-[12px] text-primary-foreground fluid hover:opacity-90"
            >
              <Plus className="size-3.5" /> Nova anotação
            </button>
          </div>
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface/50 px-2">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar anotação"
              className="w-full bg-transparent py-1.5 text-[12.5px] outline-none"
            />
            {!!busca && (
              <button onClick={() => setBusca("")} aria-label="Limpar busca">
                <X className="size-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={ordem}
              onChange={(e) => setOrdem(e.target.value as Ordem)}
              className="rounded-md border border-border bg-surface/50 px-2 py-1.5 text-[12px] outline-none"
            >
              {ORDENS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="ml-auto flex rounded-md border border-border p-0.5">
              {[
                { id: false, label: "Ativas" },
                { id: true, label: "Lixeira" },
              ].map((t) => (
                <button
                  key={String(t.id)}
                  onClick={() => {
                    setNaLixeira(t.id);
                    setSelecionada(null);
                  }}
                  className={cn(
                    "rounded px-2 py-1 text-[11.5px] fluid",
                    naLixeira === t.id
                      ? "bg-primary/15 font-semibold text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
          {loading && <p className="px-2 py-3 text-[12px] text-muted-foreground">Carregando…</p>}
          {!loading && !lista.length && (
            <p className="px-2 py-3 text-[12px] text-muted-foreground">
              {naLixeira ? "Lixeira vazia." : "Nenhuma anotação ainda."}
            </p>
          )}
          {lista.map((n) => (
            <div
              key={n.id}
              className={cn(
                "group rounded-lg border border-transparent px-2.5 py-2 fluid hover:bg-surface",
                n.id === selecionada && !naLixeira && "border-primary/40 bg-primary/10",
              )}
            >
              <button
                onClick={() => !naLixeira && setSelecionada(n.id)}
                className="block w-full text-left"
              >
                <p className="flex items-center gap-1.5 truncate text-[12.5px] font-medium">
                  {n.is_pinned && !naLixeira && (
                    <Pin className="size-3 shrink-0 text-primary-ink" />
                  )}
                  {n.title || "Sem título"}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {dataCurta(n.updated_at)} · {textoDe(n.content) || "Sem conteúdo"}
                </p>
              </button>
              <div className="mt-1 flex gap-1 opacity-0 fluid group-hover:opacity-100">
                {naLixeira ? (
                  <>
                    <Acao
                      icon={RotateCcw}
                      label="Restaurar"
                      onClick={() => mover.mutate({ id: n.id, paraLixeira: false })}
                    />
                    <Acao
                      icon={Trash2}
                      label="Excluir definitivamente"
                      onClick={() => {
                        if (window.confirm("Excluir esta anotação definitivamente?"))
                          excluir.mutate(n.id);
                      }}
                    />
                  </>
                ) : (
                  <>
                    <Acao
                      icon={n.is_pinned ? PinOff : Pin}
                      label={n.is_pinned ? "Desafixar" : "Fixar"}
                      onClick={() => fixar.mutate({ id: n.id, is_pinned: !n.is_pinned })}
                    />
                    <Acao
                      icon={Trash2}
                      label="Mover para lixeira"
                      onClick={() => {
                        mover.mutate({ id: n.id, paraLixeira: true });
                        if (selecionada === n.id) setSelecionada(null);
                      }}
                    />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className={cn("min-h-0 flex-1 flex-col", nota ? "flex" : "hidden md:flex")}>
        {!nota ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-[12.5px] text-muted-foreground">
            Selecione uma anotação ou crie uma nova.
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2 md:px-5">
              <button
                onClick={() => setSelecionada(null)}
                aria-label="Voltar"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-surface md:hidden"
              >
                <ArrowLeft className="size-4" />
              </button>
              <input
                value={titulo}
                onChange={(e) => {
                  setTitulo(e.target.value);
                  agendarSalvar({ title: e.target.value });
                }}
                placeholder="Título da anotação"
                className="w-full bg-transparent text-[18px] font-semibold outline-none placeholder:text-muted-foreground"
              />
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {status === "salvando" ? "Salvando…" : status === "salvo" ? "Salvo" : ""}
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-5">
              <RichText
                value={conteudo}
                onChange={(html) => {
                  setConteudo(html);
                  agendarSalvar({ content: html });
                }}
                placeholder="Escreva sua anotação…"
                prefix="anotacoes"
                headings
                minHeightClass="min-h-[60vh]"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Acao({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Pin;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="rounded p-1 text-muted-foreground fluid hover:bg-surface-2 hover:text-foreground"
    >
      <Icon className="size-3.5" />
    </button>
  );
}
