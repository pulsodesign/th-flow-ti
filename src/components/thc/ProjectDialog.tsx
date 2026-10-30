import { useEffect, useState } from "react";
import { Check } from "@/components/ui/icon";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar } from "@/components/thc/atoms";
import { useWorkspace } from "@/lib/thc/store";
import type { Project } from "@/lib/thc/types";
import { cn } from "@/lib/utils";

export function ProjectDialog({
  open,
  project,
  onClose,
  onSave,
}: {
  open: boolean;
  project: Project | null;
  onClose: () => void;
  onSave: (nome: string, responsaveis: string[]) => Promise<void> | void;
}) {
  const { profiles } = useWorkspace();
  const [nome, setNome] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNome(project?.nome ?? "");
    setSel(project?.responsaveis_padrao ?? []);
  }, [open, project]);

  const toggle = (id: string) =>
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const salvar = async () => {
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      await onSave(nome.trim(), sel);
      onClose();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{project ? "Editar projeto" : "Novo projeto"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Nome
            </label>
            <input
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void salvar()}
              placeholder="Ex.: Social"
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Responsáveis padrão
            </label>
            <p className="mb-2 text-[11.5px] text-muted-foreground">
              Atribuídos automaticamente quando a tag "{nome || "projeto"}" for usada numa tarefa.
            </p>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {profiles.map((p) => {
                const on = sel.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md border px-2.5 py-2 text-left text-[12.5px] fluid",
                      on ? "border-primary/50 bg-primary/10" : "border-border hover:bg-surface-2",
                    )}
                  >
                    <Avatar user={p} size={22} />
                    <span className="flex-1">
                      {p.nome} <span className="text-muted-foreground">· {p.cargo}</span>
                    </span>
                    {on && <Check className="size-4 text-primary-ink" />}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-border px-3 py-2 text-[12.5px] hover:bg-surface"
            >
              Cancelar
            </button>
            <button
              disabled={salvando || !nome.trim()}
              onClick={() => void salvar()}
              className="rounded-full bg-primary font-semibold px-3 py-2 text-[12.5px] text-primary-foreground disabled:opacity-50"
            >
              {project ? "Salvar" : "Criar projeto"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
