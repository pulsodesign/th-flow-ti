import { useEffect, useState } from "react";
import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { Menu, X } from "@/components/ui/icon";
import { db } from "@/lib/dados/cliente";
import { AppSidebar } from "@/components/thc/AppSidebar";
import { LogoTHFlow } from "@/components/thc/LogoTHFlow";
import { registrarServiceWorker } from "@/lib/thc/push";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await db.auth.usuario();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const [aberto, setAberto] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Service worker das notificações push (desktop, Android e iPhone com atalho).
  useEffect(() => {
    void registrarServiceWorker();
  }, []);

  // Fecha o drawer automaticamente ao navegar (mobile)
  useEffect(() => {
    setAberto(false);
  }, [pathname]);

  // No celular o app desenha o próprio fundo atrás da barra de status (viewport-fit=cover)
  // e afasta o conteúdo das áreas do sistema com as safe areas.
  return (
    <div className="flex h-dvh w-full overflow-hidden max-md:pb-[env(safe-area-inset-bottom)] max-md:pl-[env(safe-area-inset-left)] max-md:pr-[env(safe-area-inset-right)] max-md:pt-[env(safe-area-inset-top)] md:gap-2 md:p-3">
      {/* Sidebar fixa no desktop */}
      <div className="hidden md:flex">
        <AppSidebar />
      </div>

      {/* Drawer mobile */}
      {aberto && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            aria-label="Fechar menu"
            onClick={() => setAberto(false)}
            className="absolute inset-0 bg-black/60"
          />
          <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] right-2 top-[calc(env(safe-area-inset-top)+0.5rem)] flex w-[280px] max-w-[85vw] rounded-[28px] bg-popover shadow-2xl">
            <AppSidebar gaveta />
          </div>
          <button
            aria-label="Fechar menu"
            onClick={() => setAberto(false)}
            className="absolute left-3 top-[calc(env(safe-area-inset-top)+0.75rem)] grid size-10 place-items-center rounded-full bg-popover text-foreground shadow-lg"
          >
            <X className="size-5" />
          </button>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Topbar apenas no mobile */}
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border pb-2 pl-4 pr-3 pt-6 md:hidden">
          <LogoTHFlow className="h-8" />
          <button
            aria-label="Abrir menu"
            onClick={() => setAberto(true)}
            className="grid size-10 place-items-center rounded-full border border-[var(--glass-border)] bg-tile text-foreground shadow-[var(--shadow-soft)]"
          >
            <Menu className="size-5" />
          </button>
        </header>

        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
