import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import {
  Calendar,
  CheckCircle2,
  Plus,
  RefreshCw,
  Stethoscope,
  Trash2,
  Video,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  listCalendarAccounts,
  startCalendarOAuth,
  disconnectCalendarAccount,
  setCalendarSyncEnabled,
  setCalendarMeetEnabled,
  syncCalendarNow,
  syncAccountRecordings,
  listCalendarEvents,
  testCalendarConnection,
  type CalendarTestStep,
} from "@/lib/calendar.functions";

const searchSchema = z.object({ calendar: z.string().optional() });
const GOOGLE_OAUTH_MESSAGE_ORIGINS = new Set(["https://crm.wktechnology.com.br"]);

function isTrustedGoogleOAuthMessageOrigin(origin: string) {
  return origin === window.location.origin || GOOGLE_OAUTH_MESSAGE_ORIGINS.has(origin);
}

export const Route = createFileRoute("/_authenticated/settings/calendars")({
  validateSearch: searchSchema,
  component: CalendarsPage,
});

function CalendarsPage() {
  const qc = useQueryClient();
  const search = useSearch({ from: "/_authenticated/settings/calendars" });
  const listFn = useServerFn(listCalendarAccounts);
  const startFn = useServerFn(startCalendarOAuth);
  const disconnectFn = useServerFn(disconnectCalendarAccount);
  const toggleFn = useServerFn(setCalendarSyncEnabled);
  const toggleMeetFn = useServerFn(setCalendarMeetEnabled);
  const syncFn = useServerFn(syncCalendarNow);
  const syncRecFn = useServerFn(syncAccountRecordings);
  const eventsFn = useServerFn(listCalendarEvents);
  const testFn = useServerFn(testCalendarConnection);
  const [testResult, setTestResult] = useState<{
    accountId: string;
    ok: boolean;
    steps: CalendarTestStep[];
    calendar_count?: number;
    primary_email?: string;
  } | null>(null);

  const accounts = useQuery({ queryKey: ["calendar_accounts"], queryFn: () => listFn() });
  const events = useQuery({
    queryKey: ["calendar_events"],
    queryFn: () =>
      eventsFn({ data: { limit: 50, from: new Date(Date.now() - 7 * 86400000).toISOString() } }),
  });

  useEffect(() => {
    if (search.calendar === "connected") {
      toast.success("Google Calendar conectado com sucesso");
      qc.invalidateQueries({ queryKey: ["calendar_accounts"] });
      qc.invalidateQueries({ queryKey: ["calendar_events"] });
    }
  }, [search.calendar, qc]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isTrustedGoogleOAuthMessageOrigin(event.origin)) return;
      const data = event.data as { type?: string; integration?: string };
      if (data.type !== "google-oauth-connected" || data.integration !== "calendar") return;
      toast.success("Google Calendar conectado com sucesso");
      qc.invalidateQueries({ queryKey: ["calendar_accounts"] });
      qc.invalidateQueries({ queryKey: ["calendar_events"] });
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [qc]);

  const connect = useMutation({
    mutationFn: async () => {
      const oauthWindow = window.open("about:blank", "google-calendar-oauth");
      try {
        const r = await startFn({
          data: {
            provider: "google",
            return_to: "/settings/calendars",
            origin: window.location.origin,
          },
        });
        if (oauthWindow) {
          oauthWindow.location.href = r.url;
          oauthWindow.focus();
          return { openedInNewTab: true };
        }
        const fallback = window.open(r.url, "_blank", "noopener,noreferrer");
        if (fallback) return { openedInNewTab: true };
        window.location.assign(r.url);
        return { openedInNewTab: false };
      } catch (e) {
        oauthWindow?.close();
        throw e;
      }
    },
    onSuccess: (r) => {
      if (r.openedInNewTab) {
        toast.info("Finalize a conexão do Google na nova aba.");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sync = useMutation({
    mutationFn: async (id: string) => {
      // Loop até a sincronização não vir mais como parcial (com cap de segurança).
      const MAX_BATCHES = 20;
      let totalImported = 0;
      let totalCreated = 0;
      let totalUpdated = 0;
      for (let batch = 1; batch <= MAX_BATCHES; batch++) {
        const r = (await syncFn({ data: { id } })) as
          | {
              imported: number;
              pushed_created: number;
              pushed_updated: number;
              partial?: boolean;
            }
          | undefined;
        if (!r) {
          // Resposta vazia (Worker timeout) — tenta mais um lote.
          if (batch < MAX_BATCHES) {
            toast.info(`Lote ${batch} interrompido. Retomando...`);
            continue;
          }
          break;
        }
        totalImported += r.imported ?? 0;
        totalCreated += r.pushed_created ?? 0;
        totalUpdated += r.pushed_updated ?? 0;
        if (!r.partial) break;
        toast.info(`Lote ${batch} concluído (${totalImported} importados). Continuando...`);
      }
      return { imported: totalImported, pushed_created: totalCreated, pushed_updated: totalUpdated };
    },
    onSuccess: (r) => {
      toast.success(
        `Sincronizado: ${r.imported} importados, ${r.pushed_created} criados, ${r.pushed_updated} atualizados`,
      );
      qc.invalidateQueries({ queryKey: ["calendar_accounts"] });
      qc.invalidateQueries({ queryKey: ["calendar_events"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const syncRecordings = useMutation({
    mutationFn: (id: string) => syncRecFn({ data: { account_id: id } }),
    onSuccess: (r) => {
      const res = r as { scanned: number; found: number; missing: number; errors: number };
      toast.success(
        `Gravações: ${res.found} vinculadas · ${res.missing} ainda não publicadas · ${res.errors} erros (de ${res.scanned} eventos)`,
      );
      qc.invalidateQueries({ queryKey: ["calendar_events"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      toggleFn({ data: { id, enabled } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar_accounts"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMeet = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      toggleMeetFn({ data: { id, enabled } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar_accounts"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => disconnectFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Calendário desconectado");
      qc.invalidateQueries({ queryKey: ["calendar_accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: (id: string) => testFn({ data: { id } }).then((r) => ({ ...r, accountId: id })),
    onSuccess: (r) => {
      setTestResult(r);
      if (r.ok) toast.success("Conexão validada com sucesso");
      else toast.error("Falha na conexão — veja detalhes abaixo");
      qc.invalidateQueries({ queryKey: ["calendar_accounts"] });
    },
    onError: (e: Error) => {
      setTestResult({
        accountId: "",
        ok: false,
        steps: [{ name: "Chamada ao servidor", status: "error", detail: e.message }],
      });
      toast.error(e.message);
    },
  });

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Calendários</h1>
          <p className="text-sm text-muted-foreground">
            Conecte seu Google Calendar para sincronizar eventos e enviar reuniões agendadas no CRM
            automaticamente. Outlook em breve.
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
              const row = a as {
                id: string;
                provider: string;
                email: string;
                sync_enabled: boolean;
                auto_create_meet_link: boolean;
                last_synced_at: string | null;
                last_status: string | null;
                last_error: string | null;
              };
              return (
                <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span className="font-medium">{row.email}</span>
                      <Badge variant="outline">{row.provider}</Badge>
                      {row.last_status === "error" && <Badge variant="destructive">Erro</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {row.last_synced_at
                        ? `Última sync: ${new Date(row.last_synced_at).toLocaleString()}`
                        : "Ainda não sincronizado"}
                      {row.last_error && (
                        <span className="ml-2 text-destructive">{row.last_error}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1 text-xs">
                      <Switch
                        checked={row.sync_enabled}
                        onCheckedChange={(v) => toggle.mutate({ id: row.id, enabled: v })}
                      />
                      Sync
                    </label>
                    <label
                      className="flex items-center gap-1 text-xs"
                      title="Cria automaticamente um link do Google Meet para reuniões novas enviadas ao Google Calendar"
                    >
                      <Switch
                        checked={row.auto_create_meet_link}
                        onCheckedChange={(v) => toggleMeet.mutate({ id: row.id, enabled: v })}
                      />
                      Meet automático
                    </label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => test.mutate(row.id)}
                      disabled={test.isPending}
                    >
                      <Stethoscope className="mr-1 h-4 w-4" />
                      {test.isPending && test.variables === row.id ? "Testando..." : "Testar"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => sync.mutate(row.id)}
                      disabled={sync.isPending}
                      title="Sincronizar agora"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => syncRecordings.mutate(row.id)}
                      disabled={syncRecordings.isPending}
                      title="Procurar no Google Drive gravações de reuniões já encerradas (Meet leva 10–30 min para publicar)"
                    >
                      <Video className="mr-1 h-4 w-4" />
                      {syncRecordings.isPending && syncRecordings.variables === row.id
                        ? "Buscando…"
                        : "Sincronizar gravações"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm("Desconectar calendário?")) remove.mutate(row.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {testResult && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {testResult.ok ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                <h3 className="font-semibold">
                  {testResult.ok ? "Conexão funcionando" : "Falha na conexão"}
                  {testResult.primary_email && ` — ${testResult.primary_email}`}
                </h3>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setTestResult(null)}>
                Fechar
              </Button>
            </div>
            {testResult.ok && typeof testResult.calendar_count === "number" && (
              <p className="text-sm text-muted-foreground">
                {testResult.calendar_count} calendário(s) acessível(is) na conta Google.
              </p>
            )}
            <ol className="space-y-2">
              {testResult.steps.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  {s.status === "ok" ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  ) : s.status === "error" ? (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  ) : (
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-muted-foreground" />
                  )}
                  <div className="min-w-0">
                    <div className="font-medium">{s.name}</div>
                    {s.detail && (
                      <div
                        className={
                          s.status === "error"
                            ? "break-words text-xs text-destructive"
                            : "text-xs text-muted-foreground"
                        }
                      >
                        {s.detail}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            {!testResult.ok && (
              <p className="text-xs text-muted-foreground">
                Dica: se o erro mencionar <code>invalid_grant</code> ou <code>refresh_token</code>,
                desconecte e reconecte concedendo acesso offline. Se mencionar{" "}
                <code>redirect_uri_mismatch</code>, adicione a URL atual aos URIs autorizados no
                Google Cloud Console.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="mb-2 text-lg font-semibold">Próximos eventos</h2>
        <Card>
          <CardContent className="p-0">
            {events.isLoading && <p className="p-4 text-sm text-muted-foreground">Carregando...</p>}
            {events.data?.items.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">Nenhum evento.</p>
            )}
            <div className="divide-y">
              {events.data?.items.map((e) => {
                const ev = e as {
                  id: string;
                  title: string;
                  start_at: string | null;
                  end_at: string | null;
                  location: string | null;
                  html_link: string | null;
                };
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
                      <a
                        href={ev.html_link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        Abrir
                      </a>
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
