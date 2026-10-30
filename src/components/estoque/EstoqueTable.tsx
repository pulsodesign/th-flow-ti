import { Pencil, Trash2 } from "@/components/ui/icon";
import { TAMANHOS, totalDoItem, type EstoqueItem, type EstoqueVariacao } from "@/lib/estoque/types";
import { cn } from "@/lib/utils";

export function EstoqueTable({
  itens,
  variacoes,
  onEdit,
  onDelete,
  onSelect,
  selectedId,
}: {
  itens: EstoqueItem[];
  variacoes: EstoqueVariacao[];
  onEdit: (item: EstoqueItem) => void;
  onDelete: (item: EstoqueItem) => void;
  onSelect: (item: EstoqueItem) => void;
  selectedId?: string | undefined;
}) {
  if (!itens.length) {
    return (
      <div className="panel px-4 py-8 text-center text-[15.5px] text-muted-foreground">
        Nenhum item encontrado.
      </div>
    );
  }

  return (
    <>
      {/* Celular: lista de cards, com as ações sempre visíveis */}
      <ul className="space-y-2.5 md:hidden">
        {itens.map((item) => (
          <li
            key={item.id}
            onClick={() => onSelect(item)}
            className={cn(
              "flex cursor-pointer gap-3 rounded-[22px] border border-[var(--glass-border)] bg-tile p-3 shadow-[var(--shadow-soft)]",
              selectedId === item.id && "border-primary/60",
            )}
          >
            <Foto item={item} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-[15px] font-medium leading-snug">{item.nome}</p>
              <Quantidade item={item} variacoes={variacoes} />
              <Locais item={item} />
            </div>
            <Acoes item={item} onEdit={onEdit} onDelete={onDelete} />
          </li>
        ))}
      </ul>

      <div className="panel hidden overflow-x-auto md:block">
        <table className="w-full min-w-[680px] text-[15.5px]">
          <thead className="bg-surface/70 text-[14px] uppercase tracking-[0.1em] text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium">Foto</th>
              <th className="px-3 py-2.5 text-left font-medium">Nome</th>
              <th className="px-3 py-2.5 text-left font-medium">Quantidade</th>
              <th className="px-3 py-2.5 text-left font-medium">Estoque</th>
              <th className="px-3 py-2.5 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => {
              return (
                <tr
                  key={item.id}
                  onClick={() => onSelect(item)}
                  className={cn(
                    "cursor-pointer border-t border-border/70 fluid hover:bg-surface/60",
                    selectedId === item.id && "bg-primary/10",
                  )}
                >
                  <td className="px-3 py-2.5">
                    <Foto item={item} />
                  </td>
                  <td className="px-3 py-2.5 font-medium">{item.nome}</td>
                  <td className="px-3 py-2.5">
                    <Quantidade item={item} variacoes={variacoes} />
                  </td>
                  <td className="px-3 py-2.5">
                    <Locais item={item} />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Acoes item={item} onEdit={onEdit} onDelete={onDelete} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Foto({ item }: { item: EstoqueItem }) {
  return item.foto_url ? (
    <img
      src={item.foto_url}
      alt={item.nome}
      loading="lazy"
      className="size-11 shrink-0 rounded-md object-cover"
    />
  ) : (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-surface text-[13px] text-muted-foreground">
      —
    </span>
  );
}

function Quantidade({ item, variacoes }: { item: EstoqueItem; variacoes: EstoqueVariacao[] }) {
  const vars = variacoes.filter((v) => v.item_id === item.id);
  const total = totalDoItem(item, variacoes);
  if (!item.tem_variacao_tamanho)
    return <span className={cn(total === 0 && "text-destructive")}>{total}</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {TAMANHOS.filter((t) => vars.some((v) => v.tamanho === t)).map((t) => {
        const q = vars.find((v) => v.tamanho === t)?.quantidade ?? 0;
        return (
          <span
            key={t}
            className={cn(
              "rounded-md border border-border px-1.5 py-0.5 text-[14px]",
              q === 0 ? "text-destructive" : "text-foreground",
            )}
          >
            {t}: {q}
          </span>
        );
      })}
    </span>
  );
}

function Locais({ item }: { item: EstoqueItem }) {
  if (!item.locais?.length) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {item.locais.map((l) => (
        <span
          key={l}
          className="rounded-md border border-border bg-surface px-1.5 py-0.5 text-[14px] text-muted-foreground"
        >
          {l}
        </span>
      ))}
    </span>
  );
}

function Acoes({
  item,
  onEdit,
  onDelete,
}: {
  item: EstoqueItem;
  onEdit: (item: EstoqueItem) => void;
  onDelete: (item: EstoqueItem) => void;
}) {
  return (
    <span className="inline-flex shrink-0 gap-1 self-start">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onEdit(item);
        }}
        aria-label={`Editar ${item.nome}`}
        className="grid place-items-center rounded-full p-1.5 text-muted-foreground fluid hover:bg-surface hover:text-foreground max-md:size-10"
      >
        <Pencil className="size-4" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(item);
        }}
        aria-label={`Excluir ${item.nome}`}
        className="grid place-items-center rounded-full p-1.5 text-muted-foreground fluid hover:bg-surface hover:text-destructive max-md:size-10"
      >
        <Trash2 className="size-4" />
      </button>
    </span>
  );
}
