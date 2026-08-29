import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPlatformStatus } from "@/lib/platform-observability.functions";
import { rescheduleLovableCron } from "@/lib/admin-cron.functions";
import { backfillQualificationActivities } from "@/lib/prospecting/qualifications-backfill.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIsPlatformAdmin } from "@/lib/use-platform-admin";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";


export function AdminStatusPage() {
  const { isPlatformAdmin, loading } = useIsPlatformAdmin();
  const fn = useServerFn(getPlatformStatus);
  const reschedule = useServerFn(rescheduleLovableCron);
  const backfill = useServerFn(backfillQualificationActivities);
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["platform-status"],
    queryFn: () => fn(),
    enabled: isPlatformAdmin,
    refetchInterval: 30_000,
  });
  const rescheduleMut = useMutation({
    mutationFn: () => reschedule(),
    onSuccess: (r: { result?: { rescheduled?: unknown[] } }) => {
      const n = Array.isArray(r?.result?.rescheduled) ? r.result!.rescheduled!.length : 0;
      toast.success(`Crons reagendados (${n} jobs).`);
      qc.invalidateQueries({ queryKey: ["platform-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const backfillMut = useMutation({
    mutationFn: () => backfill(),
    onSuccess: (r: { total: number; created: number; existing: number; failed: number }) => {
      toast.success(
        `Backfill concluído: ${r.created} criada(s), ${r.existing} já existia(m), ${r.failed} falha(s) de ${r.total}.`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return <div className="p-6">Carregando…</div>;
  if (!isPlatformAdmin) return <div className="p-6">Acesso restrito a super-admins.</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Status da Plataforma</h1>
        <p className="text-sm text-muted-foreground">
          Saúde de crons, integrações e alertas recentes. Atualização automática a cada 30s.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Workspaces</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {data?.integrations.workspaces ?? "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Contas Gmail</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {data?.integrations.gmail_accounts ?? "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">WhatsApp WABA</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {data?.integrations.whatsapp_accounts ?? "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Twilio</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {data?.integrations.twilio_integrations ?? "—"}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Manutenção</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => backfillMut.mutate()}
            disabled={backfillMut.isPending}
          >
            {backfillMut.isPending ? "Executando…" : "Backfill de qualificações na timeline"}
          </Button>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Cria a atividade "Pesquisa" na timeline para qualificações concluídas antes do registro
          automático. A ação é idempotente: executar de novo não duplica registros.
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Cron Jobs</CardTitle>
          <Button
            size="sm"
            onClick={() => rescheduleMut.mutate()}
            disabled={rescheduleMut.isPending}
          >
            {rescheduleMut.isPending ? "Reagendando…" : "Reagendar crons"}
          </Button>
        </CardHeader>

        <CardContent>
          {error ? (
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : "Falha ao carregar crons."}
            </p>
          ) : isLoading ? (
            "Carregando…"
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Última execução</TableHead>
                  <TableHead>Duração</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.cronJobs ?? []).map((c) => {
                  const late = (c.late_minutes ?? 0) > 60;
                  const failed = !!(c.status && c.status !== "succeeded");
                  const unhealthy = Boolean(c.endpoint_unhealthy);
                  const rowClass =
                    failed || unhealthy
                      ? "bg-destructive/10 hover:bg-destructive/15"
                      : late
                        ? "bg-warning/10 hover:bg-warning/15"
                        : "bg-success/5 hover:bg-success/10";
                  const badgeClass = failed
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive"
                    : late
                      ? "bg-warning text-warning-foreground hover:bg-warning"
                      : "bg-success text-success-foreground hover:bg-success";
                  return (
                    <TableRow key={c.jobname} className={rowClass}>
                      <TableCell className="font-mono text-xs">{c.jobname}</TableCell>
                      <TableCell className="font-mono text-xs">{c.schedule}</TableCell>
                      <TableCell>
                        <Badge className={badgeClass}>{c.status ?? "—"}</Badge>
                      </TableCell>
                      <TableCell>
                        {c.app_last_status == null ? (
                          <span className="text-xs text-muted-foreground">sem registro</span>
                        ) : unhealthy ? (
                          <Badge
                            className="bg-destructive text-destructive-foreground hover:bg-destructive"
                            title={
                              c.app_last_error ?? "A aplicação não respondeu à chamada agendada."
                            }
                          >
                            não respondeu
                          </Badge>
                        ) : (
                          <Badge className="bg-success text-success-foreground hover:bg-success">
                            ok
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {c.last_start
                          ? formatDistanceToNow(new Date(c.last_start), {
                              addSuffix: true,
                              locale: ptBR,
                            })
                          : "—"}
                      </TableCell>
                      <TableCell>{c.duration_ms != null ? `${c.duration_ms} ms` : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Últimas execuções (observabilidade)</CardTitle>
        </CardHeader>
        <CardContent>
          {(data?.recentCronRuns ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem execuções registradas.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Métricas / erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(
                  (data?.recentCronRuns ?? []) as Array<{
                    id: string;
                    job_name: string;
                    started_at: string;
                    duration_ms: number | null;
                    status: string;
                    metrics: string;
                    error: string | null;
                  }>
                ).map((r) => {
                  const badgeClass =
                    r.status === "error"
                      ? "bg-destructive text-destructive-foreground hover:bg-destructive"
                      : r.status === "success"
                        ? "bg-success text-success-foreground hover:bg-success"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary";
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.job_name}</TableCell>
                      <TableCell>
                        <Badge className={badgeClass}>{r.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatDistanceToNow(new Date(r.started_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.duration_ms != null ? `${r.duration_ms} ms` : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-[11px] max-w-[420px] truncate">
                        {r.error ?? r.metrics}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alertas recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {(data?.recentEvents ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem alertas recentes.</p>
          ) : (
            <ul className="space-y-2">
              {(data?.recentEvents ?? []).map((e) => {
                const isCritical = e.severity === "critical";
                const isWarning = e.severity === "warning" || e.severity === "warn";
                const rowClass = isCritical
                  ? "bg-destructive/10 border-destructive/30"
                  : isWarning
                    ? "bg-warning/10 border-warning/30"
                    : "bg-muted/40 border-border";
                const badgeClass = isCritical
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive"
                  : isWarning
                    ? "bg-warning text-warning-foreground hover:bg-warning"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary";
                return (
                  <li
                    key={e.id}
                    className={`flex items-center justify-between text-sm rounded-md border px-3 py-2 ${rowClass}`}
                  >
                    <span>
                      <Badge className={badgeClass}>{e.severity}</Badge> {e.message}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatDistanceToNow(new Date(e.fired_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
