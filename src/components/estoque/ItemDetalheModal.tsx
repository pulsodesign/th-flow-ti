import { X } from "@/components/ui/icon";
import { EstoqueComentarios } from "./EstoqueComentarios";
import {
  TAMANHOS,
  totalDoItem,
  type EstoqueComentario,
  type EstoqueItem,
  type EstoqueMovimentacao,
  type EstoqueVariacao,
} from "@/lib/estoque/types";
import { formatDateTime } from "@/lib/thc/utils";

export function ItemDetalheModal({
  item,
  variacoes,
  movimentacoes,
  comentarios,
  onClose,
}: {
  item: EstoqueItem;
  variacoes: EstoqueVariacao[];
  movimentacoes: EstoqueMovimentacao[];
  comentarios: EstoqueComentario[];
  onClose: () => void;
}) {
  const vars = variacoes.filter((v) => v.item_id === item.id);
  const movs = movimentacoes.filter((m) => m.item_id === item.id);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 md:items-center md:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel bg-popover! flex max-h-[92dvh] w-full max-w-[720px] flex-col overflow-auto rounded-b-none md:rounded-xl"
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-[16px] font-semibold">{item.nome}</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-surface hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="space-y-5 px-4 py-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            {item.foto_url ? (
              <img
                src={item.foto_url}
                alt={item.nome}
                className="h-52 w-full rounded-lg object-cover sm:w-52"
              />
            ) : (
              <div className="flex h-52 w-full items-center justify-center rounded-lg bg-surface text-[13px] text-muted-foreground sm:w-52">
                Sem foto
              </div>
            )}

            <div className="min-w-0 flex-1 space-y-3 text-[13.5px]">
              <Linha rotulo="Quantidade total" valor={String(totalDoItem(item, variacoes))} />
              {item.tem_variacao_tamanho && (
                <div>
                  <p className="text-[11.5px] uppercase tracking-[0.12em] text-muted-foreground">
                    Tamanhos
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {TAMANHOS.filter((t) => vars.some((v) => v.tamanho === t)).map((t) => (
                      <span
                        key={t}
                        className="rounded-md border border-border px-1.5 py-0.5 text-[13px]"
                      >
                        {t}: {vars.find((v) => v.tamanho === t)?.quantidade ?? 0}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-[11.5px] uppercase tracking-[0.12em] text-muted-foreground">
                  Locais
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {item.locais?.length ? (
                    item.locais.map((l) => (
                      <span
                        key={l}
                        className="rounded-md border border-border bg-surface px-1.5 py-0.5 text-[13px] text-muted-foreground"
                      >
                        {l}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-[13.5px] font-semibold">Histórico de movimentações</h3>
            {!movs.length ? (
              <p className="text-[12.5px] text-muted-foreground">Nenhuma movimentação ainda.</p>
            ) : (
              <ul className="divide-y divide-border/70 rounded-lg border border-border">
                {movs.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-baseline gap-2 px-3 py-2 text-[13px]"
                  >
                    <span className="text-muted-foreground">{formatDateTime(m.created_at)}</span>
                    <span
                      className={
                        m.tipo === "entrada"
                          ? "font-medium text-primary-ink"
                          : "font-medium text-destructive"
                      }
                    >
                      {m.tipo === "entrada" ? "Entrada" : "Saída"} · {m.quantidade}
                    </span>
                    {m.observacao && (
                      <span className="text-muted-foreground">— {m.observacao}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <EstoqueComentarios item={item} comentarios={comentarios} />
        </div>
      </div>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="text-[11.5px] uppercase tracking-[0.12em] text-muted-foreground">{rotulo}</p>
      <p className="mt-0.5 font-medium">{valor}</p>
    </div>
  );
}
