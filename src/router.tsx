import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000, // 1 min — evita refetch agressivo ao navegar
        gcTime: 2 * 60_000, // 2 min — libera memória de queries inativas mais cedo
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Pré-carrega o chunk da rota ao passar o mouse sobre um link
    defaultPreload: "intent",
    defaultPreloadDelay: 50,
    // Query controla cache de dados; router só precisa do código da rota
    defaultPreloadStaleTime: 0,
  });

  return router;
};

