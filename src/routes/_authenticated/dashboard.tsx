import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { DEAL_STAGES, formatCurrency, formatDateTime } from "@/lib/crm";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Negócios criados (últimos 30 dias)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
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
          </CardContent>
        </Card>
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
