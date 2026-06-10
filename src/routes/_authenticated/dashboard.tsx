import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { DEAL_STAGES, formatCurrency, formatDateTime } from "@/lib/crm";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";
import { Briefcase, UserPlus, TrendingUp, DollarSign } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

async function fetchAll<T>(
  build: (from: number, to: number) => Promise<{ data: T[] | null }>,
): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let page = 0; ; page++) {
    const from = page * PAGE;
    const { data } = await build(from, from + PAGE - 1);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [leads, deals, activities] = await Promise.all([
        fetchAll<{ id: string; status: string; created_at: string }>(async (from, to) => {
          const r = await supabase.from("leads").select("id,status,created_at").range(from, to);
          return { data: r.data };
        }),
        fetchAll<{ id: string; name: string; value: number; stage: string; created_at: string; expected_close_date: string | null }>(async (from, to) => {
          const r = await supabase.from("deals").select("id,name,value,stage,created_at,expected_close_date").range(from, to);
          return { data: r.data as { id: string; name: string; value: number; stage: string; created_at: string; expected_close_date: string | null }[] | null };
        }),
        supabase
          .from("activities")
          .select("id,subject,due_date,completed,type")
          .eq("completed", false)
          .not("due_date", "is", null)
          .order("due_date", { ascending: true })
          .limit(10),
      ]);
      return {
        leads,
        deals,
        tasks: activities.data ?? [],
      };
    },
  });

  if (isLoading || !data) return <div className="text-sm text-muted-foreground">Carregando...</div>;

  const openLeads = data.leads.filter((l) => l.status === "new" || l.status === "contacted").length;
  const activeDeals = data.deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const pipelineValue = activeDeals.reduce((s, d) => s + Number(d.value || 0), 0);
  const wonCount = data.deals.filter((d) => d.stage === "won").length;
  const lostCount = data.deals.filter((d) => d.stage === "lost").length;
  const winRate = wonCount + lostCount > 0 ? (wonCount / (wonCount + lostCount)) * 100 : 0;

  const valueByStage = DEAL_STAGES.map((s) => ({
    stage: s.label,
    value: data.deals.filter((d) => d.stage === s.value).reduce((sum, d) => sum + Number(d.value || 0), 0),
  }));

  // Last 30 days deals
  const days: { day: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const count = data.deals.filter((x) => x.created_at?.slice(0, 10) === key).length;
    days.push({ day: key.slice(5), count });
  }

  return (
    <div>
      <PageHeader title="Dashboard" description="Visão geral do seu funil de vendas." />

      <div className="mb-6">
        <OnboardingChecklist />
      </div>



      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard icon={<UserPlus className="h-4 w-4" />} label="Leads abertos" value={String(openLeads)} />
        <StatCard icon={<Briefcase className="h-4 w-4" />} label="Negócios ativos" value={String(activeDeals.length)} />
        <StatCard icon={<DollarSign className="h-4 w-4" />} label="Valor do pipeline" value={formatCurrency(pipelineValue)} />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Taxa de conversão" value={`${winRate.toFixed(1)}%`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Valor por estágio</CardTitle>
            <CardDescription>Distribuição financeira do seu funil</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={valueByStage}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="stage" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
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
              <LineChart data={days}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
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
                  <span className="text-muted-foreground text-xs">{formatDateTime(t.due_date)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 text-sm">
            <Link to="/deals" className="text-primary hover:underline">Ver pipeline →</Link>
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
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-semibold mt-1">{value}</p>
          </div>
          <div className="h-10 w-10 rounded-md bg-primary/10 text-primary grid place-items-center">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
