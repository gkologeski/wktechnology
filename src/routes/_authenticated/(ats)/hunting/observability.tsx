// Hunting · Execuções & Observabilidade — F3.
// Painel com budgets diários, taxa de sucesso 24h, latência e log de requisições.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, AlertTriangle, CheckCircle2, Clock, Gauge, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AtsPageHeader, EmptyState, MetricCard, MetricsGridSkeleton } from "@/components/ats/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getObservability } from "@/lib/unipile/observability.functions";

export const Route = createFileRoute("/_authenticated/(ats)/hunting/observability")({
  component: HuntingObservabilityPage,
});

function statusVariant(status: number | null): "default" | "secondary" | "destructive" | "outline" {
  if (status == null) return "outline";
  if (status >= 200 && status < 300) return "secondary";
  if (status >= 400 && status < 500) return "destructive";
  if (status >= 500) return "destructive";
  return "outline";
}

function HuntingObservabilityPage() {
  const fetchObs = useServerFn(getObservability);
  const q = useQuery({
    queryKey: ["hunting-observability"],
    queryFn: () => fetchObs(),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  const data = q.data;
  const acc = data?.account ?? null;

  return (
    <div className="flex flex-col gap-6 pb-10">
      <AtsPageHeader
        eyebrow="ATS · Hunting"
        title="Execuções & Observabilidade"
        description="Budgets diários, latência e sucesso das chamadas Unipile (LinkedIn) nas últimas 24 horas."
        primaryAction={
          <Button size="sm" variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
            <RefreshCw className={`mr-1 h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        }
      />

      {q.isLoading ? (
        <MetricsGridSkeleton count={4} />
      ) : !acc ? (
        <EmptyState
          icon={Activity}
          title="Nenhuma conta LinkedIn conectada"
          description="Conecte uma conta em Configurações · Integrações · LinkedIn para começar a ver métricas."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Requisições · 24h"
              value={data?.aggregate.total ?? 0}
              icon={Activity}
            />
            <MetricCard
              label="Taxa de sucesso"
              value={`${Math.round((data?.aggregate.success_rate ?? 0) * 100)}%`}
              icon={CheckCircle2}
            />
            <MetricCard
              label="Latência média"
              value={
                data?.aggregate.avg_latency_ms != null ? `${data.aggregate.avg_latency_ms} ms` : "—"
              }
              icon={Clock}
            />
            <MetricCard
              label="Erros · 24h"
              value={data?.aggregate.errors ?? 0}
              icon={AlertTriangle}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Gauge className="h-4 w-4 text-muted-foreground" />
                Budgets diários por endpoint (UTC)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(data?.budgets ?? []).map((b) => {
                const pct = b.limit > 0 ? Math.min(100, Math.round((b.used / b.limit) * 100)) : 0;
                const danger = pct >= 80;
                return (
                  <div key={b.endpoint} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{b.label}</span>
                        <code className="text-[10px] text-muted-foreground">{b.endpoint}</code>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            danger ? "text-destructive font-medium" : "text-muted-foreground"
                          }
                        >
                          {b.used} / {b.limit}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          restam {b.remaining}
                        </Badge>
                      </div>
                    </div>
                    <Progress value={pct} className={danger ? "[&>div]:bg-destructive" : ""} />
                    {b.last_request_at && (
                      <p className="text-[10px] text-muted-foreground">
                        Última chamada{" "}
                        {formatDistanceToNow(new Date(b.last_request_at), {
                          locale: ptBR,
                          addSuffix: true,
                        })}
                      </p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Últimas requisições</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {(data?.requests?.length ?? 0) === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  Nenhuma requisição registrada ainda.
                </div>
              ) : (
                <div className="divide-y">
                  {(data?.requests ?? []).map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <Badge variant={statusVariant(r.status)} className="text-[10px]">
                          {r.status ?? "—"}
                        </Badge>
                        <code className="truncate text-xs">
                          {r.method} {r.endpoint}
                        </code>
                        {r.error && (
                          <span className="truncate text-[11px] text-destructive">· {r.error}</span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-3 text-[11px] text-muted-foreground">
                        <span>{r.latency_ms != null ? `${r.latency_ms} ms` : "—"}</span>
                        <span>
                          {formatDistanceToNow(new Date(r.created_at), {
                            locale: ptBR,
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
