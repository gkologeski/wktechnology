// Ponte entre os primitives de Dialog/Sheet/AlertDialog/Drawer e o QueryClient
// do TanStack Query.
//
// Contexto: muitos modais no app editam dados via seus próprios saves e nem
// sempre chamam `queryClient.invalidateQueries` no consumidor. Para eliminar
// a necessidade de F5, os primitives em `src/components/ui/*` estão envolvidos
// e chamam `notifyDialogClosed()` ao transicionarem de aberto → fechado.
//
// A ponte então invalida todas as queries **ativas** (montadas), que refazem
// fetch imediatamente. Queries inativas são apenas marcadas como stale.
import type { QueryClient } from "@tanstack/react-query";

let clientRef: QueryClient | null = null;

export function bindDialogRefreshClient(client: QueryClient) {
  clientRef = client;
}

export function notifyDialogClosed() {
  if (!clientRef) return;
  // Refetch apenas o que está montado no momento, evitando trabalho inútil.
  clientRef.invalidateQueries({ refetchType: "active" });
}
