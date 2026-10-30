import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Recupera os dados sozinho quando a aba volta ao foco ou a internet retorna
        // (conexões instáveis deixavam a tela travada até um F5).
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: 2,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
