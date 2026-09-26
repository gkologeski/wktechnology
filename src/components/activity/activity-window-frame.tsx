import { Maximize2, Minimize2, Minus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWindowChrome, type WindowChrome } from "./activity-window-context";
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";
import { beginAuditSession, endAuditSession, touchAuditSession } from "@/lib/audit-session";

export function WindowControls({ chrome }: { chrome: WindowChrome }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        onClick={chrome.onMinimize}
        title="Minimizar"
        aria-label={`Minimizar ${chrome.title}`}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        onClick={chrome.onExpand}
        title={chrome.expanded ? "Restaurar tamanho" : "Expandir"}
        aria-label={chrome.expanded ? "Restaurar tamanho" : "Expandir"}
      >
        {chrome.expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        onClick={chrome.onClose}
        title="Fechar"
        aria-label={`Fechar ${chrome.title}`}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function WindowHeader({ chrome }: { chrome: WindowChrome }) {
  return (
    <div
      className="flex min-w-0 items-center justify-between gap-2 border-b border-product-divider bg-product-header px-3 py-2"
      onPointerDown={chrome.onFocus}
    >
      <strong className="truncate text-sm text-foreground">{chrome.title}</strong>
      <WindowControls chrome={chrome} />
    </div>
  );
}

export function ActivityWindowFrame({ children }: { children: React.ReactNode }) {
  const chrome = useWindowChrome();
  const session = useRef<string | null>(null);
  useEffect(() => {
    session.current = beginAuditSession();
    return () => {
      endAuditSession(session.current);
      session.current = null;
    };
  }, []);
  useEffect(() => {
    if (chrome?.position === 0 && !chrome.minimized) touchAuditSession(session.current);
  }, [chrome?.position, chrome?.minimized]);
  if (!chrome) return null;
  return (
    <section
      role="region"
      aria-label={chrome.title}
      onPointerDown={chrome.onFocus}
      className={cn(
        "fixed bottom-3 z-[120] flex max-h-[min(680px,calc(100dvh-2rem))] w-[min(480px,calc(100vw-2rem))] flex-col overflow-hidden rounded-md border border-product-divider bg-product-panel text-foreground shadow-xl max-sm:inset-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:w-screen max-sm:rounded-none",
        chrome.position === 0 ? "right-3" : "right-[min(500px,calc(100vw-500px))]",
        chrome.expanded &&
          "!right-3 !w-[min(860px,calc(100vw-1.5rem))] max-sm:!right-0 max-sm:!w-screen",
        chrome.position > 0 && "max-sm:hidden",
      )}
    >
      <WindowHeader chrome={chrome} />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain max-sm:pb-12">{children}</div>
    </section>
  );
}
