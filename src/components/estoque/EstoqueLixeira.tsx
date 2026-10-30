import { RotateCcw, X } from "@/components/ui/icon";
import type { EstoqueItem } from "@/lib/estoque/types";
import { formatDateTime } from "@/lib/thc/utils";

export function EstoqueLixeira({
  itens,
  onRestore,
  onClose,
}: {
  itens: EstoqueItem[];
  onRestore: (item: EstoqueItem) => void;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 md:items-center md:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel bg-popover! flex max-h-[85dvh] w-full max-w-[520px] flex-col overflow-auto rounded-b-none md:rounded-xl"
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-[15px] font-semibold">Lixeira do estoque</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-surface hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="px-4 py-4">
          {!itens.length ? (
            <p className="text-[12.5px] text-muted-foreground">Nenhum item excluído.</p>
          ) : (
            <ul className="divide-y divide-border/70">
              {itens.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-medium">{i.nome}</p>
                    <p className="text-[11.5px] text-muted-foreground">
                      Excluído em {i.deletado_em ? formatDateTime(i.deletado_em) : "—"}
                    </p>
                  </div>
                  <button
                    onClick={() => onRestore(i)}
                    className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12.5px] fluid hover:bg-surface"
                  >
                    <RotateCcw className="size-3.5" /> Restaurar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
