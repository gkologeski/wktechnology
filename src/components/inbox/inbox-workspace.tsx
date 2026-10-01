import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { AlertCircle, ArrowLeft, Check, CheckCheck, Inbox, Mail, MessageCircle, PanelRightClose, PanelRightOpen, User } from "lucide-react";
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
  const initials = label.replace(/[^\p{L} ]/gu, "").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  return (
    <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground", className)} aria-hidden>
      {initials || <User className="h-4 w-4" />}
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

export function inboxShortWhen(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Linha padrão da lista de conversas (avatar, nome, horário, prévia, metadados). */
export function InboxConversationItem({
  label, title, preview, when, whenTitle, selected, onClick, badge, meta, channelIcon, unread,
}: {
  label: string; title?: string; preview?: string; when?: string | null; whenTitle?: string;
  selected?: boolean; onClick: () => void; badge?: ReactNode; meta?: ReactNode; channelIcon?: ReactNode; unread?: number;
}) {
  return (
    <button
      type="button"
      data-inbox-conversation
      onClick={onClick}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex w-full items-start gap-3 rounded-[var(--radius)] p-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected && "bg-accent",
      )}
    >
      <div className="relative">
        <InboxAvatar label={label} />
        {channelIcon ? <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-product-panel bg-card">{channelIcon}</span> : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={cn("truncate text-sm text-foreground", unread ? "font-bold" : "font-semibold")}>{label}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground" title={whenTitle}>{inboxShortWhen(when)}</span>
        </div>
        {title ? <div className="truncate text-sm text-text-secondary">{title}</div> : null}
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{preview || "—"}</div>
          {badge}
          {unread ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">{unread}</span> : null}
        </div>
        {meta ? <div className="mt-1 truncate text-[11px] text-muted-foreground">{meta}</div> : null}
      </div>
    </button>
  );
}

/** Topo padrão da conversa aberta (avatar grande, nome, canal/subtítulo e ações). */
export function InboxConversationHeader({ label, subtitle, actions }: { label: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border bg-product-panel px-4 py-3">
      <InboxAvatar label={label} className="h-9 w-9" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-foreground">{label}</div>
        {subtitle ? <div className="truncate text-xs text-muted-foreground">{subtitle}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export type InboxDeliveryStatus = "queued" | "sending" | "sent" | "delivered" | "read" | "failed" | string | null | undefined;

const STATUS_LABEL: Record<string, string> = {
  queued: "Na fila", accepted: "Na fila", sending: "Enviando", sent: "Enviada",
  delivered: "Entregue", read: "Lida", failed: "Falhou", undelivered: "Não entregue",
};

/** Indicador de envio/leitura (✓ enviada, ✓✓ entregue, ✓✓ destacado = lida). */
export function InboxMessageStatus({ status }: { status: InboxDeliveryStatus }) {
  if (!status) return null;
  const label = STATUS_LABEL[status] ?? status;
  const failed = status === "failed" || status === "undelivered";
  return (
    <span className="inline-flex items-center gap-0.5" title={label} aria-label={label}>
      {failed ? <AlertCircle className="h-3 w-3 text-destructive" /> : status === "read" ? <CheckCheck className="h-3.5 w-3.5 text-primary" /> : status === "delivered" ? <CheckCheck className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
    </span>
  );
}

/** Balão de mensagem padrão: recebidas à esquerda, enviadas à direita. */
export function InboxMessageBubble({ outbound, author, when, status, footer, children }: { outbound?: boolean; author?: ReactNode; when?: string | null; status?: InboxDeliveryStatus; footer?: ReactNode; children: ReactNode }) {
  return (
    <div className={cn("flex", outbound ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[78%] rounded-[var(--radius)] border px-3.5 py-2.5 text-sm shadow-sm",
        outbound ? "rounded-tr-sm border-primary/20 bg-primary/10 text-foreground" : "rounded-tl-sm border-border bg-card text-foreground",
      )}>
        {author ? <div className="mb-1 text-xs font-medium text-text-secondary">{author}</div> : null}
        {children}
        <div className="mt-1.5 flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
          {footer}
          {when ? <time dateTime={when} title={new Date(when).toLocaleString("pt-BR")}>{new Date(when).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</time> : null}
          {outbound ? <InboxMessageStatus status={status} /> : null}
        </div>
      </div>
    </div>
  );
}
