import { useEffect, useRef, useState } from "react";
import { Bug, ChevronLeft, ChevronRight, MessageSquare, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { openDockItem, useDockState, type DockItem } from "./side-dock-store";

// Aba recolhível presa à borda direita: agrupa Mensagens, Assistente IA e Chamado
// para que os atalhos flutuantes não cubram botões das telas.
export function SideDock() {
  const { chatAllowed, chatUnread, agentAvailable } = useDockState();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items: { id: DockItem; label: string; icon: typeof Bug; badge?: number }[] = [
    ...(chatAllowed
      ? [{ id: "chat" as const, label: "Mensagens", icon: MessageSquare, badge: chatUnread }]
      : []),
    ...(agentAvailable ? [{ id: "agent" as const, label: "Assistente IA", icon: Sparkles }] : []),
    { id: "bug", label: "Abrir chamado", icon: Bug },
  ];

  const unreadLabel = chatUnread > 99 ? "99+" : String(chatUnread);

  return (
    <div
      ref={ref}
      className="fixed right-0 top-1/2 z-50 flex -translate-y-1/2 items-center"
      data-testid="side-dock"
    >
      {open && (
        <nav
          aria-label="Atalhos"
          className="mr-px flex flex-col gap-1 rounded-l-md border border-r-0 bg-card p-1.5 text-card-foreground shadow-lg"
        >
          {items.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setOpen(false);
                openDockItem(id);
              }}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="flex-1 whitespace-nowrap">{label}</span>
              {badge ? (
                <span className="rounded-full bg-destructive px-1.5 text-xs text-destructive-foreground">
                  {badge > 99 ? "99+" : badge}
                </span>
              ) : null}
            </button>
          ))}
        </nav>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={
          open
            ? "Recolher atalhos"
            : chatUnread > 0
              ? `Abrir atalhos (${unreadLabel} mensagens não lidas)`
              : "Abrir atalhos"
        }
        className={cn(
          "relative flex h-24 w-7 items-center justify-center rounded-l-md border border-r-0 bg-primary text-primary-foreground shadow-md",
          "hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        {open ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        {!open && chatUnread > 0 && (
          <span className="absolute -left-2 -top-2 min-w-5 rounded-full bg-destructive px-1 text-center text-xs text-destructive-foreground">
            {unreadLabel}
          </span>
        )}
      </button>
    </div>
  );
}
