import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RotateCw } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

// Tempo máximo esperando os dados voltarem antes de recarregar a página inteira.
const LIMITE_MS = 12_000;

/**
 * Forçar atualização: busca de novo todos os dados da tela. Se a busca falhar
 * ou travar, recarrega a página (reconecta sessão e tempo real do zero).
 */
export function BotaoAtualizar({ className }: { className?: string }) {
  const qc = useQueryClient();
  const [girando, setGirando] = useState(false);

  const atualizar = async () => {
    if (girando) return;
    setGirando(true);
    const inicio = Date.now();
    try {
      await Promise.race([
        qc.refetchQueries({ type: "active" }, { throwOnError: true }),
        new Promise((_, rejeitar) =>
          setTimeout(() => rejeitar(new Error("tempo esgotado")), LIMITE_MS),
        ),
      ]);
      // Gira pelo menos um pouco para o clique ter retorno visível.
      const resto = 600 - (Date.now() - inicio);
      if (resto > 0) await new Promise((r) => setTimeout(r, resto));
      toast.success("Dados atualizados.");
      setGirando(false);
    } catch {
      window.location.reload();
    }
  };

  return (
    <button
      type="button"
      onClick={() => void atualizar()}
      disabled={girando}
      title="Atualizar página"
      aria-label="Atualizar página"
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full border border-[var(--glass-border)] bg-surface text-foreground fluid hover:bg-surface-2 disabled:opacity-70",
        className,
      )}
    >
      <RotateCw className={cn("size-5", girando && "animate-spin")} />
    </button>
  );
}
