import { formatDateTime } from "@/lib/crm";
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  listMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getMyNotificationPrefs,
  type NotificationCategory,
  type NotificationPrefs,
} from "@/lib/notifications.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

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
  const listFn = useServerFn(listMyNotifications);
  const readFn = useServerFn(markNotificationRead);
  const readAllFn = useServerFn(markAllNotificationsRead);
  const prefsFn = useServerFn(getMyNotificationPrefs);
  const [shaking, setShaking] = useState(false);
  const prefsRef = useRef<NotificationPrefs | null>(null);

  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listFn(),
    refetchInterval: 60_000,
  });

  const prefsQ = useQuery({
    queryKey: ["notification-prefs"],
    queryFn: () => prefsFn(),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (prefsQ.data?.prefs) prefsRef.current = prefsQ.data.prefs;
  }, [prefsQ.data]);

  // Realtime: refresh + toast + shake/sound on new notification
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel("notif-" + user.id)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as { title?: string; body?: string; type?: string };
          const cat = (n.type ?? "") as NotificationCategory;
          const channel = prefsRef.current?.[cat];
          toast.message(n.title ?? "Nova notificação", { description: n.body ?? undefined });
          if (channel?.sound !== false) playBeep();
          if (channel?.shake !== false) {
            setShaking(true);
            setTimeout(() => setShaking(false), 850);
          }
          qc.invalidateQueries({ queryKey: ["notifications"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id, qc]);

  const mark = useMutation({
    mutationFn: (id: string) => readFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const markAll = useMutation({
    mutationFn: () => readAllFn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const items = q.data?.items ?? [];
  const unread = q.data?.unread ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
          <Bell className={`h-5 w-5 ${shaking ? "animate-bell-shake" : ""}`} />
          {unread > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center">
              {unread > 99 ? "99+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="p-3 border-b flex items-center justify-between">
          <div className="text-sm font-medium">Notificações</div>
          {unread > 0 && (
            <Button size="sm" variant="ghost" onClick={() => markAll.mutate()}>
              <CheckCheck className="h-3.5 w-3.5 mr-1" /> Marcar todas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma notificação.
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => {
                const inner = (
                  <div
                    className={`p-3 hover:bg-muted/50 cursor-pointer ${!n.read_at ? "bg-primary/5" : ""}`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read_at && (
                        <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{n.title}</div>
                        {n.body && (
                          <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>
                        )}
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {formatDateTime(n.created_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
                const handle = () => {
                  if (!n.read_at) mark.mutate(n.id);
                };
                return (
                  <li key={n.id} onClick={handle}>
                    {n.link ? <Link to={n.link as never}>{inner}</Link> : inner}
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
        <div className="p-2 border-t text-right">
          <Link
            to={"/settings/notifications" as never}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Preferências →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
