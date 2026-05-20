import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Gauge, Layers, Smile, Frown, Meh, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getFunnel, getSalesVelocity, getCohort, listPipelinesForFunnel,
} from "@/lib/analytics.functions";
import { sentimentOverview, listSentiments, runSentimentTick } from "@/lib/sentiment.functions";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid, Cell,
} from "recharts";

export const Route = createFileRoute("/_authenticated/analytics")({
  component: AnalyticsPage,
});

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n || 0);
}
function fmtPct(n: number) { return `${(n || 0).toFixed(1)}%`; }
function fmtDays(n: number) { return `${(n || 0).toFixed(1)} d`; }

function AnalyticsPage() {
  const funnelFn = useServerFn(getFunnel);
  const velocityFn = useServerFn(getSalesVelocity);
  const cohortFn = useServerFn(getCohort);
  const pipelinesFn = useServerFn(listPipelinesForFunnel);

  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth() - 5, 1).toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState("");
  const [pipelineId, setPipelineId] = useState<string>("all");

  const filters = useMemo(() => ({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    pipelineId: pipelineId === "all" ? null : pipelineId,
  }), [dateFrom, dateTo, pipelineId]);

  const { data: pipelines = [] } = useQuery({ queryKey: ["pipelines-funnel"], queryFn: () => pipelinesFn() });
  const { data: funnel } = useQuery({ queryKey: ["analytics-funnel", filters], queryFn: () => funnelFn({ data: filters }) });
  const { data: velocity } = useQuery({ queryKey: ["analytics-velocity", filters], queryFn: () => velocityFn({ data: filters }) });
  const { data: cohort } = useQuery({ queryKey: ["analytics-cohort", filters], queryFn: () => cohortFn({ data: filters }) });

  return (
    <div className="p-6 space-y-4">
      <PageHeader title="Analytics" description="Funil, sales velocity e cohort de negócios." />

      <Card>
        <CardContent className="py-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div><Label className="text-xs">De</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
          <div><Label className="text-xs">Até</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
          <div>
            <Label className="text-xs">Pipeline</Label>
            <Select value={pipelineId} onValueChange={setPipelineId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="funnel" className="space-y-4">
        <TabsList>
          <TabsTrigger value="funnel"><Layers className="h-3.5 w-3.5 mr-1" /> Funil</TabsTrigger>
          <TabsTrigger value="velocity"><Gauge className="h-3.5 w-3.5 mr-1" /> Sales Velocity</TabsTrigger>
          <TabsTrigger value="cohort"><TrendingUp className="h-3.5 w-3.5 mr-1" /> Cohort</TabsTrigger>
        </TabsList>

        <TabsContent value="funnel" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Negócios" value={String(funnel?.total ?? 0)} />
            <Kpi label="Ganhos" value={String(funnel?.stages.find((s) => s.stage === "won")?.count ?? 0)} />
            <Kpi label="Perdidos" value={String(funnel?.lost?.count ?? 0)} />
            <Kpi label="Conversão geral" value={fmtPct(funnel?.overall_conversion ?? 0)} />
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Funil por estágio</CardTitle></CardHeader>
            <CardContent>
              {!funnel || funnel.stages.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem dados no período.</p>
              ) : (
                <div className="space-y-2">
                  {funnel.stages.map((s, i) => {
                    const max = funnel.stages[0].cumulative || 1;
                    const widthPct = (s.cumulative / max) * 100;
                    return (
                      <div key={s.stage} className="space-y-1">
                        <div className="flex items-center text-sm">
                          <span className="w-32 font-medium">{s.label}</span>
                          <div className="flex-1 bg-muted rounded h-7 overflow-hidden relative">
                            <div className="bg-primary h-full flex items-center px-2 text-primary-foreground text-xs" style={{ width: `${widthPct}%` }}>
                              {s.cumulative} negócio(s)
                            </div>
                          </div>
                          <span className="w-28 text-right text-xs text-muted-foreground">{fmtCurrency(s.value)}</span>
                          <span className="w-20 text-right text-xs">
                            {i === 0 ? "—" : <Badge variant="secondary">{fmtPct(s.conversion_pct)}</Badge>}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="velocity" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Oportunidades" value={String(velocity?.opportunities ?? 0)} />
            <Kpi label="Win rate" value={fmtPct(velocity?.win_rate_pct ?? 0)} />
            <Kpi label="Ticket médio (ganhos)" value={fmtCurrency(velocity?.avg_won_value ?? 0)} />
            <Kpi label="Ciclo médio" value={fmtDays(velocity?.avg_cycle_days ?? 0)} />
          </div>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Sales velocity (receita/dia)</CardTitle></CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{fmtCurrency(velocity?.velocity_per_day ?? 0)}</div>
              <p className="text-xs text-muted-foreground mt-2">
                Fórmula: (Oportunidades × Ticket médio × Win rate) ÷ Ciclo médio em dias.
              </p>
              <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div><span className="text-muted-foreground">Pipeline aberto:</span> {fmtCurrency(velocity?.pipeline_value ?? 0)}</div>
                <div><span className="text-muted-foreground">Receita ganha:</span> {fmtCurrency(velocity?.won_value ?? 0)}</div>
                <div><span className="text-muted-foreground">Em aberto:</span> {velocity?.open_count ?? 0}</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cohort" className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Cohort por mês de criação</CardTitle></CardHeader>
            <CardContent>
              {!cohort || cohort.rows.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem dados no período.</p>
              ) : (
                <>
                  <div style={{ width: "100%", height: 240 }}>
                    <ResponsiveContainer>
                      <BarChart data={cohort.rows}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <RTooltip />
                        <Bar dataKey="created" name="Criados" fill="hsl(var(--muted-foreground))" />
                        <Bar dataKey="won" name="Ganhos" fill="hsl(var(--primary))" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="overflow-auto mt-4">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left py-1">Cohort</th>
                          <th className="text-right py-1">Criados</th>
                          <th className="text-right py-1">≤30d</th>
                          <th className="text-right py-1">≤60d</th>
                          <th className="text-right py-1">≤90d</th>
                          <th className="text-right py-1">Total ganhos</th>
                          <th className="text-right py-1">Conv. %</th>
                          <th className="text-right py-1">Receita</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cohort.rows.map((r) => (
                          <tr key={r.month} className="border-b">
                            <td className="py-1 font-medium">{r.month}</td>
                            <td className="text-right">{r.created}</td>
                            <td className="text-right">{r.w30}</td>
                            <td className="text-right">{r.w60}</td>
                            <td className="text-right">{r.w90}</td>
                            <td className="text-right">{r.won}</td>
                            <td className="text-right">{fmtPct(r.created ? (r.won / r.created) * 100 : 0)}</td>
                            <td className="text-right">{fmtCurrency(r.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </CardContent></Card>
  );
}
