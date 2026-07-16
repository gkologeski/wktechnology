// Ponte entre os primitives de Dialog/Sheet/AlertDialog/Drawer e o QueryClient
// do TanStack Query, além de um pequeno pub/sub para painéis que ainda usam
// `useState + useEffect` em vez de Query (Fase 6).
//
// Contexto: muitos modais no app editam dados via seus próprios saves e nem
// sempre chamam `queryClient.invalidateQueries` no consumidor. Para eliminar
// a necessidade de F5, os primitives em `src/components/ui/*` estão envolvidos
// e chamam `notifyDialogClosed()` ao transicionarem de aberto → fechado.
//
// A ponte então invalida todas as queries **ativas** (montadas), que refazem
// fetch imediatamente. Queries inativas são apenas marcadas como stale.
// Painéis não-Query podem se inscrever via `subscribeDialogClosed` para
// reexecutar suas próprias funções de load.
import type { QueryClient } from "@tanstack/react-query";

let clientRef: QueryClient | null = null;
const listeners = new Set<() => void>();

export function bindDialogRefreshClient(client: QueryClient) {
  clientRef = client;
}

export function notifyDialogClosed() {
  if (clientRef) {
    // Refetch apenas o que está montado no momento, evitando trabalho inútil.
    clientRef.invalidateQueries({ refetchType: "active" });
  }
  for (const l of listeners) {
    try {
      l();
    } catch {
      // ignore listener errors
    }
  }
}

export function subscribeDialogClosed(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
