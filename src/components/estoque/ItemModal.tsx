import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "@/components/ui/icon";
import { toast } from "sonner";
import { uploadAnexo } from "@/lib/thc/uploads";
import {
  ESTOQUES_FIXOS,
  TAMANHOS,
  type EstoqueItem,
  type EstoqueVariacao,
  type Tamanho,
} from "@/lib/estoque/types";
import type { ItemInput } from "@/lib/estoque/store";
import { cn } from "@/lib/utils";

const zerado = () => Object.fromEntries(TAMANHOS.map((t) => [t, 0])) as Record<Tamanho, number>;

export function ItemModal({
  item,
  variacoes,
  onClose,
  onSave,
  saving,
}: {
  item: EstoqueItem | null;
  variacoes: EstoqueVariacao[];
  onClose: () => void;
  onSave: (input: ItemInput) => void;
  saving: boolean;
}) {
  const iniciais = item?.locais ?? [];
  const outroInicial = iniciais.find((l) => !ESTOQUES_FIXOS.includes(l as never)) ?? "";
  const [nome, setNome] = useState(item?.nome ?? "");
  const [foto, setFoto] = useState<string | null>(item?.foto_url ?? null);
  const [fixos, setFixos] = useState<string[]>(
    iniciais.filter((l) => ESTOQUES_FIXOS.includes(l as never)),
  );
  const [temOutro, setTemOutro] = useState(!!outroInicial);
  const [outro, setOutro] = useState(outroInicial);
  const [temVariacao, setTemVariacao] = useState(item?.tem_variacao_tamanho ?? false);
  const [quantidade, setQuantidade] = useState(String(item?.quantidade ?? 0));
  const [qtds, setQtds] = useState<Record<Tamanho, number>>(zerado());
  const [enviando, setEnviando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!item) return;
    const base = zerado();
    for (const v of variacoes.filter((x) => x.item_id === item.id)) base[v.tamanho] = v.quantidade;
    setQtds(base);
  }, [item, variacoes]);

  const enviarFoto = async (file: File) => {
    setEnviando(true);
    try {
      const anexo = await uploadAnexo(file, "estoque");
      setFoto(anexo.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar a foto");
    } finally {
      setEnviando(false);
    }
  };

  const salvar = () => {
    if (!nome.trim()) {
      toast.error("Informe o nome do item");
      return;
    }
    const locais = [...fixos];
    if (temOutro && outro.trim()) locais.push(outro.trim());
    onSave({
      nome: nome.trim(),
      foto_url: foto,
      locais,
      tem_variacao_tamanho: temVariacao,
      quantidade: Math.max(0, Number(quantidade) || 0),
      variacoes: qtds,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 md:items-center md:p-6">
      <div className="panel bg-popover! flex max-h-[92dvh] w-full max-w-[560px] flex-col overflow-auto rounded-b-none md:rounded-xl">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-[15px] font-semibold">{item ? "Editar item" : "Novo item"}</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-surface hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="space-y-4 px-4 py-4">
          <div>
            <label className="mb-1 block text-[11.5px] text-muted-foreground">Nome</label>
            <input
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Camiseta institucional"
              className="w-full rounded-md border border-border bg-surface px-2.5 py-2 text-[13px] outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11.5px] text-muted-foreground">Foto</label>
            <div className="flex items-center gap-3">
              {foto ? (
                <img src={foto} alt={nome || "Item"} className="size-16 rounded-md object-cover" />
              ) : (
                <span className="flex size-16 items-center justify-center rounded-md bg-surface text-muted-foreground">
                  <ImagePlus className="size-5" />
                </span>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void enviarFoto(f);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={enviando}
                className="rounded-md border border-border px-2.5 py-1.5 text-[12px] fluid hover:bg-surface disabled:opacity-60"
              >
                {enviando ? "Enviando…" : foto ? "Trocar foto" : "Enviar foto"}
              </button>
              {foto && (
                <button
                  onClick={() => setFoto(null)}
                  className="text-[12px] text-muted-foreground hover:text-destructive"
                >
                  Remover
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11.5px] text-muted-foreground">
              Estoque (onde o item está guardado)
            </label>
            <div className="flex flex-wrap gap-2">
              {ESTOQUES_FIXOS.map((e) => {
                const ativo = fixos.includes(e);
                return (
                  <button
                    key={e}
                    onClick={() =>
                      setFixos((prev) => (ativo ? prev.filter((x) => x !== e) : [...prev, e]))
                    }
                    className={cn(
                      "rounded-md border px-2.5 py-1.5 text-[12.5px] fluid",
                      ativo
                        ? "border-primary bg-primary/15 text-foreground"
                        : "border-border text-muted-foreground hover:bg-surface",
                    )}
                  >
                    {e}
                  </button>
                );
              })}
              <button
                onClick={() => setTemOutro((v) => !v)}
                className={cn(
                  "rounded-md border px-2.5 py-1.5 text-[12.5px] fluid",
                  temOutro
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border text-muted-foreground hover:bg-surface",
                )}
              >
                Outro
              </button>
            </div>
            {temOutro && (
              <input
                value={outro}
                onChange={(e) => setOutro(e.target.value)}
                placeholder="Nome do estoque"
                className="mt-2 w-full rounded-md border border-border bg-surface px-2.5 py-2 text-[13px] outline-none focus:border-primary"
              />
            )}
          </div>

          <label className="flex items-center gap-2 text-[12.5px]">
            <input
              type="checkbox"
              checked={temVariacao}
              onChange={(e) => setTemVariacao(e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            Tem variação de tamanho?
          </label>

          {temVariacao ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {TAMANHOS.map((t) => (
                <div key={t}>
                  <label className="mb-1 block text-[11.5px] text-muted-foreground">{t}</label>
                  <input
                    type="number"
                    min={0}
                    value={qtds[t]}
                    onChange={(e) =>
                      setQtds((prev) => ({
                        ...prev,
                        [t]: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="w-full rounded-md border border-border bg-surface px-2.5 py-2 text-[13px] outline-none focus:border-primary"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-[11.5px] text-muted-foreground">Quantidade</label>
              <input
                type="number"
                min={0}
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                className="w-full rounded-md border border-border bg-surface px-2.5 py-2 text-[13px] outline-none focus:border-primary"
              />
            </div>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-[12.5px] fluid hover:bg-surface"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={saving}
            className="rounded-full bg-primary font-semibold px-3 py-1.5 text-[12.5px] text-primary-foreground fluid hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </footer>
      </div>
    </div>
  );
}
