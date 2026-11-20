import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Loader2, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NOTIFICATION_CATEGORIES } from "@/lib/notification-catalog";
import type { NotificationCenterItem } from "@/lib/notification-center";
import { NotificationDetail } from "./notification-detail";
import { formatDateTime } from "@/lib/crm";
import { groupSummary } from "@/lib/notification-center-preferences";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export type CenterFilters = {
  scope: "workspace" | "legacy";
  status: "all" | "unread" | "read" | "snoozed";
  category: string;
  module: string;
  q: string;
};
type Props = {
  items: NotificationCenterItem[];
  filters: CenterFilters;
  selectedId: string | null;
  unread: number | null;
  unreadCapped?: boolean;
  loading: boolean;
  searchPending?: boolean;
  focusedItem?: NotificationCenterItem | null;
  detailLoading?: boolean;
  detailError?: string | null;
  onDismiss?: () => void;
  error?: string | null;
  actionError?: string | null;
  pending: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onFilters: (filters: CenterFilters) => void;
  onSelect: (id: string) => void;
  onRead: (ids: string[], read: boolean) => void;
  onSnooze: (id: string, minutes: 0 | 60 | 1440) => void;
  onRetry: () => void;
  onMore: () => void;
  summary?: { mode: "none" | "daily" | "weekly"; timezone: string };
};

const moduleNames: Record<string, string> = {
  crm: "TechSales",
  ats: "TechHire",
  people: "TechPeople",
  contracts: "TechContracts",
  finance: "TechFinance",
  projects: "TechProjects",
};
function categoryLabel(item: NotificationCenterItem) {
  return (
    NOTIFICATION_CATEGORIES.find((entry) => entry.key === item.event?.category)?.label ??
    "Outros avisos"
  );
}
function stateLabel(item: NotificationCenterItem) {
  if (item.snoozed_until && Date.parse(item.snoozed_until) > Date.now()) return "Adiada";
  return item.read_at ? "Lida" : "Não lida";
}

export function NotificationCenter(props: Props) {
  const { items, filters, selectedId, onFilters } = props;
  const ready = !props.loading && !props.error && !props.searchPending;
  const visibleItems = ready ? items : [];
  const selected =
    visibleItems.find((item) => item.id === selectedId) ??
    (ready && props.focusedItem?.id === selectedId ? props.focusedItem : null);
  const visibleUnread = visibleItems.filter((item) => !item.read_at).slice(0, 100);
  const [compact, setCompact] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const origin = useRef<HTMLButtonElement | null>(null);
  const listHeading = useRef<HTMLHeadingElement | null>(null);
  const detailTitle = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(max-width: 1023px)");
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!compact || !selectedId) setMobileOpen(false);
    else setMobileOpen(true);
  }, [compact, selectedId]);
  const interactionBlocked = props.pending || !ready;
  const detail = (
    <NotificationDetail
      selected={selected}
      category={selected ? categoryLabel(selected) : ""}
      status={selected ? stateLabel(selected) : ""}
      pending={interactionBlocked || props.detailLoading === true}
      loading={props.detailLoading || (!ready && !props.error)}
      error={props.error || props.detailError}
      onRead={props.onRead}
      onSnooze={props.onSnooze}
    />
  );
  const groups = groupSummary(
    visibleItems,
    props.summary?.mode ?? "none",
    props.summary?.timezone ?? "UTC",
  );
  const change = (patch: Partial<CenterFilters>) => {
    const next = { ...filters, ...patch };
    if (next.scope === "legacy") {
      next.q = "";
      next.module = "";
    }
    onFilters(next);
  };
  return (
    <section className="space-y-4" aria-label="Minha central de notificações">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex max-w-full flex-wrap gap-2" aria-label="Origem do histórico">
          <Button
            variant={filters.scope === "workspace" ? "default" : "outline"}
            aria-pressed={filters.scope === "workspace"}
            onClick={() => change({ scope: "workspace" })}
          >
            Workspace ativo{" "}
            {filters.scope === "workspace" && (
              <Badge
                variant="secondary"
                className="ml-2"
                title="Não lidas neste filtro"
                aria-label={
                  !ready || props.unread === null
                    ? "Contagem indisponível"
                    : "Não lidas neste filtro"
                }
              >
                {!ready || props.unread === null
                  ? "…"
                  : props.unreadCapped || props.unread >= 100
                    ? "99+"
                    : props.unread}
              </Badge>
            )}
          </Button>
          <Button
            variant={filters.scope === "legacy" ? "default" : "outline"}
            aria-pressed={filters.scope === "legacy"}
            onClick={() => change({ scope: "legacy", module: "" })}
          >
            Histórico sem workspace
          </Button>
        </div>
        <Button variant="ghost" size="sm" onClick={props.onRetry} disabled={props.loading}>
          <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
        </Button>
      </div>
      {filters.scope === "legacy" && (
        <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground" role="note">
          Avisos pessoais antigos sem workspace comprovado. Este histórico fica separado; não
          atribuímos uma empresa pela descrição ou pelo link. A busca por conteúdo fica desativada
          neste histórico.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-sm">
          Módulo
          <select
            className="h-10 rounded-md border border-input bg-background px-3"
            value={filters.module}
            disabled={filters.scope === "legacy"}
            onChange={(event) => change({ module: event.target.value })}
          >
            <option value="">Todos os módulos</option>
            {Object.entries(moduleNames).map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">Buscar notificações</span>
          <Search
            aria-hidden="true"
            className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"
          />
          <Input
            className="pl-9"
            value={filters.scope === "legacy" ? "" : filters.q}
            disabled={filters.scope === "legacy"}
            onChange={(event) => change({ q: event.target.value })}
            placeholder="Buscar por assunto…"
            maxLength={120}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          Estado
          <select
            className="h-10 rounded-md border border-input bg-background px-3"
            value={filters.status}
            onChange={(event) => change({ status: event.target.value as CenterFilters["status"] })}
          >
            <option value="all">Todos</option>
            <option value="unread">Não lidas</option>
            <option value="read">Lidas</option>
            <option value="snoozed">Adiadas</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          Grupo
          <select
            className="h-10 max-w-60 rounded-md border border-input bg-background px-3"
            value={filters.category}
            onChange={(event) => change({ category: event.target.value })}
          >
            <option value="">Todos os grupos</option>
            {NOTIFICATION_CATEGORIES.map((entry) => (
              <option key={entry.key} value={entry.key}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {props.actionError && (
        <p role="alert" className="text-sm text-destructive">
          {props.actionError}
        </p>
      )}
      {props.error ? (
        <div role="alert" className="space-y-3 rounded-lg border border-border p-6">
          <p>Não foi possível carregar as notificações. {props.error}</p>
          <Button variant="outline" onClick={props.onRetry}>
            Tentar novamente
          </Button>
        </div>
      ) : props.loading || props.searchPending ? (
        <div className="flex items-center gap-2 p-8 text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" />{" "}
          {props.searchPending ? "Atualizando a busca…" : "Carregando notificações…"}
        </div>
      ) : (
        <div className="grid min-h-96 gap-6 lg:grid-cols-[minmax(300px,1fr)_minmax(300px,0.9fr)]">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 ref={listHeading} tabIndex={-1} className="font-semibold">
                Sua caixa de entrada{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  · {visibleItems.length} carregadas
                </span>
              </h2>
              <Button
                size="sm"
                variant="ghost"
                disabled={!visibleUnread.length || interactionBlocked}
                onClick={() =>
                  !interactionBlocked &&
                  props.onRead(
                    visibleUnread.map((item) => item.id),
                    true,
                  )
                }
              >
                <CheckCheck className="mr-1 h-4 w-4" /> Marcar carregadas como lidas
              </Button>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Até 100 avisos carregados por vez; os filtros e o instante da consulta são
              preservados.
            </p>
            {!visibleItems.length ? (
              <div className="space-y-2 py-12 text-center text-muted-foreground">
                <Bell className="mx-auto h-7 w-7" />
                <h3 className="font-medium text-foreground">Nenhuma notificação encontrada</h3>
                <p className="text-sm">Ajuste os filtros ou aguarde novos avisos.</p>
              </div>
            ) : (
              <div className="space-y-4" aria-label="Notificações carregadas">
                {groups.map((group) => (
                  <section key={group.key}>
                    {props.summary?.mode && props.summary.mode !== "none" && (
                      <h3 className="mb-2 text-xs font-medium text-muted-foreground">
                        {group.label}
                      </h3>
                    )}
                    <ul className="space-y-1">
                      {group.items.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            className={`w-full rounded-lg px-4 py-4 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedId === item.id ? "bg-primary/10 ring-1 ring-primary/30" : "bg-background"}`}
                            aria-pressed={selectedId === item.id}
                            onClick={(event) => {
                              if (!ready) return;
                              origin.current = event.currentTarget;
                              props.onSelect(item.id);
                              if (compact) setMobileOpen(true);
                            }}
                          >
                            <span className="flex items-start justify-between gap-3">
                              <strong className="min-w-0 flex-1 break-words text-sm">
                                {item.title}
                              </strong>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {stateLabel(item)}
                              </span>
                            </span>
                            {item.body && (
                              <span className="mt-1 block line-clamp-2 break-words text-sm text-muted-foreground">
                                {item.body}
                              </span>
                            )}
                            <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span>{categoryLabel(item)}</span>
                              {(item.moduleKey ?? item.event?.moduleKey) && (
                                <span>
                                  {moduleNames[(item.moduleKey ?? item.event?.moduleKey)!]}
                                </span>
                              )}
                              <time dateTime={item.created_at}>
                                {formatDateTime(item.created_at)}
                              </time>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
            {props.hasMore && (
              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={() => ready && !props.loadingMore && props.onMore()}
                disabled={props.loadingMore || !ready}
              >
                {props.loadingMore ? "Carregando anteriores…" : "Carregar anteriores"}
              </Button>
            )}
          </div>
          {!compact && detail}
        </div>
      )}
      {compact && (
        <Sheet
          open={mobileOpen && Boolean(selectedId)}
          onOpenChange={(open) => {
            setMobileOpen(open);
            if (!open) props.onDismiss?.();
          }}
        >
          <SheetContent
            className="w-full max-w-full overflow-y-auto px-4 sm:max-w-lg"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              detailTitle.current?.focus();
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              const target = origin.current?.isConnected ? origin.current : listHeading.current;
              target?.focus();
            }}
          >
            <SheetHeader className="mb-4 pr-6 text-left">
              <SheetTitle ref={detailTitle} tabIndex={-1}>
                Detalhe da notificação
              </SheetTitle>
              <SheetDescription>
                Confira o aviso e abra o registro autorizado. Ler não conclui a obrigação.
              </SheetDescription>
            </SheetHeader>
            {detail}
          </SheetContent>
        </Sheet>
      )}
    </section>
  );
}
