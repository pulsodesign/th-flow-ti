import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/thc/auth";
import { useWorkspace } from "@/lib/thc/store";
import { ListView } from "@/components/thc/ListView";
import { TaskModal } from "@/components/thc/TaskModal";
import type { Task } from "@/lib/thc/types";

export const Route = createFileRoute("/_authenticated/minhas-tarefas")({
  head: () => ({
    meta: [
      { title: "Minhas Tarefas — TH Flow" },
      {
        name: "description",
        content: "Todas as tarefas atribuídas a você na operação da TH Flow.",
      },
      { property: "og:title", content: "Minhas Tarefas — TH Flow" },
      { property: "og:description", content: "Foco individual: suas demandas e prazos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyTasks,
});

function MyTasks() {
  const { userId, profile } = useAuth();
  const { tasks } = useWorkspace();
  const [open, setOpen] = useState<Task | null>(null);

  const mine = tasks.filter((t) => userId && t.usuario_id.includes(userId));
  const current = open ? (tasks.find((t) => t.id === open.id) ?? null) : null;

  return (
    <div className="flex h-full flex-col">
      <header className="px-4 py-4 md:px-8 md:py-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Foco
        </p>
        <h1 className="mt-1 text-[30px] font-light leading-[1.05] tracking-[-0.02em] md:text-[44px]">
          Minhas Tarefas
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {mine.length} tarefas atribuídas a {profile?.nome ?? "você"}.
        </p>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden rise-in">
        <ListView board={null} tasks={mine} onOpen={setOpen} />
      </div>
      <TaskModal task={current} onClose={() => setOpen(null)} />
    </div>
  );
}
