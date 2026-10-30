import { useState } from "react";
import { RichText } from "@/components/thc/RichText";
import { Avatar } from "@/components/thc/atoms";
import { useWorkspace } from "@/lib/thc/store";
import { useEstoqueMutations } from "@/lib/estoque/store";
import { sanitizeRichHtml } from "@/lib/thc/sanitize";
import { formatDateTime } from "@/lib/thc/utils";
import type { EstoqueComentario, EstoqueItem } from "@/lib/estoque/types";

export function EstoqueComentarios({
  item,
  comentarios,
}: {
  item: EstoqueItem;
  comentarios: EstoqueComentario[];
}) {
  const { profiles } = useWorkspace();
  const { comentar } = useEstoqueMutations();
  const [rascunho, setRascunho] = useState("");

  const lista = comentarios.filter((c) => c.item_id === item.id);

  const enviar = () => {
    const html = rascunho.trim();
    if (!html) return;
    const mentions = profiles.filter((p) => html.includes(p.nome)).map((p) => p.id);
    comentar.mutate(
      { item_id: item.id, body: html, mentions },
      { onSuccess: () => setRascunho("") },
    );
  };

  return (
    <div className="panel space-y-3 p-4">
      <h3 className="text-[13.5px] font-semibold">Comentários · {item.nome}</h3>

      <div className="space-y-3">
        {!lista.length && (
          <p className="text-[12px] text-muted-foreground">Nenhum comentário ainda.</p>
        )}
        {lista.map((c) => {
          const autor = profiles.find((p) => p.id === c.user_id) ?? null;
          return (
            <div key={c.id} className="flex gap-2">
              <Avatar user={autor} size={26} />
              <div className="min-w-0 flex-1">
                <p className="text-[11.5px] text-muted-foreground">
                  {autor?.nome ?? "—"} · {formatDateTime(c.created_at)}
                </p>
                <div
                  className="rich-body text-[12.5px]"
                  dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(c.body) }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        <RichText
          value={rascunho}
          onChange={setRascunho}
          placeholder="Escreva um comentário… use @ para mencionar"
          prefix="estoque-comentarios"
          people={profiles.map((p) => ({ id: p.id, nome: p.nome }))}
        />
        <button
          onClick={enviar}
          disabled={comentar.isPending}
          className="rounded-full bg-primary font-semibold px-3 py-1.5 text-[12.5px] text-primary-foreground fluid hover:opacity-90 disabled:opacity-60"
        >
          {comentar.isPending ? "Enviando…" : "Comentar"}
        </button>
      </div>
    </div>
  );
}
