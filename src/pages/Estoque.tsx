import { useMemo, useState } from "react";
import { Plus, Search, Trash2 } from "@/components/ui/icon";
import { EstoqueKpis, EstoqueGrafico } from "@/components/estoque/EstoqueDashboard";
import { EstoqueTable } from "@/components/estoque/EstoqueTable";
import { ItemModal } from "@/components/estoque/ItemModal";
import { ItemDetalheModal } from "@/components/estoque/ItemDetalheModal";
import { EstoqueLixeira } from "@/components/estoque/EstoqueLixeira";
import { MovimentacaoForm } from "@/components/estoque/MovimentacaoForm";
import { useEstoqueItens, useEstoqueMutations, type ItemInput } from "@/lib/estoque/store";
import { ESTOQUES_FIXOS, totalDoItem, type EstoqueItem, type Periodo } from "@/lib/estoque/types";

type Ordem = "qtd-desc" | "qtd-asc" | "nome-asc" | "nome-desc";

export default function EstoquePage() {
  const { itens, itensExcluidos, variacoes, movimentacoes, comentarios, isLoading } =
    useEstoqueItens();
  const { createItem, updateItem, deleteItem, restoreItem } = useEstoqueMutations();
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<EstoqueItem | null>(null);
  const [detalheId, setDetalheId] = useState<string | undefined>(undefined);
  const [lixeiraAberta, setLixeiraAberta] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroEstoque, setFiltroEstoque] = useState("todos");
  const [ordem, setOrdem] = useState<Ordem>("nome-asc");
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [dataEspecifica, setDataEspecifica] = useState(new Date().toISOString().slice(0, 10));

  const detalhe = itens.find((i) => i.id === detalheId);

  const estoquesDisponiveis = useMemo(() => {
    const set = new Set<string>(ESTOQUES_FIXOS);
    for (const i of itens) for (const l of i.locais ?? []) set.add(l);
    return [...set];
  }, [itens]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = itens.filter((i) => {
      const okBusca = !termo || i.nome.toLowerCase().includes(termo);
      const okEstoque = filtroEstoque === "todos" || (i.locais ?? []).includes(filtroEstoque);
      return okBusca && okEstoque;
    });
    return [...lista].sort((a, b) => {
      if (ordem === "nome-asc") return a.nome.localeCompare(b.nome, "pt-BR");
      if (ordem === "nome-desc") return b.nome.localeCompare(a.nome, "pt-BR");
      const qa = totalDoItem(a, variacoes);
      const qb = totalDoItem(b, variacoes);
      return ordem === "qtd-desc" ? qb - qa : qa - qb;
    });
  }, [itens, variacoes, busca, filtroEstoque, ordem]);

  const salvar = (input: ItemInput) => {
    if (editando) {
      updateItem.mutate({ id: editando.id, input }, { onSuccess: () => setModalAberto(false) });
    } else {
      createItem.mutate(input, { onSuccess: () => setModalAberto(false) });
    }
  };

  const excluir = (item: EstoqueItem) => {
    if (!window.confirm(`Tem certeza que deseja excluir ${item.nome}?`)) return;
    deleteItem.mutate(item.id);
    if (detalheId === item.id) setDetalheId(undefined);
  };

  const campo =
    "rounded-md border border-border bg-surface px-2.5 py-2 text-[13px] outline-none focus:border-primary max-md:h-10 max-md:min-w-0 max-md:flex-1";

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-8 md:py-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Operação Geral
          </p>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="mt-1 text-[30px] font-light leading-[1.05] tracking-[-0.02em] md:text-[44px]">
              Estoque
            </h1>
            <button
              onClick={() => setLixeiraAberta(true)}
              className="flex items-center gap-1 text-[12px] text-muted-foreground fluid hover:text-foreground max-md:h-9 max-md:rounded-full max-md:border max-md:border-[var(--glass-border)] max-md:bg-surface max-md:px-3"
            >
              <Trash2 className="size-3.5" /> Lixeira ({itensExcluidos.length})
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 max-md:w-full">
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as Periodo)}
            aria-label="Período"
            className={campo}
          >
            <option value="semana">Semana</option>
            <option value="mes">Mês</option>
            <option value="ano">Ano</option>
            <option value="data">Data específica</option>
          </select>
          {periodo === "data" && (
            <input
              type="date"
              value={dataEspecifica}
              onChange={(e) => setDataEspecifica(e.target.value)}
              aria-label="Data"
              className={campo}
            />
          )}
          <button
            onClick={() => {
              setEditando(null);
              setModalAberto(true);
            }}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary font-semibold px-3 py-2 text-[12.5px] text-primary-foreground fluid hover:opacity-90 max-md:h-10 max-md:px-4"
          >
            <Plus className="size-4" /> Novo item
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-auto px-3 py-4 md:px-6 md:py-5">
        {isLoading ? (
          <p className="text-[12.5px] text-muted-foreground">Carregando estoque…</p>
        ) : (
          <>
            <EstoqueKpis
              itens={itens}
              variacoes={variacoes}
              movimentacoes={movimentacoes}
              periodo={periodo}
              data={dataEspecifica}
            />

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1 max-md:basis-full">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar item pelo nome…"
                  className="w-full rounded-md border border-border bg-surface py-2 pl-8 pr-2.5 text-[13px] outline-none focus:border-primary max-md:h-10"
                />
              </div>
              <select
                value={filtroEstoque}
                onChange={(e) => setFiltroEstoque(e.target.value)}
                aria-label="Filtrar por estoque"
                className={campo}
              >
                <option value="todos">Todos os estoques</option>
                {estoquesDisponiveis.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
              <select
                value={ordem}
                onChange={(e) => setOrdem(e.target.value as Ordem)}
                aria-label="Ordenar"
                className={campo}
              >
                <option value="qtd-desc">Quantidade (maior-menor)</option>
                <option value="qtd-asc">Quantidade (menor-maior)</option>
                <option value="nome-asc">Nome (A-Z)</option>
                <option value="nome-desc">Nome (Z-A)</option>
              </select>
            </div>

            <EstoqueTable
              itens={visiveis}
              variacoes={variacoes}
              selectedId={detalheId}
              onSelect={(i) => setDetalheId(i.id)}
              onEdit={(i) => {
                setEditando(i);
                setModalAberto(true);
              }}
              onDelete={excluir}
            />

            <EstoqueGrafico movimentacoes={movimentacoes} periodo={periodo} data={dataEspecifica} />

            <MovimentacaoForm itens={itens} variacoes={variacoes} itemInicial={detalheId} />
          </>
        )}
      </div>

      {modalAberto && (
        <ItemModal
          item={editando}
          variacoes={variacoes}
          saving={createItem.isPending || updateItem.isPending}
          onClose={() => setModalAberto(false)}
          onSave={salvar}
        />
      )}

      {detalhe && (
        <ItemDetalheModal
          item={detalhe}
          variacoes={variacoes}
          movimentacoes={movimentacoes}
          comentarios={comentarios}
          onClose={() => setDetalheId(undefined)}
        />
      )}

      {lixeiraAberta && (
        <EstoqueLixeira
          itens={itensExcluidos}
          onRestore={(i) => restoreItem.mutate(i.id)}
          onClose={() => setLixeiraAberta(false)}
        />
      )}
    </div>
  );
}
