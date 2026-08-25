import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter, Link, useRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { bindDialogRefreshClient } from "@/lib/dialog-refresh";
import { handlePermissionError } from "@/lib/access-control/handle-permission-error";

function DefaultErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          type="button"
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

function DefaultNotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <p className="mt-4 text-muted-foreground">Página não encontrada.</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Ir para o início
        </Link>
      </div>
    </div>
  );
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        handlePermissionError(error);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        handlePermissionError(error);
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 60_000, // 1 min — evita refetch agressivo ao navegar
        gcTime: 2 * 60_000, // 2 min — libera memória de queries inativas mais cedo
        // Revalida ao voltar o foco/janela: garante que dados alterados em
        // outra aba, modal ou processo apareçam sem F5.
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: (failureCount, error) => {
          // Não faz retry em erros de permissão — mostrar toast imediatamente.
          const status = (error as { status?: number } | null)?.status;
          if (status === 403 || status === 401) return false;
          return failureCount < 1;
        },
      },
    },
  });

  bindDialogRefreshClient(queryClient);

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Pré-carrega o chunk da rota ao passar o mouse sobre um link
    defaultPreload: "intent",
    defaultPreloadDelay: 50,
    // Query controla cache de dados; router só precisa do código da rota
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorComponent,
    defaultNotFoundComponent: DefaultNotFoundComponent,
  });

  return router;
};
