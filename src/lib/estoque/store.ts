import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { db } from "@/lib/dados/cliente";
import { sanitizeRichHtml } from "@/lib/thc/sanitize";
import {
  TAMANHOS,
  type EstoqueComentario,
  type EstoqueItem,
  type EstoqueMovimentacao,
  type EstoqueVariacao,
  type Tamanho,
} from "./types";

const KEY = ["estoque"];

type EstoqueData = {
  itens: EstoqueItem[];
  variacoes: EstoqueVariacao[];
  movimentacoes: EstoqueMovimentacao[];
  comentarios: EstoqueComentario[];
};

async function fetchEstoque(): Promise<EstoqueData> {
  const [itens, variacoes, movimentacoes, comentarios] = await Promise.all([
    db.from("estoque_itens").select("*").order("created_at", { ascending: false }),
    db.from("estoque_variacoes").select("*"),
    db.from("estoque_movimentacoes").select("*").order("created_at", { ascending: false }),
    db.from("estoque_comentarios").select("*").order("created_at", { ascending: true }),
  ]);
  const erro = itens.error ?? variacoes.error ?? movimentacoes.error ?? comentarios.error;
  if (erro) throw erro;
  return {
    itens: ((itens.data ?? []) as EstoqueItem[]).map((i) => ({ ...i, locais: i.locais ?? [] })),
    variacoes: (variacoes.data ?? []) as EstoqueVariacao[],
    movimentacoes: (movimentacoes.data ?? []) as EstoqueMovimentacao[],
    comentarios: ((comentarios.data ?? []) as EstoqueComentario[]).map((c) => ({
      ...c,
      mentions: c.mentions ?? [],
    })),
  };
}

/** Consulta principal do estoque, atualizada quando as tabelas do estoque mudam. */
export function useEstoqueItens() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: KEY, queryFn: fetchEstoque });

  useEffect(() => {
    const canal = db.canal();
    for (const table of [
      "estoque_itens",
      "estoque_variacoes",
      "estoque_movimentacoes",
      "estoque_comentarios",
    ]) {
      canal.escutar({ tabela: table }, () => {
        void qc.invalidateQueries({ queryKey: KEY });
      });
    }
    canal.iniciar();
    return () => {
      db.removerCanal(canal);
    };
  }, [qc]);

  return {
    ...query,
    itens: (query.data?.itens ?? []).filter((i) => !i.deletado_em),
    itensExcluidos: (query.data?.itens ?? []).filter((i) => !!i.deletado_em),
    variacoes: query.data?.variacoes ?? [],
    movimentacoes: query.data?.movimentacoes ?? [],
    comentarios: query.data?.comentarios ?? [],
  };
}

export type ItemInput = {
  nome: string;
  foto_url: string | null;
  locais: string[];
  tem_variacao_tamanho: boolean;
  quantidade: number;
  variacoes: Record<Tamanho, number>;
};

export function useEstoqueMutations() {
  const qc = useQueryClient();
  const invalidar = () => void qc.invalidateQueries({ queryKey: KEY });

  const salvarVariacoes = async (itemId: string, input: ItemInput) => {
    if (!input.tem_variacao_tamanho) {
      await db.from("estoque_variacoes").delete().eq("item_id", itemId);
      return;
    }
    const rows = TAMANHOS.map((t) => ({
      item_id: itemId,
      tamanho: t,
      quantidade: Number(input.variacoes[t] ?? 0),
    }));
    const { error } = await db
      .from("estoque_variacoes")
      .upsert(rows, { onConflict: "item_id,tamanho" });
    if (error) throw error;
  };

  const createItem = useMutation({
    mutationFn: async (input: ItemInput) => {
      const { data: auth } = await db.auth.usuario();
      const { data, error } = await db
        .from("estoque_itens")
        .insert({
          nome: input.nome,
          foto_url: input.foto_url,
          locais: input.locais,
          tem_variacao_tamanho: input.tem_variacao_tamanho,
          quantidade: input.tem_variacao_tamanho ? 0 : Number(input.quantidade ?? 0),
          created_by: auth.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      await salvarVariacoes(data.id, input);
      return data as EstoqueItem;
    },
    onSuccess: () => {
      toast.success("Item criado");
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ItemInput }) => {
      const { error } = await db
        .from("estoque_itens")
        .update({
          nome: input.nome,
          foto_url: input.foto_url,
          locais: input.locais,
          tem_variacao_tamanho: input.tem_variacao_tamanho,
          quantidade: input.tem_variacao_tamanho ? 0 : Number(input.quantidade ?? 0),
        })
        .eq("id", id);
      if (error) throw error;
      await salvarVariacoes(id, input);
    },
    onSuccess: () => {
      toast.success("Item atualizado");
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from("estoque_itens")
        .update({ deletado_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item movido para a lixeira");
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const restoreItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("estoque_itens").update({ deletado_em: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item restaurado");
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const registrarMovimentacao = useMutation({
    mutationFn: async (args: {
      item_id: string;
      variacao_id: string | null;
      tipo: "entrada" | "saida";
      quantidade: number;
      observacao: string;
    }) => {
      const { error } = await db.rpc("registrar_movimentacao_estoque", {
        _item_id: args.item_id,
        _variacao_id: args.variacao_id as string,
        _tipo: args.tipo,
        _quantidade: args.quantidade,
        _observacao: (args.observacao || null) as string,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Movimentação registrada");
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível registrar a movimentação"),
  });

  const comentar = useMutation({
    mutationFn: async (args: { item_id: string; body: string; mentions: string[] }) => {
      const { data: auth } = await db.auth.usuario();
      const { error } = await db.from("estoque_comentarios").insert({
        item_id: args.item_id,
        body: sanitizeRichHtml(args.body),
        mentions: args.mentions,
        user_id: auth.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: (e: Error) => toast.error(e.message),
  });

  return { createItem, updateItem, deleteItem, restoreItem, registrarMovimentacao, comentar };
}
