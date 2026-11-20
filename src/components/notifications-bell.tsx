import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useInfiniteQuery, useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getNotificationCenter,
  markCenterNotifications,
  getCenterPreferences,
} from "@/lib/notification-center.functions";
import { notificationInterruption } from "@/lib/notification-preferences";
import { effectiveChannels, isQuietNow } from "@/lib/notification-center-preferences";
import { resolveLegacyNotificationEvent } from "@/lib/notification-catalog";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
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

export function NotificationsBell() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const context = usePermissions();
  const workspaceId = !context.isLoading && !context.isError ? context.workspaceId : null;
  const identity = user?.id && workspaceId ? `${user.id}:${workspaceId}` : null;
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const listFn = useServerFn(getNotificationCenter);
  const readFn = useServerFn(markCenterNotifications);
  const prefsFn = useServerFn(getCenterPreferences);
  const [shaking, setShaking] = useState(false);
  const prefix = ["notification-center", user?.id, workspaceId];
  const q = useInfiniteQuery({
    queryKey: [...prefix, "bell"],
    enabled: Boolean(identity),
    initialPageParam: null as { cursor: NotificationCursor; cutoff: string } | null,
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
    getNextPageParam: (last) =>
      last.nextCursor ? { cursor: last.nextCursor, cutoff: last.cutoff } : undefined,
    refetchInterval: 60_000,
  });
  const preferences = useQuery({
    queryKey: ["notification-center-preferences", user?.id, workspaceId],
    enabled: Boolean(identity),
    queryFn: () => prefsFn({ data: { workspaceId: workspaceId! } }),
    staleTime: 5 * 60_000,
  });
  const prefsRef = useRef<{ identity: string; value: NonNullable<typeof preferences.data> } | null>(
    null,
  );
  useEffect(() => {
    prefsRef.current = identity && preferences.data ? { identity, value: preferences.data } : null;
  }, [identity, preferences.data]);
  useEffect(() => {
    setShaking(false);
  }, [identity]);

  useEffect(() => {
    if (!identity || !user?.id || !workspaceId) return;
    let cancelled = false;
    let shakeTimer: ReturnType<typeof setTimeout> | undefined;
    const seen = new Set<string>();
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
        (payload) => {
          // Realtime content is not trusted: re-read the scoped API before any interruption.
          const id = (payload.new as { id?: unknown }).id;
          if (
            cancelled ||
            currentIdentity.current !== identity ||
            typeof id !== "string" ||
            seen.has(id)
          )
            return;
          seen.add(id);
          if (seen.size > 200) seen.delete(seen.values().next().value!);
          void qc.invalidateQueries({ queryKey: ["notification-center", user.id, workspaceId] });
          void listFn({ data: { workspaceId, scope: "workspace", status: "all" } })
            .then(async (page) => {
              if (cancelled || currentIdentity.current !== identity) return;
              const notice = page.items.find((item) => item.id === id);
              if (!notice || notice.read_at || prefsRef.current?.identity !== identity) return;
              if (notice.snoozed_until && Date.parse(notice.snoozed_until) > Date.now()) return;
              const event = resolveLegacyNotificationEvent(notice.type);
              if (!event) return;
              // Preferences may have changed in another session since the cached page loaded.
              const current = await prefsFn({ data: { workspaceId } });
              if (
                cancelled ||
                currentIdentity.current !== identity ||
                isQuietNow(current.settings.quiet)
              )
                return;
              const channels = effectiveChannels(
                current.legacyPrefs,
                current.settings,
                notice.type ?? "",
              );
              const prefs = { ...current.legacyPrefs, [event.category]: channels };
              const interruption = notificationInterruption(
                notice,
                prefs,
                window.location.pathname,
              );
              if (interruption.toast)
                toast.message(notice.title ?? "Nova notificação", {
                  description: notice.body ?? undefined,
                });
              if (interruption.sound) playBeep();
              if (interruption.shake) {
                setShaking(true);
                clearTimeout(shakeTimer);
                shakeTimer = setTimeout(() => setShaking(false), 850);
              }
            })
            .catch(() => {
              /* A failed authorization/read never displays provider payload. */
            });
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      clearTimeout(shakeTimer);
      void supabase.removeChannel(channel);
    };
  }, [identity, user?.id, workspaceId, listFn, prefsFn, qc]);

  const mark = useMutation({
    mutationFn: (ids: string[]) => {
      const cutoff = q.data?.pages[0]?.cutoff;
      if (!workspaceId || !cutoff)
        throw new Error("Atualize as notificações antes de alterar a leitura.");
      return readFn({ data: { workspaceId, ids, read: true, cutoff } });
    },
    onSuccess: (result) => {
      if (!result.updated)
        toast.error("Nenhum aviso foi alterado. Confira o estado e o acesso atuais na central.");
      return qc.invalidateQueries({ queryKey: prefix });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const items = q.data?.pages.flatMap((page) => page.items) ?? [];
  const unread = q.data?.pages[0]?.unread ?? 0;
  const loadedUnread = items.filter((item) => !item.read_at).slice(0, 100);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
          <Bell className={`h-5 w-5 ${shaking ? "animate-bell-shake" : ""}`} />
          {unread > 0 && (
            <Badge className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center px-1 text-[10px]">
              {unread > 99 ? "99+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border p-3">
          <h2 className="text-sm font-medium">Workspace ativo</h2>
          {!!loadedUnread.length && (
            <Button
              size="sm"
              variant="ghost"
              disabled={mark.isPending}
              onClick={() => mark.mutate(loadedUnread.map((item) => item.id))}
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5" />
              Marcar carregadas
            </Button>
          )}
        </div>
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
          ) : q.isLoading ? (
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
                const content = (
                  <div
                    className={`p-3 text-left hover:bg-muted/50 ${!notice.read_at ? "bg-primary/5" : ""}`}
                  >
                    <p className="truncate text-sm font-medium">{notice.title}</p>
                    {notice.body && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">{notice.body}</p>
                    )}
                    <time
                      className="mt-1 block text-[10px] text-muted-foreground"
                      dateTime={notice.created_at}
                    >
                      {formatDateTime(notice.created_at)}
                    </time>
                  </div>
                );
                return (
                  <li key={notice.id}>
                    {target ? (
                      <Link
                        to={target.to as never}
                        search={target.search as never}
                        onClick={() => !notice.read_at && mark.mutate([notice.id])}
                      >
                        {content}
                      </Link>
                    ) : (
                      <button
                        className="w-full"
                        disabled={mark.isPending}
                        onClick={() => !notice.read_at && mark.mutate([notice.id])}
                      >
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {q.hasNextPage && (
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
        </ScrollArea>
        <div className="flex justify-between border-t border-border p-3 text-xs">
          <Link to={"/notifications" as never} className="font-medium text-primary">
            Ver central →
          </Link>
          <Link to={"/settings/notifications" as never} className="text-muted-foreground">
            Preferências
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
