import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { db } from "@/lib/dados/cliente";
import { sanitizeRichHtml } from "@/lib/thc/sanitize";

export type PersonalNote = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

const KEY = ["personal-notes"];

/** Centraliza leitura e escrita das anotações pessoais (cache do React Query). */
export function useNotes(userId: string | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: KEY,
    enabled: !!userId,
    queryFn: async (): Promise<PersonalNote[]> => {
      const { data, error } = await db
        .from("personal_notes")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PersonalNote[];
    },
  });

  const patchCache = (id: string, patch: Partial<PersonalNote>) => {
    qc.setQueryData<PersonalNote[]>(KEY, (old) =>
      (old ?? []).map((n) => (n.id === id ? { ...n, ...patch } : n)),
    );
  };

  const criar = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sessão expirada.");
      const { data, error } = await db
        .from("personal_notes")
        .insert({ user_id: userId, title: "Nova anotação", content: "" })
        .select()
        .single();
      if (error) throw error;
      return data as PersonalNote;
    },
    onSuccess: (nota) => {
      qc.setQueryData<PersonalNote[]>(KEY, (old) => [nota, ...(old ?? [])]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const salvar = useMutation({
    mutationFn: async (vars: { id: string; title?: string; content?: string }) => {
      const patch: { title?: string; content?: string } = {};
      if (vars.title !== undefined) patch.title = vars.title;
      if (vars.content !== undefined) patch.content = sanitizeRichHtml(vars.content);
      const { data, error } = await db
        .from("personal_notes")
        .update(patch)
        .eq("id", vars.id)
        .select()
        .single();
      if (error) throw error;
      return data as PersonalNote;
    },
    onSuccess: (nota) => patchCache(nota.id, nota),
    onError: (e: Error) => toast.error(e.message),
  });

  const fixar = useMutation({
    mutationFn: async (vars: { id: string; is_pinned: boolean }) => {
      const { error } = await db
        .from("personal_notes")
        .update({ is_pinned: vars.is_pinned })
        .eq("id", vars.id);
      if (error) throw error;
      return vars;
    },
    onMutate: (vars) => patchCache(vars.id, { is_pinned: vars.is_pinned }),
    onError: (e: Error) => toast.error(e.message),
  });

  const mover = useMutation({
    mutationFn: async (vars: { id: string; paraLixeira: boolean }) => {
      const deleted_at = vars.paraLixeira ? new Date().toISOString() : null;
      const { error } = await db.from("personal_notes").update({ deleted_at }).eq("id", vars.id);
      if (error) throw error;
      return { ...vars, deleted_at };
    },
    onMutate: (vars) =>
      patchCache(vars.id, { deleted_at: vars.paraLixeira ? new Date().toISOString() : null }),
    // Se falhar, recarrega do banco para a nota não ficar no lugar errado da tela.
    onError: (e: Error) => {
      toast.error(e.message);
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("personal_notes").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.setQueryData<PersonalNote[]>(KEY, (old) => (old ?? []).filter((n) => n.id !== id));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    notes: query.data ?? [],
    loading: query.isLoading,
    criar,
    salvar,
    fixar,
    mover,
    excluir,
  };
}
