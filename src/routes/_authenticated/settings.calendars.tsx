import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Calendar, CheckCircle2, Plus, RefreshCw, Stethoscope, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  listCalendarAccounts, startCalendarOAuth, disconnectCalendarAccount,
  setCalendarSyncEnabled, syncCalendarNow, listCalendarEvents,
  testCalendarConnection, type CalendarTestStep,
} from "@/lib/calendar.functions";

export const Route = createFileRoute("/_authenticated/settings/calendars")({
  component: CalendarsPage,
});

function CalendarsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listCalendarAccounts);
  const startFn = useServerFn(startCalendarOAuth);
  const disconnectFn = useServerFn(disconnectCalendarAccount);
  const toggleFn = useServerFn(setCalendarSyncEnabled);
  const syncFn = useServerFn(syncCalendarNow);
  const eventsFn = useServerFn(listCalendarEvents);

  const accounts = useQuery({ queryKey: ["calendar_accounts"], queryFn: () => listFn() });
  const events = useQuery({
    queryKey: ["calendar_events"],
    queryFn: () => eventsFn({ data: { limit: 50, from: new Date(Date.now() - 7 * 86400000).toISOString() } }),
  });

  const connect = useMutation({
    mutationFn: () => startFn({ data: { provider: "google", return_to: "/settings/calendars", origin: window.location.origin } }),
    onSuccess: (r) => { window.location.href = r.url; },
    onError: (e: Error) => toast.error(e.message),
  });

  const sync = useMutation({
    mutationFn: (id: string) => syncFn({ data: { id } }),
    onSuccess: (r) => {
      toast.success(`Sincronizado: ${r.imported} importados, ${r.pushed_created} criados, ${r.pushed_updated} atualizados`);
      qc.invalidateQueries({ queryKey: ["calendar_accounts"] });
      qc.invalidateQueries({ queryKey: ["calendar_events"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => toggleFn({ data: { id, enabled } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar_accounts"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => disconnectFn({ data: { id } }),
    onSuccess: () => { toast.success("Calendário desconectado"); qc.invalidateQueries({ queryKey: ["calendar_accounts"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Calendários</h1>
          <p className="text-sm text-muted-foreground">
            Conecte seu Google Calendar para sincronizar eventos e enviar reuniões agendadas no CRM automaticamente. Outlook em breve.
          </p>
        </div>
        <Button onClick={() => connect.mutate()} disabled={connect.isPending}>
          <Plus className="mr-1 h-4 w-4" /> Conectar Google
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {accounts.isLoading && <p className="p-4 text-sm text-muted-foreground">Carregando...</p>}
          {accounts.data?.items.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">Nenhum calendário conectado ainda.</p>
          )}
          <div className="divide-y">
            {accounts.data?.items.map((a) => {
              const row = a as { id: string; provider: string; email: string; sync_enabled: boolean; last_synced_at: string | null; last_status: string | null; last_error: string | null };
              return (
                <div key={row.id} className="flex items-center justify-between p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span className="font-medium">{row.email}</span>
                      <Badge variant="outline">{row.provider}</Badge>
                      {row.last_status === "error" && <Badge variant="destructive">Erro</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {row.last_synced_at ? `Última sync: ${new Date(row.last_synced_at).toLocaleString()}` : "Ainda não sincronizado"}
                      {row.last_error && <span className="ml-2 text-destructive">{row.last_error}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-xs">
                      <Switch checked={row.sync_enabled} onCheckedChange={(v) => toggle.mutate({ id: row.id, enabled: v })} />
                      Sync
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => sync.mutate(row.id)} disabled={sync.isPending}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { if (confirm("Desconectar calendário?")) remove.mutate(row.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-2 text-lg font-semibold">Próximos eventos</h2>
        <Card>
          <CardContent className="p-0">
            {events.isLoading && <p className="p-4 text-sm text-muted-foreground">Carregando...</p>}
            {events.data?.items.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nenhum evento.</p>}
            <div className="divide-y">
              {events.data?.items.map((e) => {
                const ev = e as { id: string; title: string; start_at: string | null; end_at: string | null; location: string | null; html_link: string | null };
                return (
                  <div key={ev.id} className="flex items-center justify-between p-3">
                    <div>
                      <div className="font-medium">{ev.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {ev.start_at && new Date(ev.start_at).toLocaleString()}
                        {ev.location && ` · ${ev.location}`}
                      </div>
                    </div>
                    {ev.html_link && (
                      <a href={ev.html_link} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Abrir</a>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
