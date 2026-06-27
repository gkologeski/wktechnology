// Sourcing Analytics — Onda 5 / Slice 2 / Fase 5.
// Métricas de cadências: volume, response rate, time-to-reply, ranking por
// sequência, performance por canal e funil por step.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  AlertCircle,
  Download,
  Mail,
  Reply,
  Send,
  TrendingUp,
  Users2,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AtsPageHeader,
  AtsSectionHeader,
  EmptyState,
  MetricCard,
} from "@/components/ats/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSourcingAnalytics } from "@/lib/ats/sourcing-analytics.functions";

export const Route = createFileRoute("/_authenticated/(ats)/sourcing/analytics")({
  component: SourcingAnalyticsPage,
});

const WINDOWS: { label: string; days: number }[] = [
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
];

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  linkedin_task: "LinkedIn",
  wait: "Espera",
};

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function fmtHours(h: number | null) {
  if (h == null) return "—";
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 48) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

function fmtDay(d: string) {
  const [, m, dd] = d.split("-");
  return `${dd}/${m}`;
}

function downloadCsv(filename: string, rows: (string | number | null)[][]) {
  const esc = (v: string | number | null) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function SourcingAnalyticsPage() {
  const [days, setDays] = useState<number>(30);
  const fetcher = useServerFn(getSourcingAnalytics);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["sourcing-analytics", days],
    queryFn: () => fetcher({ data: { days } }),
  });

  const chartData = useMemo(
    () =>
      (data?.timeseries ?? []).map((p) => ({
        ...p,
        label: fmtDay(p.date),
      })),
    [data?.timeseries],
  );

  function exportCsv() {
    if (!data) return;
    const rows: (string | number | null)[][] = [];
    rows.push([`Sourcing Analytics — janela ${days} dias`]);
    rows.push([]);
    rows.push(["Totais"]);
    rows.push(["Enrollments", data.totals.enrollments]);
    rows.push(["Ativos", data.totals.active]);
    rows.push(["Pausados", data.totals.paused]);
    rows.push(["Responderam", data.totals.replied]);
    rows.push(["Falhas", data.totals.failed]);
    rows.push(["Finalizados", data.totals.finished]);
    rows.push(["Taxa de resposta", (data.totals.response_rate * 100).toFixed(2) + "%"]);
    rows.push([
      "Tempo médio até resposta (h)",
      data.totals.avg_time_to_reply_hours == null
        ? ""
        : data.totals.avg_time_to_reply_hours.toFixed(2),
    ]);
    rows.push([]);
    rows.push(["Série temporal"]);
    rows.push(["Data", "Enrollments", "Enviados", "Respostas", "Falhas"]);
    for (const p of data.timeseries) {
      rows.push([p.date, p.enrollments, p.sent, p.replied, p.failed]);
    }
    rows.push([]);
    rows.push(["Por sequência"]);
    rows.push([
      "Sequência",
      "Enrollments",
      "Ativos",
      "Respostas",
      "Falhas",
      "Resp. rate %",
      "Tempo médio (h)",
    ]);
    for (const s of data.by_sequence) {
      rows.push([
        s.name,
        s.total_enrollments,
        s.active,
        s.replied,
        s.failed,
        (s.response_rate * 100).toFixed(2),
        s.avg_time_to_reply_hours == null ? "" : s.avg_time_to_reply_hours.toFixed(2),
      ]);
    }
    rows.push([]);
    rows.push(["Por canal"]);
    rows.push(["Canal", "Enviados", "Falhas", "Pulados", "Total"]);
    for (const c of data.by_channel) {
      rows.push([
        CHANNEL_LABELS[c.channel] ?? c.channel,
        c.sent,
        c.failed,
        c.skipped,
        c.total,
      ]);
    }
    rows.push([]);
    rows.push(["Funil por step"]);
    rows.push(["Step", "Enviados", "Falhas", "Pulados"]);
    for (const f of data.funnel) {
      rows.push([`Step ${f.step_order + 1}`, f.sent, f.failed, f.skipped]);
    }
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(`sourcing-analytics-${days}d-${today}.csv`, rows);
  }

  return (
    <div className="flex flex-col gap-6 pb-10">
      <AtsPageHeader
        eyebrow="ATS · Sourcing"
        title="Analytics de Sourcing"
        description="Performance das cadências, canais e funil de engajamento de candidatos."
        secondaryActions={
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border border-border-subtle bg-surface-1 p-0.5">
              {WINDOWS.map((w) => (
                <button
                  key={w.days}
                  type="button"
                  onClick={() => setDays(w.days)}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    days === w.days
                      ? "bg-surface-2 text-text-primary shadow-xs"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              {isFetching ? "Atualizando…" : "Atualizar"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportCsv}
              disabled={!data || isLoading}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              CSV
            </Button>
          </div>
        }
      />

      {error ? (
        <EmptyState
          icon={AlertCircle}
          title="Não foi possível carregar as métricas"
          description={error instanceof Error ? error.message : "Tente novamente."}
          action={
            <Button size="sm" onClick={() => refetch()}>
              Tentar de novo
            </Button>
          }
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Enrollments"
          value={data?.totals.enrollments ?? 0}
          icon={Users2}
          hint={`Janela: ${days} dias`}
          loading={isLoading}
        />
        <MetricCard
          label="Taxa de resposta"
          value={data ? pct(data.totals.response_rate) : "—"}
          icon={Reply}
          tone="positive"
          hint={`${data?.totals.replied ?? 0} responderam`}
          loading={isLoading}
        />
        <MetricCard
          label="Tempo médio até resposta"
          value={fmtHours(data?.totals.avg_time_to_reply_hours ?? null)}
          icon={TrendingUp}
          hint="Do envio do step 1 até a resposta"
          loading={isLoading}
        />
        <MetricCard
          label="Falhas"
          value={data?.totals.failed ?? 0}
          icon={AlertCircle}
          tone={data && data.totals.failed > 0 ? "negative" : "neutral"}
          hint={`${data?.totals.active ?? 0} ativos · ${data?.totals.paused ?? 0} pausados`}
          loading={isLoading}
        />
      </div>

      <section className="space-y-3">
        <AtsSectionHeader title="Performance por sequência" />
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-sm text-text-tertiary">Carregando…</div>
            ) : !data || data.by_sequence.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={Mail}
                  title="Sem cadências com enrollments na janela"
                  description="Crie uma sequência e inscreva candidatos para ver métricas."
                  compact
                  action={
                    <Button asChild size="sm" variant="outline">
                      <Link to="/sourcing/sequences">Ver sequências</Link>
                    </Button>
                  }
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sequência</TableHead>
                    <TableHead className="text-right">Enrollments</TableHead>
                    <TableHead className="text-right">Ativos</TableHead>
                    <TableHead className="text-right">Respostas</TableHead>
                    <TableHead className="text-right">Falhas</TableHead>
                    <TableHead className="text-right">Resp. rate</TableHead>
                    <TableHead className="text-right">Tempo médio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.by_sequence.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Link
                          to="/sourcing/sequences_/$id"
                          params={{ id: s.id }}
                          className="text-sm font-medium text-text-primary hover:underline"
                        >
                          {s.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.total_enrollments}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-text-secondary">
                        {s.active}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-status-open">
                        {s.replied}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-destructive">
                        {s.failed}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {pct(s.response_rate)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtHours(s.avg_time_to_reply_hours)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <AtsSectionHeader title="Por canal" />
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="px-4 py-8 text-center text-sm text-text-tertiary">
                  Carregando…
                </div>
              ) : !data || data.by_channel.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={Send}
                    title="Sem envios na janela"
                    description="Steps executados aparecerão agregados aqui."
                    compact
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Canal</TableHead>
                      <TableHead className="text-right">Enviados</TableHead>
                      <TableHead className="text-right">Falhas</TableHead>
                      <TableHead className="text-right">Pulados</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.by_channel.map((c) => (
                      <TableRow key={c.channel}>
                        <TableCell className="text-sm">
                          {CHANNEL_LABELS[c.channel] ?? c.channel}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-status-open">
                          {c.sent}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-destructive">
                          {c.failed}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-text-secondary">
                          {c.skipped}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{c.total}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <AtsSectionHeader title="Funil por step" />
          <Card>
            <CardContent className="p-4">
              {isLoading ? (
                <div className="py-8 text-center text-sm text-text-tertiary">Carregando…</div>
              ) : !data || data.funnel.length === 0 ? (
                <EmptyState
                  icon={Activity}
                  title="Sem execuções de steps"
                  description="Execuções aparecerão por ordem de step quando a cadência rodar."
                  compact
                />
              ) : (
                <div className="space-y-3">
                  {data.funnel.map((step) => {
                    const total = step.sent + step.failed + step.skipped;
                    const sentPct = total > 0 ? (step.sent / total) * 100 : 0;
                    const failedPct = total > 0 ? (step.failed / total) * 100 : 0;
                    return (
                      <div key={step.step_order} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-text-primary">
                            Step {step.step_order + 1}
                          </span>
                          <span className="text-text-tertiary tabular-nums">
                            {step.sent} enviados · {step.failed} falhas · {step.skipped} pulados
                          </span>
                        </div>
                        <div className="flex h-2 w-full overflow-hidden rounded bg-surface-sunken">
                          <div
                            className="bg-status-open"
                            style={{ width: `${sentPct}%` }}
                            aria-hidden
                          />
                          <div
                            className="bg-destructive"
                            style={{ width: `${failedPct}%` }}
                            aria-hidden
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
