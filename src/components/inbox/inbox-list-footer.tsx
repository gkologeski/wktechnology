// Rodapé das listas paginadas da Inbox: carregar mais, total e erro parcial visível.
import { Button } from "@/components/ui/button";

export function InboxListFooter({
  loaded,
  total,
  hasMore,
  loadingMore,
  error,
  onLoadMore,
  onRetry,
}: {
  loaded: number;
  total: number | null;
  hasMore: boolean;
  loadingMore: boolean;
  error: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="px-1 pt-2" aria-live="polite">
      {error ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-destructive/40 px-3 py-2 text-xs text-destructive">
          <span>Não foi possível atualizar todas as conversas.</span>
          <Button size="sm" variant="outline" onClick={onRetry}>
            Tentar de novo
          </Button>
        </div>
      ) : hasMore ? (
        <Button size="sm" variant="outline" className="w-full" disabled={loadingMore} onClick={onLoadMore}>
          {loadingMore ? "Carregando…" : `Carregar mais (${loaded} de ${total ?? loaded})`}
        </Button>
      ) : total != null && total > 0 ? (
        <p className="text-center text-xs text-muted-foreground">
          {total} conversa{total === 1 ? "" : "s"}
        </p>
      ) : null}
    </div>
  );
}
