import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/thc/auth";
import { db } from "@/lib/dados/cliente";
import { boardSlug } from "@/lib/thc/slug";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TH Flow — Gestão de Projetos" },
      {
        name: "description",
        content:
          "Plataforma de gestão de demandas da TH Flow: quadros, tarefas, prazos e times em um só lugar.",
      },
      { property: "og:title", content: "TH Flow — Gestão de Projetos" },
      {
        property: "og:description",
        content: "Quadros Kanban, lista, calendário e automações para a operação de marketing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      void navigate({ to: "/auth", replace: true });
      return;
    }
    // Redireciona cada usuário para o seu quadro individual (fallback: dashboard).
    void (async () => {
      const { data: board } = await db
        .from("projects")
        .select("id, nome, owner_id, kind")
        .eq("kind", "individual")
        .eq("owner_id", session.user.id)
        .maybeSingle();
      if (board) {
        const { data: perfil } = await db
          .from("profiles")
          .select("id, nome, cargo, foto_perfil, cor, created_at, updated_at")
          .eq("id", session.user.id)
          .maybeSingle();
        const slug = boardSlug(board as never, perfil ? [perfil as never] : []);
        void navigate({
          to: "/quadro/$boardId",
          params: { boardId: slug },
          search: {} as never,
          replace: true,
        });
      } else {
        void navigate({ to: "/dashboard", replace: true });
      }
    })();
  }, [session, loading, navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="sr-only">TH Flow</h1>
      <svg
        viewBox="-2 -2 130.53 149.45"
        aria-hidden
        className="carregamento-marca h-32 w-auto sm:h-40 text-primary"
      >
        <path
          pathLength={1}
          d="M4.92,70.31l.19-5.57c.52-3.65,2.04-6.94,4.47-9.68l4.1-4.04,3.36-3.13,3.36-3.12,3.6-3.35,3.36-3.12,3.36-3.12,3.6-3.35,3.36-3.12,3.36-3.12,3.6-3.35,3.36-3.12,3.36-3.12,3.6-3.36,3.45-3.26c3.6-3.4,8.49-5.09,13.35-4.73,5.29.39,9.02,3.17,12.38,6.93l34.08,38.06c2.76,4.25,5.24,8.93,5.24,14.19l-.02,40.48c0,6.2-3.79,11.55-8.74,14.71-2.41,1.54-4.88,2.35-7.64,3.01l-61.07,14.48c-7.34,1.73-14.52,3.12-21.96,4.17l-2.94.15-3.25-.26c-6.15-.48-11.02-4.63-13.12-10.39-1.39-3.83-1.94-7.84-1.45-11.91l.21-5.8,1.46-42.18ZM10.17,98.45l-.22,6.18-.23,6-.24,6.2c-.18,4.63-.58,8.7,1.82,13.01s7.66,5.46,12.44,4.66l7.49-1.24c13.38-2.55,26.48-5.7,39.78-8.9l36.13-8.69c5.6-1.35,9.63-5.6,10.14-11.46l.25-2.87-.05-13.28v-16.06s.03-6.32.03-6.32c-.47-4.25-1.24-8.93-4.26-12.3L79.53,15.68c-2.44-3.3-6.04-5.21-10.2-4.95-2.49.31-4.8,1.27-6.61,2.98l-3.69,3.49-3.36,3.12-3.6,3.35-3.36,3.12-3.36,3.12-3.6,3.35-3.36,3.12-3.6,3.35-3.36,3.12-3.36,3.12-3.6,3.35-3.36,3.12-3.36,3.13-3.62,3.56c-1.95,1.92-2.97,4.53-3.02,7.3l-.22,11.08-.47,14.4-.26,6.53Z"
        />
      </svg>
    </main>
  );
}
