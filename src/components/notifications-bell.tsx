import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  useMutation,
  type InfiniteData,
} from "@tanstack/react-query";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getNotificationCenter,
  markCenterNotifications,
  getCenterPreferences,
  getNotificationCenterBadge,
  lookupCenterNotifications,
} from "@/lib/notification-center.functions";
import {
  createNotificationRealtimeBatcher,
  notificationRealtimeRecordId,
  NOTIFICATION_BELL_MAX_PAGES,
} from "@/lib/notification-center-realtime";
import type { NotificationCenterPage } from "@/lib/notification-center";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { readViewAs } from "@/lib/view-as-client";
import { toast } from "sonner";
import { notificationHref } from "@/lib/notification-href";
import { formatDateTime } from "@/lib/crm";
import type { NotificationCursor } from "@/lib/notification-cursor";

function playBeep() {
  try {
    const AudioCtx =
      (
        window as unknown as {
          AudioContext?: typeof AudioContext;
          webkitAudioContext?: typeof AudioContext;
        }
      ).AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.27);
    setTimeout(() => ctx.close().catch(() => {}), 400);
  } catch {
    /* ignore */
  }
}

function personalNotificationWriteBlocked() {
  const view = readViewAs();
  return view?.readOnly === true || view?.mode === "role";
}

type BellPageParam = { cursor: NotificationCursor; cutoff: string } | null;
type BellMark = {
  ids: string[];
  cutoff: string;
  workspaceId: string;
  userId: string;
  identity: string;
};

export function NotificationsBell() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const context = usePermissions();
  const workspaceId = !context.isLoading && !context.isError ? context.workspaceId : null;
  const identity = user?.id && workspaceId ? `${user.id}:${workspaceId}` : null;
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const listFn = useServerFn(getNotificationCenter);
  const badgeFn = useServerFn(getNotificationCenterBadge);
  const lookupFn = useServerFn(lookupCenterNotifications);
  const readFn = useServerFn(markCenterNotifications);
  const prefsFn = useServerFn(getCenterPreferences);
  const [openIdentity, setOpenIdentity] = useState<string | null>(null);
  const open = Boolean(identity && openIdentity === identity);
  const [shaking, setShaking] = useState(false);
  const readOnly = personalNotificationWriteBlocked();
  const prefix = ["notification-center", user?.id, workspaceId];
  const listKey = [...prefix, "bell"];
  const badge = useQuery({
    queryKey: [...prefix, "badge"],
    enabled: Boolean(identity),
    queryFn: () => badgeFn({ data: { workspaceId: workspaceId! } }),
    refetchInterval: 60_000,
  });
  const q = useInfiniteQuery({
    queryKey: listKey,
    enabled: Boolean(identity && open),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    initialPageParam: null as BellPageParam,
    queryFn: ({ pageParam }) =>
      listFn({
        data: {
          workspaceId: workspaceId!,
          scope: "workspace",
          status: "all",
          cursor: pageParam?.cursor,
          cutoff: pageParam?.cutoff,
        },
      }),
    getNextPageParam: (last, pages) =>
      pages.length < NOTIFICATION_BELL_MAX_PAGES && last.nextCursor
        ? { cursor: last.nextCursor, cutoff: last.cutoff }
        : undefined,
    refetchInterval: open ? 60_000 : false,
  });
  const listTrusted = Boolean(
    identity && open && q.isSuccess && !q.isError && (!q.isFetching || q.isFetchingNextPage),
  );
  const currentItems = useRef<Set<string>>(new Set());
  currentItems.current = new Set(
    identity && q.isSuccess && !q.isError
      ? (q.data?.pages.flatMap((page) => page.items.map((item) => item.id)) ?? [])
      : [],
  );
  const changeOpen = (next: boolean) => {
    if (next && identity) {
      setOpenIdentity(identity);
      return;
    }
    setOpenIdentity(null);
    // A closed global bell must never poll a growing history of older pages.
    void qc.cancelQueries({ queryKey: listKey, exact: true }).then(() => {
      qc.setQueryData<InfiniteData<NotificationCenterPage, BellPageParam>>(listKey, (old) =>
        old ? { pages: old.pages.slice(0, 1), pageParams: old.pageParams.slice(0, 1) } : old,
      );
    });
  };
  useEffect(() => {
    setShaking(false);
    setOpenIdentity(null);
  }, [identity]);
  useEffect(() => {
    if (!identity || !user?.id || !workspaceId) return;
    let cancelled = false;
    let shakeTimer: ReturnType<typeof setTimeout> | undefined;
    const active = () => !cancelled && currentIdentity.current === identity;
    const batcher = createNotificationRealtimeBatcher({
      isActive: active,
      invalidate: () =>
        qc.invalidateQueries({ queryKey: ["notification-center", user.id, workspaceId] }),
      lookup: (ids) => lookupFn({ data: { workspaceId, ids } }),
      preferences: () => prefsFn({ data: { workspaceId } }),
      pathname: () => window.location.pathname,
      interrupt: (flags) => {
        if (!active()) return;
        if (flags.toast)
          toast.message("Novos avisos disponíveis", {
            description: "Abra a central para consultar as atualizações deste workspace.",
          });
        if (flags.sound) playBeep();
        if (flags.shake) {
          setShaking(true);
          clearTimeout(shakeTimer);
          shakeTimer = setTimeout(() => {
            if (active()) setShaking(false);
          }, 850);
        }
      },
    });
    const channel = supabase
      .channel(`notif-${identity}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => batcher.inserted(notificationRealtimeRecordId(payload.new)),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (notificationRealtimeRecordId(payload.new)) batcher.changed();
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "notifications" },
        (payload) => {
          // Delete events have no reliable user filter. Only a known own cached ID matters.
          const id = notificationRealtimeRecordId(payload.old);
          if (id && currentItems.current.has(id)) batcher.changed();
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      batcher.dispose();
      clearTimeout(shakeTimer);
      void supabase.removeChannel(channel);
    };
  }, [identity, user?.id, workspaceId, lookupFn, prefsFn, qc]);
  const mark = useMutation({
    mutationFn: (request: BellMark) => {
      if (currentIdentity.current !== request.identity || personalNotificationWriteBlocked())
        throw Error("O workspace mudou. Abra o sino novamente.");
      return readFn({
        data: {
          workspaceId: request.workspaceId,
          ids: request.ids,
          read: true,
          cutoff: request.cutoff,
        },
      });
    },
    onSuccess: (result, request) => {
      if (currentIdentity.current !== request.identity) return;
      if (!result.updated)
        toast.error("Nenhum aviso foi alterado. Confira o estado e o acesso atuais na central.");
      return qc.invalidateQueries({
        queryKey: ["notification-center", request.userId, request.workspaceId],
      });
    },
    onError: (error: Error, request) => {
      if (currentIdentity.current === request.identity) toast.error(error.message);
    },
  });
  const markLoaded = (ids: string[]) => {
    const cutoff = q.data?.pages[0]?.cutoff;
    if (
      !listTrusted ||
      personalNotificationWriteBlocked() ||
      !identity ||
      !workspaceId ||
      !user?.id ||
      !cutoff ||
      mark.isPending
    )
      return;
    mark.mutate({ ids: ids.slice(0, 100), cutoff, workspaceId, userId: user.id, identity });
  };
  const items = listTrusted ? (q.data?.pages.flatMap((page) => page.items) ?? []) : [];
  const badgeTrusted = Boolean(identity && badge.isSuccess && !badge.isError);
  const unread = badgeTrusted ? (badge.data?.unread ?? 0) : 0;
  const loadedUnread = items.filter((item) => !item.read_at).slice(0, 100);
  const historyCapped =
    listTrusted &&
    (q.data?.pages.length ?? 0) >= NOTIFICATION_BELL_MAX_PAGES &&
    Boolean(q.data?.pages.at(-1)?.nextCursor);
  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notificações"
          disabled={!identity}
          title={!identity ? "Aguardando acesso ao workspace" : undefined}
        >
          <Bell className={`h-5 w-5 ${shaking ? "animate-bell-shake" : ""}`} />
          {badgeTrusted && unread > 0 && (
            <Badge
              aria-label="Notificações não lidas"
              className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center px-1 text-[10px]"
            >
              {badge.data?.unreadCapped || unread > 99 ? "99+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-1rem)] p-0">
        <div className="flex items-center justify-between border-b border-border p-3">
          <h2 className="text-sm font-medium">Workspace ativo</h2>
          {listTrusted && !readOnly && !!loadedUnread.length && (
            <Button
              size="sm"
              variant="ghost"
              disabled={mark.isPending}
              onClick={() => markLoaded(loadedUnread.map((item) => item.id))}
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5" />
              Marcar carregadas
            </Button>
          )}
        </div>
        {identity && badge.isError && (
          <p role="status" className="px-3 pt-3 text-xs text-muted-foreground">
            Contador indisponível. A lista pode ser consultada abaixo.
          </p>
        )}
        <ScrollArea className="h-96">
          {!identity ? (
            <p className="p-6 text-sm text-muted-foreground">Aguardando acesso ao workspace.</p>
          ) : q.isError ? (
            <div role="alert" className="space-y-3 p-4">
              <p className="text-sm">Não foi possível carregar as notificações.</p>
              <Button size="sm" variant="outline" onClick={() => void q.refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : !listTrusted ? (
            <p className="flex items-center gap-2 p-6 text-sm" role="status">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando notificações…
            </p>
          ) : !items.length ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma notificação neste workspace.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((notice) => {
                const target = notificationHref(notice);
                return (
                  <li key={notice.id}>
                    <Link
                      to={(target?.to ?? "/notifications") as never}
                      search={
                        (target ? target.search : { area: "central", notice: notice.id }) as never
                      }
                      onClick={() => {
                        if (!notice.read_at) markLoaded([notice.id]);
                        changeOpen(false);
                      }}
                    >
                      <div
                        className={`p-3 text-left hover:bg-muted/50 ${!notice.read_at ? "bg-primary/5" : ""}`}
                      >
                        <p className="truncate text-sm font-medium" title={notice.title}>
                          {notice.title}
                        </p>
                        {notice.body && (
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {notice.body}
                          </p>
                        )}
                        <time
                          className="mt-1 block text-[10px] text-muted-foreground"
                          dateTime={notice.created_at}
                        >
                          {formatDateTime(notice.created_at)}
                        </time>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {listTrusted && q.hasNextPage && (
            <div className="p-3">
              <Button
                size="sm"
                variant="ghost"
                className="w-full"
                disabled={q.isFetchingNextPage}
                onClick={() => void q.fetchNextPage()}
              >
                {q.isFetchingNextPage ? "Carregando anteriores…" : "Carregar anteriores"}
              </Button>
            </div>
          )}
          {historyCapped && (
            <p className="p-3 text-xs text-muted-foreground">
              Consulte a central para continuar no histórico.
            </p>
          )}
        </ScrollArea>
        <div className="flex justify-between border-t border-border p-3 text-xs">
          <Link
            to={"/notifications" as never}
            search={{ area: "central" } as never}
            className="font-medium text-primary"
            onClick={() => changeOpen(false)}
          >
            Ver central →
          </Link>
          <Link
            to={"/notifications" as never}
            search={{ area: "preferences" } as never}
            className="text-muted-foreground"
            onClick={() => changeOpen(false)}
          >
            Preferências
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
