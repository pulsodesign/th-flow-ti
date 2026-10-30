import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RotateCcw, Trash2 } from "@/components/ui/icon";
import { toast } from "sonner";
import { useTaskMutations, useTrash, useWorkspace } from "@/lib/thc/store";
import { useAuth } from "@/lib/thc/auth";
import { formatDate } from "@/lib/thc/utils";

export const Route = createFileRoute("/_authenticated/lixeira")({
  head: () => ({
    meta: [
      { title: "Lixeira — TH Flow" },
      {
        name: "description",
        content: "Tarefas excluídas ficam na lixeira por 30 dias e podem ser restauradas.",
      },
      { property: "og:title", content: "Lixeira — TH Flow" },
      {
        property: "og:description",
        content: "Restaure ou exclua definitivamente tarefas removidas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LixeiraPage,
});

function LixeiraPage() {
  const { data: tarefas = [], isLoading } = useTrash();
  const { profiles } = useWorkspace();
  const { restoreTask, purgeTask } = useTaskMutations();
  const { isGestor } = useAuth();
  const navigate = useNavigate();

  const restaurar = async (id: string) => {
    try {
      const { task, arquivada } = await restoreTask.mutateAsync(id);
      const board = task.board_id ?? task.projeto_id;
      const abrir = board
        ? {
            label: "Abrir",
            onClick: () =>
              void navigate({
                to: "/quadro/$boardId",
                params: { boardId: board },
                search: { task: task.id } as never,
              }),
          }
        : undefined;
      // Entregue há mais de 60 dias: volta arquivada, só aparece pela busca do quadro.
      if (arquivada) {
        toast.success("Tarefa restaurada como arquivada.", {
          description: "Foi entregue há mais de 60 dias. Busque pelo título no quadro para vê-la.",
          action: abrir,
        });
      } else {
        toast.success("Tarefa restaurada.", { action: abrir });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível restaurar.");
    }
  };

  const nome = (id: string | null) => profiles.find((p) => p.id === id)?.nome ?? "—";

  return (
    <div className="flex h-full flex-col">
      <header className="px-8 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Retenção de 30 dias
        </p>
        <h1 className="mt-1 text-[30px] font-light leading-[1.05] tracking-[-0.02em] md:text-[44px]">
          Lixeira
        </h1>
        <p className="mt-1 text-[12px] text-muted-foreground">
          {isGestor
            ? "Você vê as tarefas excluídas de toda a equipe."
            : "Você vê as tarefas excluídas que criou, das quais participava ou dos seus quadros."}
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-3 py-4 md:px-6 md:py-5">
        <div className="panel overflow-hidden">
          <table className="w-full text-[12.5px] max-md:block">
            <thead className="bg-surface/70 text-[11px] uppercase tracking-[0.1em] text-muted-foreground max-md:hidden">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Tarefa</th>
                <th className="px-3 py-2 text-left font-medium">Criador</th>
                <th className="px-3 py-2 text-left font-medium">Excluída em</th>
                <th className="px-3 py-2 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="max-md:block">
              {tarefas.map((t) => (
                <tr
                  key={t.id}
                  className="border-t border-border/70 hover:bg-surface/40 max-md:flex max-md:flex-wrap max-md:items-center max-md:gap-x-2 max-md:gap-y-1 max-md:p-4 max-md:first:border-t-0"
                >
                  <td className="px-3 py-2 max-md:w-full max-md:p-0 max-md:text-[14px] max-md:font-medium">
                    {t.titulo}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground max-md:p-0">
                    {nome(t.criador_id)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground max-md:p-0 max-md:before:mr-2 max-md:before:content-['·']">
                    {formatDate(t.deletada_em ? t.deletada_em.slice(0, 10) : null)}
                  </td>
                  <td className="px-3 py-2 max-md:mt-2 max-md:w-full max-md:p-0">
                    <div className="flex items-center justify-end gap-2 max-md:justify-start">
                      <button
                        onClick={() => void restaurar(t.id)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[11.5px] fluid hover:bg-surface max-md:h-10 max-md:rounded-full max-md:px-4 max-md:text-[13px]"
                      >
                        <RotateCcw className="size-3.5" /> Restaurar
                      </button>
                      <button
                        onClick={() => {
                          if (!window.confirm("Excluir esta tarefa definitivamente?")) return;
                          void purgeTask
                            .mutateAsync(t.id)
                            .then(() => toast.success("Tarefa excluída definitivamente."))
                            .catch(() => toast.error("Não foi possível excluir."));
                        }}
                        className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 px-2.5 py-1 text-[11.5px] text-destructive fluid hover:bg-destructive/10 max-md:h-10 max-md:rounded-full max-md:px-4 max-md:text-[13px]"
                      >
                        <Trash2 className="size-3.5" /> Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!tarefas.length && (
                <tr className="max-md:block">
                  <td
                    colSpan={4}
                    className="max-md:block px-3 py-8 text-center text-muted-foreground"
                  >
                    {isLoading ? "Carregando…" : "A lixeira está vazia."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
