import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck } from "@/components/ui/icon";
import { useWorkspace } from "@/lib/thc/store";
import { useAuth } from "@/lib/thc/auth";
import { Avatar } from "@/components/thc/atoms";
import { AcessoPanel } from "@/components/thc/AcessoPanel";
import { listarEquipeAdmin } from "@/lib/thc/admin.functions";

export const Route = createFileRoute("/_authenticated/equipe")({
  head: () => ({
    meta: [
      { title: "Equipe — TH Flow" },
      {
        name: "description",
        content: "Lista de membros da equipe TH Flow com cargo, e-mail e nível de acesso.",
      },
      { property: "og:title", content: "Equipe — TH Flow" },
      { property: "og:description", content: "Conheça quem faz parte da operação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const { profiles, roleOf, tasks, statuses } = useWorkspace();
  const { isGestor } = useAuth();
  const listar = useServerFn(listarEquipeAdmin);
  const { data: adminProfiles } = useQuery({
    queryKey: ["admin-team-directory"],
    queryFn: () => listar(),
    enabled: isGestor,
  });
  const visibleProfiles = adminProfiles ?? profiles;
  const doneKeys = statuses.filter((s) => s.is_done).map((s) => s.chave);

  return (
    <div className="flex h-full flex-col">
      <header className="px-4 py-4 md:px-8 md:py-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Pessoas
        </p>
        <h1 className="mt-1 text-[30px] font-light leading-[1.05] tracking-[-0.02em] md:text-[44px]">
          Equipe
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {visibleProfiles.length} membros ativos.
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-4 md:px-8 md:py-6 rise-in">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleProfiles.map((p) => {
            const abertas = tasks.filter(
              (t) => t.usuario_id.includes(p.id) && !doneKeys.includes(t.status),
            ).length;
            return (
              <article key={p.id} className="panel flex items-center gap-3 p-4">
                <Avatar user={p} size={40} />
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-medium">{p.nome}</p>
                  <p className="truncate text-[12px] text-muted-foreground">{p.cargo}</p>
                </div>
                <div className="ml-auto shrink-0 text-right">
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">
                    {(adminProfiles?.find((profile) => profile.id === p.id)?.role ??
                      roleOf(p.id)) === "gestor"
                      ? "Administrador"
                      : "Membro"}
                  </span>
                  <p className="mt-1.5 text-[11.5px] text-muted-foreground">{abertas} abertas</p>
                </div>
              </article>
            );
          })}
          {!visibleProfiles.length && (
            <p className="text-[12.5px] text-muted-foreground">Nenhum membro cadastrado ainda.</p>
          )}
        </div>

        {isGestor && (
          <div className="mt-8 border-t border-border pt-6">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary-ink" />
              <h2 className="text-[14px] font-semibold tracking-tight">Acesso & Administração</h2>
            </div>
            <AcessoPanel />
          </div>
        )}
      </div>
    </div>
  );
}
