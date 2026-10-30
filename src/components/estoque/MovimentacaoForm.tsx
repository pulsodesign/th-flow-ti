import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useEstoqueMutations } from "@/lib/estoque/store";
import type { EstoqueItem, EstoqueVariacao } from "@/lib/estoque/types";

export function MovimentacaoForm({
  itens,
  variacoes,
  itemInicial,
}: {
  itens: EstoqueItem[];
  variacoes: EstoqueVariacao[];
  itemInicial?: string | undefined;
}) {
  const { registrarMovimentacao } = useEstoqueMutations();
  const [itemId, setItemId] = useState(itemInicial ?? itens[0]?.id ?? "");
  const [variacaoId, setVariacaoId] = useState("");
  const [tipo, setTipo] = useState<"entrada" | "saida">("entrada");
  const [quantidade, setQuantidade] = useState("1");
  const [observacao, setObservacao] = useState("");

  const item = itens.find((i) => i.id === itemId);
  const varsDoItem = useMemo(
    () => variacoes.filter((v) => v.item_id === itemId),
    [variacoes, itemId],
  );

  const enviar = (): void => {
    const qtd = Number(quantidade) || 0;
    if (!itemId) {
      toast.error("Selecione um item");
      return;
    }
    if (qtd <= 0) {
      toast.error("A quantidade deve ser maior que zero");
      return;
    }

    const usaVariacao = !!item?.tem_variacao_tamanho;
    const varSel = usaVariacao ? variacaoId || varsDoItem[0]?.id || "" : "";
    if (usaVariacao && !varSel) {
      toast.error("Selecione o tamanho");
      return;
    }

    const atual = usaVariacao
      ? (varsDoItem.find((v) => v.id === varSel)?.quantidade ?? 0)
      : (item?.quantidade ?? 0);
    if (tipo === "saida" && qtd > atual) {
      toast.error(`Estoque insuficiente: disponível ${atual}`);
      return;
    }

    registrarMovimentacao.mutate(
      {
        item_id: itemId,
        variacao_id: usaVariacao ? varSel : null,
        tipo,
        quantidade: qtd,
        observacao,
      },
      {
        onSuccess: () => {
          setQuantidade("1");
          setObservacao("");
        },
      },
    );
  };

  const campo =
    "w-full rounded-md border border-border bg-surface px-3 py-2.5 text-[14.5px] outline-none focus:border-primary";

  return (
    <div className="panel space-y-5 p-6">
      <h3 className="text-[15.5px] font-semibold">Registrar movimentação</h3>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[12.5px] text-muted-foreground">Item</label>
          <select
            value={itemId}
            onChange={(e) => {
              setItemId(e.target.value);
              setVariacaoId("");
            }}
            className={campo}
          >
            <option value="">Selecione…</option>
            {itens.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nome}
              </option>
            ))}
          </select>
        </div>

        {item?.tem_variacao_tamanho && (
          <div>
            <label className="mb-1.5 block text-[12.5px] text-muted-foreground">Tamanho</label>
            <select
              value={variacaoId}
              onChange={(e) => setVariacaoId(e.target.value)}
              className={campo}
            >
              <option value="">Selecione…</option>
              {varsDoItem.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.tamanho} · {v.quantidade} em estoque
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-[12.5px] text-muted-foreground">Tipo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as "entrada" | "saida")}
            className={campo}
          >
            <option value="entrada">Entrada</option>
            <option value="saida">Saída</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-[12.5px] text-muted-foreground">Quantidade</label>
          <input
            type="number"
            min={1}
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            className={campo}
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-[12.5px] text-muted-foreground">Observação</label>
        <textarea
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          rows={3}
          placeholder="Opcional — motivo, destino, responsável…"
          className={campo}
        />
      </div>

      <button
        onClick={enviar}
        disabled={registrarMovimentacao.isPending}
        className="rounded-full bg-primary font-semibold px-4 py-2.5 text-[14px] text-primary-foreground fluid hover:opacity-90 disabled:opacity-60"
      >
        {registrarMovimentacao.isPending ? "Registrando…" : "Registrar"}
      </button>
    </div>
  );
}
