import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Inbox, Mail, MessageCircle, PanelRightClose, PanelRightOpen } from "lucide-react";
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
  return (
    <div className="flex h-[calc(100dvh-4rem)] min-h-[36rem] flex-col gap-3 p-3 sm:p-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </header>
      <div
        className={cn(
          "relative grid min-h-0 flex-1 overflow-hidden rounded-[var(--radius)] border border-border bg-card shadow-sm",
          context && contextOpen
            ? "grid-cols-1 lg:grid-cols-[10.5rem_19rem_minmax(24rem,1fr)] 2xl:grid-cols-[11rem_20rem_minmax(25rem,1fr)_17rem]"
            : "grid-cols-1 lg:grid-cols-[10.5rem_19rem_minmax(24rem,1fr)]",
        )}
      >
        <InboxChannelRail />
        <section className="hidden min-h-0 flex-col border-r border-border bg-card lg:flex" aria-label="Conversas">
          {list}
        </section>
        <section className="flex min-h-0 min-w-0 flex-col bg-product-panel" aria-label="Conversa selecionada">
          {context && onContextOpenChange ? (
            <div className="absolute right-2 top-2 z-20 hidden 2xl:block">
              <Button type="button" size="icon" variant="ghost" onClick={() => onContextOpenChange(!contextOpen)} aria-label={contextOpen ? "Ocultar contexto" : "Mostrar contexto"} title={contextOpen ? "Ocultar contexto" : "Mostrar contexto"}>
                {contextOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              </Button>
            </div>
          ) : null}
          {conversation}
        </section>
        {context && contextOpen ? (
          <aside className="hidden min-h-0 border-l border-border bg-product-panel-muted 2xl:flex 2xl:flex-col" aria-label="Contexto do contato">{context}</aside>
        ) : null}
      </div>
    </div>
  );
}

function InboxChannelRail() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <aside className="hidden min-h-0 flex-col border-r border-border bg-product-panel-muted lg:flex">
      <div className="border-b border-border px-3 py-4"><p className="text-xs font-semibold uppercase text-muted-foreground">Canais</p></div>
      <nav className="space-y-1 p-2" aria-label="Canais da Inbox">
        {CHANNELS.map(({ to, label, icon: Icon }) => {
          const active = to === "/inbox" ? pathname === "/inbox" || pathname === "/inbox/" : pathname === to;
          return (
            <Button key={to} asChild variant={active ? "secondary" : "ghost"} className={cn("w-full justify-start gap-2 px-2", active && "text-primary")}>
              <Link to={to} aria-current={active ? "page" : undefined}><Icon className="h-4 w-4 shrink-0" /><span className="truncate">{label}</span></Link>
            </Button>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-border p-3 text-xs text-muted-foreground">Canais do workspace</div>
    </aside>
  );
}

export function InboxListHeader({ children }: { children: ReactNode }) {
  return <div className="space-y-2 border-b border-border bg-product-toolbar p-3">{children}</div>;
}

export function InboxConversationList({ children }: { children: ReactNode }) {
  return <ScrollArea className="min-h-0 flex-1">{children}</ScrollArea>;
}

export function InboxEmpty({ children }: { children: ReactNode }) {
  return <div className="grid min-h-48 flex-1 place-items-center p-6 text-center text-sm text-muted-foreground"><div className="max-w-xs">{children}</div></div>;
}

export function InboxLoading() {
  return (
    <div className="space-y-1 p-2" aria-label="Carregando conversas">
      {[0, 1, 2, 3, 4].map((item) => (
        <div key={item} className="space-y-2 border-b border-border-subtle p-3">
          <div className="flex items-center justify-between gap-3"><Skeleton className="h-4 w-2/5" /><Skeleton className="h-3 w-12" /></div>
          <Skeleton className="h-3 w-4/5" /><Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function InboxContext({ initials, title, subtitle, children }: { initials: string; title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <ScrollArea className="flex-1"><div className="space-y-6 p-5">
      <div className="text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-[var(--radius)] border border-border bg-card text-lg font-semibold text-primary shadow-sm">{initials}</div>
        <h2 className="mt-3 truncate font-semibold text-foreground">{title}</h2>
        {subtitle ? <p className="mt-1 truncate text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {children}
    </div></ScrollArea>
  );
}