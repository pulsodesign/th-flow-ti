import { useEffect, useMemo, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Circle,
  Calendar as CalendarIcon,
  Link2,
  Maximize2,
  Minimize2,
  Paperclip,
  Send,
  ThumbsUp,
  Trash2,
  X,
  Plus,
  Repeat,
  Settings,
} from "@/components/ui/icon";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { RichText } from "@/components/thc/RichText";
import { Avatar } from "@/components/thc/atoms";
import {
  boardColumns,
  taskLink,
  useActivity,
  useCommentLikes,
  useRequestOptions,
  useTaskMutations,
  useWorkspace,
} from "@/lib/thc/store";
import { useAuth } from "@/lib/thc/auth";
import {
  MAX_TAGS,
  PRIORITIES,
  RECORRENCIAS,
  TAG_COLORS,
  type Anexo,
  type Recorrencia,
  type RequestOptionTipo,
  type Task,
  isEventTask,
} from "@/lib/thc/types";
import { sanitizeRichHtml } from "@/lib/thc/sanitize";
import { formatBytes, isImagem, uploadAnexo } from "@/lib/thc/uploads";
import { formatDateTime, progress } from "@/lib/thc/utils";
import { cn } from "@/lib/utils";

export function TaskModal({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const celular = useIsMobile();
  const { statuses, columns, columnOrder, profiles, projects } = useWorkspace();
  const { userId } = useAuth();
  const {
    updateTask,
    deleteTask,
    deleteSeries,
    repeatTask,
    comment,
    updateComment,
    deleteComment,
  } = useTaskMutations();
  const { data: activity = [] } = useActivity(task?.id ?? null);
  const likes = useCommentLikes(
    task?.id ?? null,
    activity.map((a) => a.id),
  );
  const [local, setLocal] = useState<Task | null>(task);
  const [msg, setMsg] = useState("");
  const [tagNome, setTagNome] = useState("");
  const [tagCor, setTagCor] = useState<string>(TAG_COLORS[0] ?? "oklch(0.6 0.14 259)");
  const [comentAnexos, setComentAnexos] = useState<Anexo[]>([]);
  const [fullscreen, setFullscreen] = useState(false);
  const [perguntaExcluir, setPerguntaExcluir] = useState(false);
  const [verTudo, setVerTudo] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [descStatus, setDescStatus] = useState<
    "idle" | "digitando" | "salvando" | "salvo" | "erro"
  >("idle");
  const descSalvaRef = useRef(task?.descricao ?? "");

  // Sincroniza o estado local apenas quando a tarefa ABERTA muda
  useEffect(() => {
    setLocal(task);
    descSalvaRef.current = task?.descricao ?? "";
    setDescStatus("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  // Salva a descrição automaticamente quando o usuário para de digitar
  useEffect(() => {
    if (!local) return;
    const atual = local.descricao ?? "";
    if (atual === descSalvaRef.current) return;
    setDescStatus("digitando");
    const timer = window.setTimeout(() => {
      descSalvaRef.current = atual;
      setDescStatus("salvando");
      void updateTask
        .mutateAsync({ id: local.id, previous: local, patch: { descricao: atual } })
        .then(() => setDescStatus("salvo"))
        .catch(() => setDescStatus("erro"));
    }, 900);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local?.descricao]);

  const cols = useMemo(
    () => boardColumns(local?.board_id ?? local?.projeto_id ?? "", statuses, columns, columnOrder),
    [local?.board_id, local?.projeto_id, statuses, columns, columnOrder],
  );

  if (!local) return null;

  const patch = (p: Partial<Task>) => {
    setLocal({ ...local, ...p });
    void updateTask.mutateAsync({ id: local.id, previous: local, patch: p });
  };

  const pr = progress(local);
  const doneKey = statuses.find((s) => s.is_done)?.chave;
  const concluida = !!doneKey && local.status === doneKey;

  const alternarConclusao = () => {
    if (!doneKey) return;
    if (concluida) {
      patch({ status: statuses[0]?.chave ?? "backlog", concluida_em: null });
    } else {
      patch({ status: doneKey, concluida_em: new Date().toISOString() });
    }
  };

  const repetir = async (recorrencia: Recorrencia) => {
    if (recorrencia === "nenhuma" || local.serie_id) return;
    // As próximas ocorrências começam na primeira coluna em aberto do quadro.
    const statusInicial =
      cols.find((c) => c.chave !== doneKey && !isEventTask(c.chave))?.chave ?? "backlog";
    try {
      const r = await repeatTask.mutateAsync({ task: local, recorrencia, statusInicial });
      setLocal({
        ...local,
        recorrencia,
        serie_id: r.serieId,
        serie_indice: 1,
        serie_total: r.total,
        data_vencimento: r.base,
      });
      const dia = Number(r.base.slice(8, 10));
      toast.success(
        r.total === null
          ? `Tarefa repetida todo mês no dia ${dia}. As próximas são criadas automaticamente.`
          : `Tarefa repetida: mais ${r.total - 1} criadas, uma em cada mês no dia ${dia}.`,
      );
    } catch {
      /* o erro já aparece como aviso */
    }
  };

  const excluir = (todas: boolean) => {
    if (todas && local.serie_id) void deleteSeries.mutateAsync(local.serie_id);
    else void deleteTask.mutateAsync(local.id);
    setPerguntaExcluir(false);
    onClose();
  };

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(taskLink(local));
      toast.success("Link da tarefa copiado.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  const addTag = () => {
    const nome = tagNome.trim();
    const atuais = local.tags ?? [];
    if (!nome) return;
    if (atuais.length >= MAX_TAGS) {
      toast.error("Máximo de 5 tags por tarefa.");
      return;
    }
    if (atuais.some((t) => t.nome.toLowerCase() === nome.toLowerCase())) {
      toast.error("Essa tag já foi adicionada.");
      return;
    }
    const norm = (s: string) =>
      s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
    const proj = projects.find((p) => p.kind === "departamento" && norm(p.nome) === norm(nome));
    const novos = (proj?.responsaveis_padrao ?? []).filter((id) => !local.usuario_id.includes(id));
    patch({
      tags: [...atuais, { nome, cor: tagCor }],
      ...(novos.length ? { usuario_id: [...local.usuario_id, ...novos] } : {}),
    });
    if (novos.length && proj) {
      const nomes = novos
        .map((id) => profiles.find((p) => p.id === id)?.nome ?? "")
        .filter(Boolean);
      toast.success(`${nomes.join(" e ")} atribuído(s) pelo projeto ${proj.nome}`);
    }
    setTagNome("");
  };

  const trocarProjeto = (projetoId: string | null) => {
    const proj = projetoId ? projects.find((p) => p.id === projetoId) : null;
    const novos = (proj?.responsaveis_padrao ?? []).filter((id) => !local.usuario_id.includes(id));
    patch({
      projeto_id: projetoId,
      ...(novos.length ? { usuario_id: [...local.usuario_id, ...novos] } : {}),
    });
    if (novos.length && proj) {
      const nomes = novos
        .map((id) => profiles.find((p) => p.id === id)?.nome ?? "")
        .filter(Boolean);
      toast.success(`${nomes.join(" e ")} atribuído(s) pelo projeto ${proj.nome}`);
    }
  };

  const sendComment = () => {
    const body = msg.trim();
    const texto = body.replace(/<[^>]*>/g, " ");
    if (!texto.trim() && !comentAnexos.length && !body) return;
    const marcados = new Set<string>();
    for (const m of body.matchAll(/data-mention="([^"]+)"/g)) if (m[1]) marcados.add(m[1]);
    for (const p of profiles) if (texto.includes(`@${p.nome}`)) marcados.add(p.id);
    void comment.mutateAsync({
      taskId: local.id,
      body,
      mentions: [...marcados],
      taskTitle: local.titulo,
      anexos: comentAnexos,
    });
    setMsg("");
    setComentAnexos([]);
  };

  return (
    <Sheet open={!!task} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className={cn(
          "flex w-full flex-col gap-0 overflow-hidden p-0 [&>button]:hidden",
          fullscreen ? "sm:max-w-none" : "sm:max-w-[560px]",
        )}
        style={fullscreen ? { width: "100vw", maxWidth: "100vw" } : undefined}
      >
        <header className="flex items-start gap-2 border-b border-border px-5 py-4">
          <button
            type="button"
            onClick={alternarConclusao}
            aria-label={concluida ? "Reabrir tarefa" : "Marcar como concluída"}
            title={concluida ? "Reabrir tarefa" : "Marcar como concluída"}
            className={cn(
              "mt-0.5 rounded-md p-1 fluid",
              concluida ? "text-primary-ink" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {concluida ? <CheckCircle2 className="size-5" /> : <Circle className="size-5" />}
          </button>
          <textarea
            value={local.titulo}
            onChange={(e) => setLocal({ ...local, titulo: e.target.value })}
            onBlur={() => patch({ titulo: local.titulo })}
            rows={1}
            className={cn(
              "min-w-0 flex-1 resize-none bg-transparent text-[16px] font-semibold outline-none",
              concluida && "line-through opacity-70",
            )}
          />
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => void copiarLink()}
              aria-label="Copiar link da tarefa"
              title="Copiar link da tarefa"
              className="rounded-md p-1.5 text-muted-foreground fluid hover:bg-surface hover:text-foreground"
            >
              <Link2 className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setFullscreen((v) => !v)}
              aria-label={fullscreen ? "Sair da tela cheia" : "Tela cheia"}
              title={fullscreen ? "Sair da tela cheia" : "Tela cheia"}
              className="rounded-md p-1.5 text-muted-foreground fluid hover:bg-surface hover:text-foreground"
            >
              {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
            <button
              type="button"
              onClick={() => {
                if (local.serie_id) {
                  setPerguntaExcluir(true);
                  return;
                }
                if (window.confirm("Excluir esta tarefa?")) {
                  void deleteTask.mutateAsync(local.id);
                  onClose();
                }
              }}
              aria-label="Excluir tarefa"
              className="rounded-md p-1.5 text-muted-foreground fluid hover:bg-destructive/15 hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </button>
            <span className="h-5 w-px bg-border" />
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="rounded-md p-1.5 text-muted-foreground fluid hover:bg-surface hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-auto px-5 py-4">
          {local.is_master && (
            <p className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-[11.5px] text-primary-ink">
              Tarefa criada no Quadro Mãe (Gestão de Demandas) — espelhada no projeto e nos quadros
              individuais dos responsáveis.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select
                value={local.status}
                onChange={(e) => patch({ status: e.target.value })}
                className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-[12.5px] outline-none"
              >
                {cols.map((c) => (
                  <option key={c.chave} value={c.chave}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Prioridade">
              <select
                value={local.prioridade}
                onChange={(e) => patch({ prioridade: e.target.value as Task["prioridade"] })}
                className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-[12.5px] outline-none"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
            {isEventTask(local.status) ? (
              /* Eventos: um único card pode durar vários dias (início → fim). */
              <div className="col-span-2">
                <Field label="Datas do evento">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5 text-[12.5px] fluid hover:border-primary/40",
                          !local.data_vencimento && !local.evento_inicio && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="size-3.5 shrink-0" />
                        {textoDatasEvento(local.evento_inicio, local.data_vencimento)}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <p className="px-3 pt-3 text-[11.5px] text-muted-foreground">
                        Clique no primeiro e no último dia do evento.
                      </p>
                      <Calendar
                        mode="range"
                        numberOfMonths={celular ? 1 : 2}
                        selected={{
                          from: dataLocal(local.evento_inicio ?? local.data_vencimento),
                          to: dataLocal(local.data_vencimento ?? local.evento_inicio),
                        }}
                        onSelect={(r) => {
                          const ini = r?.from ? format(r.from, "yyyy-MM-dd") : null;
                          const fim = r?.to ? format(r.to, "yyyy-MM-dd") : ini;
                          patch({ evento_inicio: ini, data_vencimento: fim });
                        }}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </Field>
              </div>
            ) : (
              <>
                <Field label="Data de criação">
                  <input
                    type="date"
                    readOnly
                    disabled
                    value={(local.data_inicio ?? local.created_at ?? "").slice(0, 10)}
                    className="w-full cursor-not-allowed rounded-md border border-border bg-surface/60 px-2 py-1.5 text-[12.5px] text-muted-foreground outline-none"
                  />
                </Field>
                <Field label="Entrega">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5 text-[12.5px] fluid hover:border-primary/40",
                          !local.data_vencimento && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="size-3.5 shrink-0" />
                        {local.data_vencimento
                          ? format(new Date(`${local.data_vencimento}T00:00:00`), "dd 'de' MMMM", {
                              locale: ptBR,
                            })
                          : "Definir data de entrega"}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={
                          local.data_vencimento
                            ? new Date(`${local.data_vencimento}T00:00:00`)
                            : undefined
                        }
                        onSelect={(date) =>
                          patch({ data_vencimento: date ? format(date, "yyyy-MM-dd") : null })
                        }
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </Field>
                <div className="col-span-2">
                  <Field label="Repetir">
                    {local.serie_id ? (
                      <div className="flex w-full items-center gap-2 rounded-md border border-border bg-surface/60 px-2 py-1.5 text-[12.5px]">
                        <Repeat className="size-3.5 shrink-0 text-primary-ink" />
                        <span className="min-w-0 flex-1 truncate">
                          {RECORRENCIAS.find((r) => r.id === local.recorrencia)?.label ??
                            "Todo mês"}
                        </span>
                        {local.serie_indice && (
                          <span className="shrink-0 text-[11.5px] text-muted-foreground">
                            {local.serie_total
                              ? `${local.serie_indice} de ${local.serie_total}`
                              : `${local.serie_indice}º mês`}
                          </span>
                        )}
                      </div>
                    ) : (
                      <select
                        value="nenhuma"
                        disabled={repeatTask.isPending}
                        onChange={(e) => void repetir(e.target.value as Recorrencia)}
                        className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-[12.5px] outline-none disabled:opacity-60"
                      >
                        {RECORRENCIAS.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </Field>
                </div>
              </>
            )}
            <div className="col-span-2">
              <Field label="Lembrete">
                <label className="flex w-full cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5 text-[12.5px]">
                  <BellRing
                    className={cn(
                      "size-3.5 shrink-0",
                      local.lembrete ? "text-primary-ink" : "text-muted-foreground",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    {textoLembrete(
                      !!local.lembrete,
                      isEventTask(local.status)
                        ? (local.evento_inicio ?? local.data_vencimento)
                        : local.data_vencimento,
                    )}
                  </span>
                  <Switch
                    checked={!!local.lembrete}
                    onCheckedChange={(v) => patch({ lembrete: v })}
                    aria-label="Criar lembrete"
                  />
                </label>
              </Field>
            </div>
            <Field label="Projeto">
              <select
                value={local.projeto_id ?? ""}
                onChange={(e) => trocarProjeto(e.target.value || null)}
                className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-[12.5px] outline-none"
              >
                <option value="">Sem projeto</option>
                {projects
                  .filter((p) => p.kind === "departamento")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Versão">
              <select
                value={local.versao ?? ""}
                onChange={(e) => patch({ versao: e.target.value ? Number(e.target.value) : null })}
                className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-[12.5px] outline-none"
              >
                <option value="">—</option>
                {[1, 2, 3, 4, 5, 6].map((v) => (
                  <option key={v} value={v}>
                    V{v}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Área solicitante">
              <OptionPicker
                tipo="area"
                value={local.area ?? null}
                onChange={(v) => patch({ area: v })}
                placeholder="Nova área"
              />
            </Field>
            <Field label="Solicitante">
              <OptionPicker
                tipo="solicitante"
                value={local.solicitante ?? null}
                onChange={(v) => patch({ solicitante: v })}
                placeholder="Novo solicitante"
              />
            </Field>
          </div>

          <Field label="Responsáveis">
            <div className="flex flex-wrap gap-1.5">
              {profiles.map((p) => {
                const on = local.usuario_id.includes(p.id);
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() =>
                      patch({
                        usuario_id: on
                          ? local.usuario_id.filter((id) => id !== p.id)
                          : [...local.usuario_id, p.id],
                      })
                    }
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11.5px] fluid",
                      on
                        ? "border-primary bg-primary/15 text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    <Avatar user={p} size={18} />
                    {p.nome}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label={`TAGS (${(local.tags ?? []).length}/${MAX_TAGS})`}>
            <div className="space-y-2">
              {local.versao === 6 && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-[11.5px] font-medium text-destructive">
                  <AlertTriangle className="size-4 shrink-0" />
                  Rever briefing — reajustar rota
                </div>
              )}
              {!!(local.tags ?? []).length && (
                <div className="flex flex-wrap gap-1.5">
                  {local.tags.map((tg, i) => (
                    <span
                      key={`${tg.nome}-${i}`}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium"
                      style={{
                        background: `color-mix(in oklab, ${tg.cor} 20%, transparent)`,
                        color: tg.cor,
                      }}
                    >
                      {tg.nome}
                      <button
                        type="button"
                        onClick={() => patch({ tags: local.tags.filter((_, x) => x !== i) })}
                        aria-label={`Remover tag ${tg.nome}`}
                        className="opacity-70 hover:opacity-100"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  value={tagNome}
                  onChange={(e) => setTagNome(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    addTag();
                  }}
                  placeholder={
                    (local.tags ?? []).length >= MAX_TAGS
                      ? "Limite de 5 tags atingido"
                      : "Nome da tag e Enter (ex.: Social, Vídeo…)"
                  }
                  disabled={(local.tags ?? []).length >= MAX_TAGS}
                  className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-[12.5px] outline-none disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={addTag}
                  disabled={(local.tags ?? []).length >= MAX_TAGS}
                  className="rounded-md border border-border px-2.5 py-1.5 text-[11.5px] fluid hover:bg-surface disabled:opacity-60"
                >
                  Adicionar
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {TAG_COLORS.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setTagCor(c)}
                    aria-label={`Cor ${c}`}
                    className={cn(
                      "size-5 rounded-full border fluid",
                      tagCor === c ? "scale-110 border-foreground" : "border-transparent",
                    )}
                    style={{ background: c }}
                  />
                ))}
                <input
                  type="color"
                  onChange={(e) => setTagCor(e.target.value)}
                  aria-label="Cor personalizada"
                  className="size-6 cursor-pointer rounded border border-border bg-transparent p-0"
                />
              </div>
            </div>
          </Field>

          <Field label="Descrição">
            <RichText
              value={local.descricao}
              onChange={(html) => setLocal({ ...local, descricao: html })}
              placeholder="Detalhe a demanda…"
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {descStatus === "digitando"
                ? "Digitando…"
                : descStatus === "salvando"
                  ? "Salvando…"
                  : descStatus === "salvo"
                    ? "Salvo automaticamente"
                    : descStatus === "erro"
                      ? "Não foi possível salvar a descrição."
                      : "Salva automaticamente ao parar de digitar."}
            </p>
          </Field>

          <Field label={`Subtarefas ${pr ? `· ${pr.done}/${pr.total} (${pr.pct}%)` : ""}`}>
            <div className="space-y-1.5">
              {(local.subtarefas ?? []).map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-[12.5px]">
                  <input
                    type="checkbox"
                    checked={s.done}
                    onChange={() =>
                      patch({
                        subtarefas: local.subtarefas.map((x) =>
                          x.id === s.id ? { ...x, done: !x.done } : x,
                        ),
                      })
                    }
                    className="size-3.5 accent-[var(--color-primary)]"
                  />
                  <span className={cn(s.done && "line-through opacity-60")}>{s.title}</span>
                  <button
                    type="button"
                    onClick={() =>
                      patch({ subtarefas: local.subtarefas.filter((x) => x.id !== s.id) })
                    }
                    aria-label="Remover subtarefa"
                    className="ml-auto text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </label>
              ))}
              <input
                placeholder="Adicionar subtarefa e pressionar Enter"
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  const title = e.currentTarget.value.trim();
                  if (!title) return;
                  patch({
                    subtarefas: [
                      ...(local.subtarefas ?? []),
                      { id: crypto.randomUUID(), title, done: false },
                    ],
                  });
                  e.currentTarget.value = "";
                }}
                className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-[12.5px] outline-none"
              />
            </div>
          </Field>

          <Field label="Atividade e comentários">
            <div className="space-y-2.5">
              {activity.length > 6 && !verTudo && (
                <button
                  type="button"
                  onClick={() => setVerTudo(true)}
                  className="w-full rounded-md border border-dashed border-border px-3 py-1.5 text-[11.5px] text-muted-foreground fluid hover:border-primary/50 hover:text-foreground"
                >
                  Exibir todos ({activity.length})
                </button>
              )}
              {(verTudo ? activity : activity.slice(-6)).map((a) => {
                const author = profiles.find((p) => p.id === a.user_id) ?? null;
                return (
                  <div key={a.id} className="flex gap-2">
                    <Avatar user={author} size={22} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11.5px] text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {author?.nome ?? "Sistema"}
                        </span>{" "}
                        · {formatDateTime(a.created_at)}
                        {a.edited_at ? " · editado" : ""}
                      </p>
                      {editandoId === a.id ? (
                        <div className="mt-1">
                          <RichText
                            value={editBody}
                            onChange={setEditBody}
                            prefix="comentarios"
                            people={profiles.map((p) => ({ id: p.id, nome: p.nome }))}
                          />
                          <div className="mt-1.5 flex gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                await updateComment.mutateAsync({
                                  id: a.id,
                                  body: editBody,
                                  taskId: task?.id,
                                  taskTitle: task?.titulo,
                                });
                                setEditandoId(null);
                              }}
                              className="rounded-full bg-primary font-semibold px-2.5 py-1 text-[11.5px] text-primary-foreground fluid hover:opacity-90"
                            >
                              Salvar
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditandoId(null)}
                              className="rounded-md border border-border px-2.5 py-1 text-[11.5px] fluid hover:bg-surface"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        a.body && (
                          <div
                            className="rich-body text-[12.5px]"
                            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(a.body) }}
                          />
                        )
                      )}
                      {!!(a.anexos ?? []).length && (
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          {a.anexos.map((an) => (
                            <a
                              key={an.path}
                              href={an.url}
                              target="_blank"
                              rel="noreferrer"
                              className="block"
                            >
                              {isImagem(an) ? (
                                <img
                                  src={an.url}
                                  alt={an.nome}
                                  className="max-h-40 rounded-md border border-border object-cover"
                                />
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11.5px] text-primary-ink hover:bg-surface">
                                  <Paperclip className="size-3" /> {an.nome} ·{" "}
                                  {formatBytes(an.tamanho)}
                                </span>
                              )}
                            </a>
                          ))}
                        </div>
                      )}
                      {a.kind === "comment" && (
                        <button
                          type="button"
                          onClick={() => void likes.toggle(a, local.titulo)}
                          className={cn(
                            "mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] fluid",
                            likes.likedByMe(a.id)
                              ? "text-primary-ink"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <ThumbsUp className="size-3" /> Curtir
                          {likes.countOf(a.id) > 0 && ` · ${likes.countOf(a.id)}`}
                        </button>
                      )}
                      {a.kind === "comment" && a.user_id === userId && editandoId !== a.id && (
                        <span className="ml-1 inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditandoId(a.id);
                              setEditBody(a.body);
                            }}
                            className="rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground fluid hover:text-foreground"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!window.confirm("Excluir este comentário?")) return;
                              void deleteComment.mutateAsync(a.id);
                            }}
                            className="rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground fluid hover:text-destructive"
                          >
                            Excluir
                          </button>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {!activity.length && (
                <p className="text-[12px] text-muted-foreground">Sem atividade ainda.</p>
              )}
              {activity.length > 6 && verTudo && (
                <button
                  type="button"
                  onClick={() => setVerTudo(false)}
                  className="w-full rounded-md border border-dashed border-border px-3 py-1.5 text-[11.5px] text-muted-foreground fluid hover:border-primary/50 hover:text-foreground"
                >
                  Recolher
                </button>
              )}
            </div>

            <div className="relative mt-3">
              {!!comentAnexos.length && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {comentAnexos.map((an) => (
                    <span
                      key={an.path}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-[11px]"
                    >
                      <Paperclip className="size-3" /> {an.nome}
                      <button
                        type="button"
                        onClick={() => setComentAnexos((l) => l.filter((x) => x.path !== an.path))}
                        aria-label={`Remover ${an.nome}`}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <RichText
                value={msg}
                onChange={setMsg}
                placeholder="Comente e use @ para mencionar…"
                prefix="comentarios"
                people={profiles.map((p) => ({ id: p.id, nome: p.nome }))}
              />
              <div className="mt-2 flex items-center justify-between">
                <label
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] text-muted-foreground fluid hover:bg-surface hover:text-foreground"
                  title="Anexar arquivo"
                >
                  <Paperclip className="size-3.5" />
                  <span className="hidden sm:inline">Anexar</span>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files ?? []);
                      if (!files.length) return;
                      for (const file of files) {
                        try {
                          const anexo = await uploadAnexo(file);
                          setComentAnexos((prev) => [...prev, anexo]);
                        } catch {
                          toast.error(`Erro ao enviar o arquivo ${file.name}`);
                        }
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={sendComment}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary font-semibold px-3 py-1.5 text-[12px] text-primary-foreground fluid hover:opacity-90 disabled:opacity-60"
                >
                  <Send className="size-3.5" /> Comentar
                </button>
              </div>
            </div>
          </Field>
        </div>
        <Dialog open={perguntaExcluir} onOpenChange={setPerguntaExcluir}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Excluir tarefa repetida</DialogTitle>
              <DialogDescription>
                Esta tarefa se repete todo mês. Quer excluir só a deste mês ou todas as tarefas da
                repetição?
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => excluir(false)}
                className="rounded-md border border-border px-3 py-2 text-[12.5px] hover:bg-surface"
              >
                Excluir só a deste mês
              </button>
              <button
                type="button"
                onClick={() => excluir(true)}
                className="rounded-full bg-destructive px-3 py-2 text-[12.5px] font-semibold text-destructive-foreground"
              >
                Excluir todas da repetição
              </button>
              <button
                type="button"
                onClick={() => setPerguntaExcluir(false)}
                className="px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}

function dataLocal(iso: string | null | undefined) {
  return iso ? new Date(`${iso}T00:00:00`) : undefined;
}

/** "12 de novembro" ou "12 – 14 de novembro" para eventos de vários dias. */
function textoDatasEvento(inicio: string | null | undefined, fim: string | null | undefined) {
  const a = dataLocal(inicio ?? fim);
  const b = dataLocal(fim ?? inicio);
  if (!a || !b) return "Definir datas do evento";
  if (a.getTime() === b.getTime()) return format(a, "dd 'de' MMMM", { locale: ptBR });
  const mesmoMes = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  return `${format(a, mesmoMes ? "dd" : "dd 'de' MMM", { locale: ptBR })} – ${format(b, "dd 'de' MMMM", { locale: ptBR })}`;
}

/** Texto ao lado da chave do lembrete. */
function textoLembrete(ligado: boolean, data: string | null | undefined) {
  if (!ligado) return "Criar lembrete às 9h no dia da tarefa";
  if (!data) return "Lembrete ligado. Defina a data para ele ser enviado.";
  const dia = format(new Date(`${data.slice(0, 10)}T00:00:00`), "dd 'de' MMMM", { locale: ptBR });
  return `Lembrete às 9h de ${dia} para os responsáveis`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function OptionPicker({
  tipo,
  value,
  onChange,
  placeholder,
}: {
  tipo: RequestOptionTipo;
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder: string;
}) {
  const { listOf, create, remove } = useRequestOptions();
  const [novo, setNovo] = useState(false);
  const [texto, setTexto] = useState("");
  const [gerenciar, setGerenciar] = useState(false);
  const opcoes = listOf(tipo);

  const salvar = async () => {
    const nome = await create(tipo, texto);
    if (nome) {
      onChange(nome);
      setTexto("");
      setNovo(false);
    }
  };

  return (
    <div className="space-y-1.5">
      {novo ? (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            value={texto}
            placeholder={placeholder}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void salvar();
              }
              if (e.key === "Escape") setNovo(false);
            }}
            className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-[12.5px] outline-none"
          />
          <button
            type="button"
            onClick={() => void salvar()}
            className="rounded-full bg-primary font-semibold px-2.5 py-1.5 text-[11.5px] text-primary-foreground fluid hover:opacity-90"
          >
            Salvar
          </button>
          <button
            type="button"
            onClick={() => setNovo(false)}
            className="rounded-md border border-border px-2 py-1.5 text-[11.5px] fluid hover:bg-surface"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <select
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
            className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-[12.5px] outline-none"
          >
            <option value="">Selecione...</option>
            {opcoes.map((opt) => (
              <option key={opt.id} value={opt.nome}>
                {opt.nome}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setNovo(true)}
            aria-label="Adicionar nova opção"
            title="Adicionar nova opção"
            className="rounded-md border border-border p-1.5 text-muted-foreground fluid hover:bg-surface hover:text-foreground"
          >
            <Plus className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setGerenciar(!gerenciar)}
            aria-label="Gerenciar opções"
            title="Gerenciar opções"
            className="rounded-md border border-border p-1.5 text-muted-foreground fluid hover:bg-surface hover:text-foreground"
          >
            <Settings className="size-4" />
          </button>
        </div>
      )}

      {gerenciar && (
        <div className="rounded-md border border-border bg-surface/50 p-2 space-y-1">
          <div className="flex items-center justify-between pb-1 mb-1 border-b border-border">
            <span className="text-[11px] font-semibold text-muted-foreground">
              Gerenciar opções
            </span>
            <button
              type="button"
              onClick={() => setGerenciar(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {opcoes.map((opt) => (
              <div
                key={opt.id}
                className="flex items-center justify-between text-[12px] px-1 py-0.5 rounded hover:bg-surface"
              >
                <span>{opt.nome}</span>
                <button
                  type="button"
                  onClick={() => remove(opt.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
            {!opcoes.length && (
              <p className="text-[11px] text-muted-foreground py-1">Nenhuma opção cadastrada.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
