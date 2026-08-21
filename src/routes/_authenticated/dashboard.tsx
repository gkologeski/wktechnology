import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { DEAL_STAGES, formatCurrency, formatDateTime } from "@/lib/crm";
import { LazyChart } from "@/components/charts/lazy-chart";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getDealClosingsByMonth } from "@/lib/deals/closings.functions";

import { Briefcase, UserPlus, TrendingUp, DollarSign } from "lucide-react";

const compactBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1,
    style: "currency",
    currency: "BRL",
  }).format(Number(v) || 0);

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

type DashboardMetrics = {
  open_leads: number;
  active_deals: number;
  pipeline_value: number;
  won: number;
  lost: number;
  value_by_stage: Record<string, number>;
  deals_last_30_days: Record<string, number>;
};

function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      const tasksQuery = supabase
        .from("activities")
        .select("id,subject,due_date,completed,type")
        .eq("completed", false)
        .not("due_date", "is", null)
        .order("due_date", { ascending: true })
        .limit(10);
      if (uid) tasksQuery.eq("owner_id", uid);
      const [metricsRes, tasksRes] = await Promise.all([
        supabase.rpc("dashboard_metrics"),
        tasksQuery,
      ]);
      const metrics = (metricsRes.data as DashboardMetrics | null) ?? {
        open_leads: 0,
        active_deals: 0,
        pipeline_value: 0,
        won: 0,
        lost: 0,
        value_by_stage: {},
        deals_last_30_days: {},
      };
      return { metrics, tasks: tasksRes.data ?? [] };
    },
  });

  if (isLoading || !data) return <div className="text-sm text-muted-foreground">Carregando...</div>;

  const m = data.metrics;
  const openLeads = m.open_leads;
  const activeDealsCount = m.active_deals;
  const pipelineValue = Number(m.pipeline_value || 0);
  const winRate = m.won + m.lost > 0 ? (m.won / (m.won + m.lost)) * 100 : 0;

  const valueByStage = DEAL_STAGES.map((s) => ({
    stage: s.label,
    value: Number(m.value_by_stage?.[s.value] ?? 0),
  }));

  // Last 30 days deals
  const days: { day: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const count = Number(m.deals_last_30_days?.[key] ?? 0);
    days.push({ day: key.slice(5), count });
  }

  return (
    <div>
      <PageHeader title="Dashboard" description="Visão geral do seu funil de vendas." />

      <div className="mb-6">
        <OnboardingChecklist />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <StatCard
          icon={<UserPlus className="h-4 w-4" />}
          label="Leads abertos"
          value={String(openLeads)}
        />
        <StatCard
          icon={<Briefcase className="h-4 w-4" />}
          label="Negócios ativos"
          value={String(activeDealsCount)}
        />
        <StatCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Valor do pipeline"
          value={formatCurrency(pipelineValue)}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Taxa de conversão"
          value={`${winRate.toFixed(1)}%`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Valor por estágio</CardTitle>
            <CardDescription>Distribuição financeira do seu funil</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <LazyChart>
              {({ ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar }) => (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={valueByStage} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="stage" stroke="var(--color-muted-foreground)" fontSize={12} />
                    <YAxis
                      stroke="var(--color-muted-foreground)"
                      fontSize={12}
                      width={72}
                      tickFormatter={compactBRL}
                    />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="value" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </LazyChart>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Negócios criados (últimos 30 dias)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <LazyChart>
              {({ ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line }) => (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={days} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={11} />
                    <YAxis stroke="var(--color-muted-foreground)" fontSize={12} width={32} allowDecimals={false} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="var(--color-primary)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </LazyChart>

          </CardContent>
        </Card>
      </div>

      <div className="mb-6">
        <ClosingsByMonthCard />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tarefas pendentes</CardTitle>
        </CardHeader>
        <CardContent>
          {data.tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma tarefa pendente.</p>
          ) : (
            <ul className="divide-y">
              {data.tasks.map((t) => (
                <li key={t.id} className="py-2 flex justify-between items-center text-sm">
                  <span>{t.subject ?? "(sem assunto)"}</span>
                  <span className="text-muted-foreground text-xs">
                    {formatDateTime(t.due_date)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 text-sm">
            <Link to="/deals" className="text-primary hover:underline">
              Ver pipeline →
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide truncate">{label}</p>
            <p className="text-2xl font-semibold mt-1 truncate" title={value}>{value}</p>
          </div>
          <div className="h-10 w-10 shrink-0 rounded-md bg-primary/10 text-primary grid place-items-center">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ClosingsByMonthCard() {
  const [metric, setMetric] = useState<"count" | "value">("count");
  const fetchSeries = useServerFn(getDealClosingsByMonth);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["deals", "closings-by-month"],
    queryFn: () => fetchSeries({ data: { months: 12 } }),
    staleTime: 5 * 60_000,
  });

  const rows = (data ?? []).map((r) => ({
    label: r.label,
    month: r.month,
    won: metric === "count" ? r.wonCount : r.wonValue,
    lost: metric === "count" ? r.lostCount : r.lostValue,
    rate: r.conversionRate,
  }));
  const hasData = rows.some((r) => r.won > 0 || r.lost > 0);

  const monthRange = (month: string) => {
    const d = new Date(month);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const iso = (x: Date) =>
      `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
    return { closedFrom: iso(d), closedTo: iso(end) };
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <CardTitle className="text-base">Fechamentos por mês</CardTitle>
          <CardDescription>
            Ganhos e perdidos pela data real de fechamento (últimos 12 meses)
          </CardDescription>
        </div>
        <div className="flex gap-1" role="group" aria-label="Métrica do gráfico">
          <Button
            type="button"
            size="sm"
            variant={metric === "count" ? "default" : "outline"}
            aria-pressed={metric === "count"}
            onClick={() => setMetric("count")}
          >
            Quantidade
          </Button>
          <Button
            type="button"
            size="sm"
            variant={metric === "value" ? "default" : "outline"}
            aria-pressed={metric === "value"}
            onClick={() => setMetric("value")}
          >
            Valor
          </Button>
        </div>
      </CardHeader>
      <CardContent className="h-80">
        {isLoading ? (
          <div className="h-full space-y-3" aria-busy="true">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-[240px] w-full" />
          </div>
        ) : isError ? (
          <div className="h-full grid place-items-center text-center">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Não foi possível carregar os fechamentos.
              </p>
              <Button type="button" size="sm" variant="outline" onClick={() => refetch()}>
                Tentar novamente
              </Button>
            </div>
          </div>
        ) : !hasData ? (
          <div className="h-full grid place-items-center">
            <p className="text-sm text-muted-foreground">
              Nenhum negócio fechado nos últimos 12 meses.
            </p>
          </div>
        ) : (
          <LazyChart>
            {({
              ResponsiveContainer,
              ComposedChart,
              CartesianGrid,
              XAxis,
              YAxis,
              Tooltip,
              Legend,
              Bar,
              Line,
            }) => (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={11} />
                  <YAxis
                    yAxisId="left"
                    stroke="var(--color-muted-foreground)"
                    fontSize={12}
                    width={metric === "value" ? 72 : 36}
                    allowDecimals={false}
                    tickFormatter={(v: number) => (metric === "value" ? compactBRL(v) : String(v))}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="var(--color-muted-foreground)"
                    fontSize={12}
                    width={44}
                    domain={[0, 100]}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <Tooltip
                    formatter={(v: number, name: string) =>
                      name === "Conversão"
                        ? [`${Number(v).toFixed(1)}%`, name]
                        : [metric === "value" ? formatCurrency(v) : String(v), name]
                    }
                  />
                  <Legend />
                  <Bar
                    yAxisId="left"
                    dataKey="won"
                    name="Ganhos"
                    fill="var(--color-primary)"
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                    onClick={(p: { payload?: { month?: string } }) => {
                      const month = p?.payload?.month;
                      if (month) {
                        const q = monthRange(month);
                        window.location.assign(
                          `/deals?closedFrom=${q.closedFrom}&closedTo=${q.closedTo}`,
                        );
                      }
                    }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="lost"
                    name="Perdidos"
                    fill="var(--color-destructive)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="rate"
                    name="Conversão"
                    stroke="var(--color-muted-foreground)"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </LazyChart>
        )}
      </CardContent>
    </Card>
  );
}
