// Área rolável do histórico: "Carregar anteriores" com âncora de rolagem,
// fica no fim só se o usuário já estava no fim e avisa novas mensagens.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { anchoredScrollTop, isNearBottom } from "@/lib/inbox/message-history";

export function MessageHistoryViewport({
  resetKey,
  count,
  firstId,
  lastId,
  hasOlder,
  olderLoading,
  olderError,
  syncError,
  degraded,
  onLoadOlder,
  onRetrySync,
  className,
  children,
}: {
  resetKey: string | null;
  count: number;
  firstId: string | null;
  lastId: string | null;
  hasOlder: boolean;
  olderLoading: boolean;
  olderError: string | null;
  syncError?: string | null;
  degraded?: boolean;
  onLoadOlder: () => void;
  onRetrySync?: () => void;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const snap = useRef({ scrollHeight: 0, scrollTop: 0, clientHeight: 0, nearBottom: true });
  const prev = useRef<{
    key: string | null;
    first: string | null;
    last: string | null;
    count: number;
  }>({
    key: null,
    first: null,
    last: null,
    count: 0,
  });
  const [unseen, setUnseen] = useState(0);
  // Âncora manual: primeiro item visível e sua distância ao topo. A âncora nativa do
  // navegador não compensou corpos de e-mail carregados depois (medido no preview).
  const anchor = useRef<{ el: Element; top: number } | null>(null);

  const record = () => {
    const el = ref.current;
    if (!el) return;
    snap.current = {
      scrollHeight: el.scrollHeight,
      scrollTop: el.scrollTop,
      clientHeight: el.clientHeight,
      nearBottom: isNearBottom(el),
    };
    const vTop = el.getBoundingClientRect().top;
    anchor.current = null;
    // Primeiro item que começa dentro da área visível: se um item parcialmente visível
    // acima crescer (corpo/mídia), o que está sendo lido continua no lugar.
    let partial: { el: Element; top: number } | null = null;
    for (const child of Array.from(contentRef.current?.children ?? [])) {
      const r = child.getBoundingClientRect();
      if (r.height <= 0 || r.bottom <= vTop) continue;
      if (r.top >= vTop - 1) {
        anchor.current = { el: child, top: r.top - vTop };
        break;
      }
      partial ??= { el: child, top: r.top - vTop };
    }
    if (!anchor.current) anchor.current = partial;
  };
  /** Devolve o item âncora à mesma distância do topo. */
  const restoreAnchor = () => {
    const el = ref.current;
    const a = anchor.current;
    if (!el || !a || !a.el.isConnected) return false;
    const delta = a.el.getBoundingClientRect().top - el.getBoundingClientRect().top - a.top;
    if (delta) el.scrollTop += delta;
    return true;
  };
  const toBottom = () => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setUnseen(0);
    record();
  };

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const p = prev.current;
    if (p.key !== resetKey) {
      setUnseen(0);
      if (lastId) toBottom();
    } else if (p.first && firstId && p.first !== firstId && p.last === lastId) {
      // Itens antigos entraram acima: mantém o que o usuário estava lendo.
      if (!restoreAnchor()) el.scrollTop = anchoredScrollTop(snap.current, el.scrollHeight);
    } else if (lastId && p.last !== lastId) {
      if (!p.last || snap.current.nearBottom) toBottom();
      else setUnseen((n) => n + Math.max(1, count - p.count));
    }
    prev.current = {
      key: lastId ? resetKey : p.key === resetKey ? p.key : null,
      first: firstId,
      last: lastId,
      count,
    };
    record();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, firstId, lastId, count]);

  // Mídias/anexos que mudam de altura: no fim continua no fim.
  useEffect(() => {
    const c = contentRef.current;
    if (!c || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (snap.current.nearBottom) toBottom();
      else {
        restoreAnchor();
        record();
      }
    });
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={ref}
        onScroll={() => {
          record();
          if (snap.current.nearBottom && unseen) setUnseen(0);
          const el = ref.current;
          if (
            el &&
            el.scrollTop < 40 &&
            el.scrollHeight > el.clientHeight &&
            hasOlder &&
            !olderLoading &&
            !olderError
          )
            onLoadOlder();
        }}
        className={cn("min-h-0 flex-1 overflow-y-auto [overflow-anchor:none]", className)}
        aria-live="polite"
        data-testid="message-history"
      >
        <div ref={contentRef} className="space-y-5">
          {(hasOlder || olderLoading || olderError) && (
            <div className="flex justify-center">
              {olderError ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-destructive">
                  Não foi possível carregar as anteriores.
                  <Button size="sm" variant="outline" onClick={onLoadOlder}>
                    Tentar novamente
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="ghost" onClick={onLoadOlder} disabled={olderLoading}>
                  {olderLoading && (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden />
                  )}
                  Carregar anteriores
                </Button>
              )}
            </div>
          )}
          {children}
        </div>
      </div>
      {(syncError || degraded) && (
        <div
          className="flex items-center justify-between gap-2 border-t border-border bg-product-panel px-4 py-1.5 text-xs text-muted-foreground"
          role="status"
        >
          <span>
            {syncError
              ? "Não foi possível atualizar as novas mensagens."
              : "Atualização automática indisponível; conferindo a cada 30 s."}
          </span>
          {onRetrySync && (
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={onRetrySync}>
              Atualizar agora
            </Button>
          )}
        </div>
      )}
      {unseen > 0 && (
        <Button
          size="sm"
          className="absolute bottom-12 left-1/2 -translate-x-1/2 shadow-md"
          onClick={toBottom}
        >
          <ArrowDown className="mr-1 h-3.5 w-3.5" aria-hidden />
          {unseen === 1 ? "1 nova mensagem" : `${unseen} novas mensagens`}
        </Button>
      )}
    </div>
  );
}
