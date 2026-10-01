import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { ArrowLeft, Inbox, Mail, MessageCircle, PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { WhatsAppIcon } from "@/components/whatsapp/whatsapp-icon";
import { cn } from "@/lib/utils";

const CHANNELS = [
  { to: "/inbox" as const, label: "Unificada", icon: Inbox },
  { to: "/inbox/email" as const, label: "Email", icon: Mail },
  { to: "/inbox/whatsapp" as const, label: "WhatsApp", icon: WhatsAppIcon },
  { to: "/inbox/chat" as const, label: "Chat ao vivo", icon: MessageCircle },
];

/**
 * Casco "Modern unified interface": barra superior única (título + abas de canal + ações),
 * lista de conversas, conversa e contexto recolhível — sem coluna de canais redundante.
 * Todas as cores/tipografia vêm dos tokens do White Label.
 */
export function InboxWorkspace({
  title,
  description,
  actions,
  list,
  conversation,
  context,
  contextOpen = true,
  onContextOpenChange,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  list: ReactNode;
  conversation: ReactNode;
  context?: ReactNode;
  contextOpen?: boolean;
  onContextOpenChange?: (open: boolean) => void;
}) {
  const [mobilePane, setMobilePane] = useState<"list" | "conversation">("list");
  const [localContextOpen, setLocalContextOpen] = useState(true);
  const resolvedContextOpen = onContextOpenChange ? contextOpen : localContextOpen;
  const setContextOpen = onContextOpenChange ?? setLocalContextOpen;
  const showContext = !!context && resolvedContextOpen;

  return (
    <div className="flex h-[calc(100dvh-4rem)] min-h-[36rem] flex-col bg-product-canvas">
      <header className="flex flex-col gap-2 border-b border-border bg-product-header px-3 py-2 sm:px-4 lg:flex-row lg:items-center lg:gap-4">
        <div className="flex min-w-0 shrink items-center gap-3 lg:max-w-[16rem]">
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-foreground">{title}</h1>
            <p className="hidden truncate text-xs text-muted-foreground xl:block">{description}</p>
          </div>
        </div>
        <InboxChannelTabs />
        <div className="flex shrink-0 items-center gap-2 lg:ml-auto [&>*]:shrink-0">
          {actions}
          {context ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="hidden xl:inline-flex"
              onClick={() => setContextOpen(!resolvedContextOpen)}
              aria-label={resolvedContextOpen ? "Ocultar contexto" : "Mostrar contexto"}
              title={resolvedContextOpen ? "Ocultar contexto" : "Mostrar contexto"}
            >
              {resolvedContextOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </Button>
          ) : null}
        </div>
      </header>
      <div
        className={cn(
          "grid min-h-0 flex-1 overflow-hidden",
          showContext
            ? "grid-cols-1 lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[21rem_minmax(0,1fr)_18rem] 2xl:grid-cols-[23rem_minmax(0,1fr)_20rem]"
            : "grid-cols-1 lg:grid-cols-[20rem_minmax(0,1fr)] 2xl:grid-cols-[23rem_minmax(0,1fr)]",
        )}
      >
        <section
          className={cn("min-h-0 flex-col border-r border-border bg-product-panel lg:flex", mobilePane === "list" ? "flex" : "hidden")}
          aria-label="Conversas"
          onClickCapture={(event) => {
            if ((event.target as HTMLElement).closest("[data-inbox-conversation]")) setMobilePane("conversation");
          }}
        >
          {list}
        </section>
        <section
          className={cn("min-h-0 min-w-0 flex-col bg-background lg:flex", mobilePane === "conversation" ? "flex" : "hidden")}
          aria-label="Conversa selecionada"
        >
          <div className="flex items-center border-b border-border bg-product-panel p-2 lg:hidden">
            <Button type="button" size="sm" variant="ghost" onClick={() => setMobilePane("list")}>
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Conversas
            </Button>
          </div>
          {conversation}
        </section>
        {showContext ? (
          <aside className="hidden min-h-0 border-l border-border bg-product-panel xl:flex xl:flex-col" aria-label="Contexto do contato">
            {context}
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function InboxChannelTabs() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <nav
      className="flex min-w-0 max-w-full gap-1 overflow-x-auto rounded-[var(--radius)] bg-muted p-1"
      aria-label="Canais da Inbox"
    >
      {CHANNELS.map(({ to, label, icon: Icon }) => {
        const active = to === "/inbox" ? pathname === "/inbox" || pathname === "/inbox/" : pathname === to;
        return (
          <Link
            key={to}
            to={to}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-[calc(var(--radius)-2px)] px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function InboxListHeader({ children }: { children: ReactNode }) {
  return <div className="space-y-2 border-b border-border p-3">{children}</div>;
}

export function InboxConversationList({ children }: { children: ReactNode }) {
  return <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</div>;
}

export function InboxEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-48 flex-1 place-items-center p-6 text-center text-sm text-muted-foreground">
      <div className="flex max-w-xs flex-col items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <Inbox className="h-5 w-5" />
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}

export function InboxLoading() {
  return (
    <div className="space-y-1 p-2" aria-label="Carregando conversas">
      {[0, 1, 2, 3, 4].map((item) => (
        <div key={item} className="flex gap-3 p-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between gap-3"><Skeleton className="h-4 w-2/5" /><Skeleton className="h-3 w-10" /></div>
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function InboxAvatar({ label, className }: { label: string; className?: string }) {
  const initials = label.replace(/[^\p{L}\p{N} ]/gu, "").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";
  return (
    <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground", className)} aria-hidden>
      {initials}
    </div>
  );
}

export function InboxContext({ initials, title, subtitle, children }: { initials: string; title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <ScrollArea className="flex-1"><div className="space-y-6 p-5">
      <div className="text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent text-lg font-semibold text-accent-foreground">{initials}</div>
        <h2 className="mt-3 truncate font-semibold text-foreground">{title}</h2>
        {subtitle ? <p className="mt-1 truncate text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {children}
    </div></ScrollArea>
  );
}
