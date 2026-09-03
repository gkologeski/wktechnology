import { formatDateTime } from "@/lib/crm";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { DateRangePicker } from "@/components/date-range-picker";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  Gauge,
  Layers,
  Smile,
  Frown,
  Meh,
  Play,
  Mail,
  Eye,
  MousePointerClick,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getFunnel,
  getSalesVelocity,
  getCohort,
  listPipelinesForFunnel,
} from "@/lib/analytics.functions";
import { sentimentOverview, listSentiments, runSentimentTick } from "@/lib/sentiment.functions";
import { getEmailEngagementReport } from "@/lib/email-engagement.functions";
import { getSlaSummary, getSlaOffenders } from "@/lib/sla-reports.functions";
import { LazyChart } from "@/components/charts/lazy-chart";

export const Route = createFileRoute("/_authenticated/analytics")({
  component: AnalyticsPage,
});

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(n || 0);
}
function fmtPct(n: number) {
  return `${(n || 0).toFixed(1)}%`;
}
function fmtDays(n: number) {
  return `${(n || 0).toFixed(1)} d`;
}

function toIsoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function AnalyticsPage() {
  const funnelFn = useServerFn(getFunnel);
  const velocityFn = useServerFn(getSalesVelocity);
  const cohortFn = useServerFn(getCohort);
  const pipelinesFn = useServerFn(listPipelinesForFunnel);

  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth() - 5, 1)
    .toISOString()
    .slice(0, 10);
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState("");
  const [pipelineId, setPipelineId] = useState<string>("all");

  const rangeValue = useMemo(() => {
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : new Date(defaultFrom + "T00:00:00");
    const to = dateTo ? new Date(`${dateTo}T00:00:00`) : new Date();
    return { from, to };
  }, [dateFrom, dateTo, defaultFrom]);

  const filters = useMemo(
    () => ({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      pipelineId: pipelineId === "all" ? null : pipelineId,
    }),
    [dateFrom, dateTo, pipelineId],
  );

  const { data: pipelines = [] } = useQuery({
    queryKey: ["pipelines-funnel"],
    queryFn: () => pipelinesFn(),
  });
  const { data: funnel } = useQuery({
    queryKey: ["analytics-funnel", filters],
    queryFn: () => funnelFn({ data: filters }),
  });
  const { data: velocity } = useQuery({
    queryKey: ["analytics-velocity", filters],
    queryFn: () => velocityFn({ data: filters }),
  });
  const { data: cohort } = useQuery({
    queryKey: ["analytics-cohort", filters],
    queryFn: () => cohortFn({ data: filters }),
  });

  return (
    <div className="p-6 space-y-4">
      <PageHeader title="Analytics" description="Funil, sales velocity e cohort de negócios." />

      <Card>
        <CardContent className="py-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2">
            <Label className="text-xs">Período</Label>
            <DateRangePicker
              className="mt-1 w-full"
              value={rangeValue}
              defaultPreset="last180"
              onChange={(r) => {
                setDateFrom(toIsoDay(r.from));
                setDateTo(toIsoDay(r.to));
              }}
            />
          </div>
          <div>
            <Label className="text-xs">Pipeline</Label>
            <Select value={pipelineId} onValueChange={setPipelineId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {pipelines.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="funnel" className="space-y-4">
        <TabsList>
          <TabsTrigger value="funnel">
            <Layers className="h-3.5 w-3.5 mr-1" /> Funil
          </TabsTrigger>
          <TabsTrigger value="velocity">
            <Gauge className="h-3.5 w-3.5 mr-1" /> Sales Velocity
          </TabsTrigger>
          <TabsTrigger value="cohort">
            <TrendingUp className="h-3.5 w-3.5 mr-1" /> Cohort
          </TabsTrigger>
          <TabsTrigger value="sentiment">
            <Smile className="h-3.5 w-3.5 mr-1" /> Sentimento
          </TabsTrigger>
          <TabsTrigger value="emails">
            <Mail className="h-3.5 w-3.5 mr-1" /> E-mails 1:1
          </TabsTrigger>
          <TabsTrigger value="sla">
            <Timer className="h-3.5 w-3.5 mr-1" /> SLA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="funnel" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Negócios" value={String(funnel?.total ?? 0)} />
            <Kpi
              label="Ganhos"
              value={String(funnel?.stages.find((s) => s.stage === "won")?.count ?? 0)}
            />
            <Kpi label="Perdidos" value={String(funnel?.lost?.count ?? 0)} />
            <Kpi label="Conversão geral" value={fmtPct(funnel?.overall_conversion ?? 0)} />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Funil por estágio</CardTitle>
            </CardHeader>
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
                            <div
                              className="bg-primary h-full flex items-center px-2 text-primary-foreground text-xs"
                              style={{ width: `${widthPct}%` }}
                            >
                              {s.cumulative} negócio(s)
                            </div>
                          </div>
                          <span className="w-28 text-right text-xs text-muted-foreground">
                            {fmtCurrency(s.value)}
                          </span>
                          <span className="w-20 text-right text-xs">
                            {i === 0 ? (
                              "—"
                            ) : (
                              <Badge variant="secondary">{fmtPct(s.conversion_pct)}</Badge>
                            )}
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
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Sales velocity (receita/dia)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">
                {fmtCurrency(velocity?.velocity_per_day ?? 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Fórmula: (Oportunidades × Ticket médio × Win rate) ÷ Ciclo médio em dias.
              </p>
              <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Pipeline aberto:</span>{" "}
                  {fmtCurrency(velocity?.pipeline_value ?? 0)}
                </div>
                <div>
                  <span className="text-muted-foreground">Receita ganha:</span>{" "}
                  {fmtCurrency(velocity?.won_value ?? 0)}
                </div>
                <div>
                  <span className="text-muted-foreground">Em aberto:</span>{" "}
                  {velocity?.open_count ?? 0}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cohort" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Cohort por mês de criação</CardTitle>
            </CardHeader>
            <CardContent>
              {!cohort || cohort.rows.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem dados no período.</p>
              ) : (
                <>
                  <div style={{ width: "100%", height: 240 }}>
                    <LazyChart>
                      {({
                        ResponsiveContainer,
                        BarChart,
                        CartesianGrid,
                        XAxis,
                        YAxis,
                        Tooltip: RTooltip,
                        Bar,
                      }) => (
                        <ResponsiveContainer>
                          <BarChart data={cohort.rows}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} width={40} allowDecimals={false} />
                            <RTooltip />
                            <Bar
                              dataKey="created"
                              name="Criados"
                              fill="hsl(var(--muted-foreground))"
                            />
                            <Bar dataKey="won" name="Ganhos" fill="hsl(var(--primary))" />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </LazyChart>
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
                            <td className="text-right">
                              {fmtPct(r.created ? (r.won / r.created) * 100 : 0)}
                            </td>
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

        <TabsContent value="sentiment" className="space-y-4">
          <SentimentTab />
        </TabsContent>

        <TabsContent value="emails" className="space-y-4">
          <EmailEngagementTab dateFrom={dateFrom} dateTo={dateTo} />
        </TabsContent>

        <TabsContent value="sla" className="space-y-4">
          <SlaReportsTab dateFrom={dateFrom} dateTo={dateTo} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SlaReportsTab({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const sumFn = useServerFn(getSlaSummary);
  const offFn = useServerFn(getSlaOffenders);
  const filters = useMemo(
    () => ({
      from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
      to: dateTo ? new Date(dateTo + "T23:59:59").toISOString() : undefined,
    }),
    [dateFrom, dateTo],
  );
  const sumQ = useQuery({
    queryKey: ["sla-summary", filters],
    queryFn: () => sumFn({ data: filters }),
  });
  const offQ = useQuery({
    queryKey: ["sla-offenders", filters],
    queryFn: () => offFn({ data: filters }),
  });
  const s = sumQ.data;
  const fmtMin = (m: number) => (m < 60 ? `${m} min` : `${(m / 60).toFixed(1)} h`);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Tickets com SLA" value={String(s?.total ?? 0)} />
        <Kpi label="Cumprimento 1ª resposta" value={fmtPct(s?.fr_compliance_pct ?? 0)} />
        <Kpi label="Cumprimento resolução" value={fmtPct(s?.res_compliance_pct ?? 0)} />
        <Kpi label="Tempo médio 1ª resposta" value={s ? fmtMin(s.avg_fr_minutes) : "—"} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top agentes com violações</CardTitle>
          </CardHeader>
          <CardContent>
            {!offQ.data?.agents.length ? (
              <p className="text-xs text-muted-foreground">Sem dados.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-1">Agente</th>
                    <th className="text-right py-1">Tickets</th>
                    <th className="text-right py-1">Violações</th>
                    <th className="text-right py-1">%</th>
                  </tr>
                </thead>
                <tbody>
                  {offQ.data.agents.map((a) => (
                    <tr key={a.key} className="border-b last:border-0">
                      <td className="py-1">{a.label}</td>
                      <td className="py-1 text-right">{a.total}</td>
                      <td className="py-1 text-right">{a.breached}</td>
                      <td className="py-1 text-right">{fmtPct(a.pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top filas com violações</CardTitle>
          </CardHeader>
          <CardContent>
            {!offQ.data?.pipelines.length ? (
              <p className="text-xs text-muted-foreground">Sem dados.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-1">Fila</th>
                    <th className="text-right py-1">Tickets</th>
                    <th className="text-right py-1">Violações</th>
                    <th className="text-right py-1">%</th>
                  </tr>
                </thead>
                <tbody>
                  {offQ.data.pipelines.map((p) => (
                    <tr key={p.key} className="border-b last:border-0">
                      <td className="py-1">{p.label}</td>
                      <td className="py-1 text-right">{p.total}</td>
                      <td className="py-1 text-right">{p.breached}</td>
                      <td className="py-1 text-right">{fmtPct(p.pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmailEngagementTab({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const fn = useServerFn(getEmailEngagementReport);
  const filters = useMemo(
    () => ({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [dateFrom, dateTo],
  );
  const { data } = useQuery({
    queryKey: ["email-engagement-report", filters],
    queryFn: () => fn({ data: filters }),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="E-mails enviados" value={String(data?.total_sent ?? 0)} />
        <Kpi label="Destinatários únicos" value={String(data?.unique_recipients ?? 0)} />
        <Kpi label="Taxa de abertura" value={fmtPct(data?.open_rate_pct ?? 0)} />
        <Kpi label="Taxa de clique" value={fmtPct(data?.click_rate_pct ?? 0)} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Mail className="h-4 w-4" /> Engajamento ao longo do tempo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data || data.by_day.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem envios no período.</p>
          ) : (
            <div style={{ width: "100%", height: 240 }}>
              <LazyChart>
                {({
                  ResponsiveContainer,
                  LineChart,
                  CartesianGrid,
                  XAxis,
                  YAxis,
                  Tooltip: RTooltip,
                  Legend,
                  Line,
                }) => (
                  <ResponsiveContainer>
                    <LineChart data={data.by_day}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <RTooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="sent"
                        name="Enviados"
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <Line
                        type="monotone"
                        dataKey="opened"
                        name="Abertos"
                        stroke="hsl(var(--primary))"
                      />
                      <Line
                        type="monotone"
                        dataKey="clicked"
                        name="Clicados"
                        stroke="hsl(var(--destructive))"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </LazyChart>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Top mensagens por engajamento</CardTitle>
        </CardHeader>
        <CardContent>
          {!data?.top.length ? (
            <p className="text-xs text-muted-foreground">Sem mensagens no período.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-1">Assunto</th>
                    <th className="text-left py-1">Para</th>
                    <th className="text-left py-1">Enviado em</th>
                    <th className="text-right py-1">
                      <Eye className="h-3 w-3 inline" /> Aberturas
                    </th>
                    <th className="text-right py-1">
                      <MousePointerClick className="h-3 w-3 inline" /> Cliques
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.top.map((r) => (
                    <tr key={r.id} className="border-b">
                      <td className="py-1 max-w-[280px] truncate">
                        {r.subject || "(sem assunto)"}
                      </td>
                      <td className="py-1">{r.to ?? "—"}</td>
                      <td className="py-1">{r.sent_at ? formatDateTime(r.sent_at) : "—"}</td>
                      <td className="py-1 text-right">{r.open_count}</td>
                      <td className="py-1 text-right">{r.click_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        CTOR (cliques sobre aberturas): {fmtPct(data?.ctor_pct ?? 0)}
      </p>
    </div>
  );
}

function SentimentTab() {
  const overviewFn = useServerFn(sentimentOverview);
  const listFn = useServerFn(listSentiments);
  const tickFn = useServerFn(runSentimentTick);
  const ov = useQuery({ queryKey: ["sent-ov"], queryFn: () => overviewFn({ data: { days: 30 } }) });
  const ls = useQuery({ queryKey: ["sent-ls"], queryFn: () => listFn({ data: { limit: 50 } }) });
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              const r = await tickFn();
              toast.success(`Analisadas ${r.processed} mensagens`);
              ov.refetch();
              ls.refetch();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Erro");
            }
          }}
        >
          <Play className="h-3.5 w-3.5 mr-1" />
          Analisar agora
        </Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Mensagens analisadas (30d)" value={String(ov.data?.total ?? 0)} />
        <Kpi label="Positivas" value={String(ov.data?.positive ?? 0)} />
        <Kpi label="Neutras" value={String(ov.data?.neutral ?? 0)} />
        <Kpi label="Negativas" value={String(ov.data?.negative ?? 0)} />
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Mensagens recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm divide-y">
            {(ls.data ?? []).map((r) => (
              <div key={r.id} className="py-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {r.label === "positive" ? (
                    <Smile className="h-4 w-4 text-emerald-600" />
                  ) : r.label === "negative" ? (
                    <Frown className="h-4 w-4 text-rose-600" />
                  ) : (
                    <Meh className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-xs uppercase">{r.source}</span>
                  <span className="text-xs text-muted-foreground truncate">
                    {(r.keywords ?? []).slice(0, 4).join(", ")}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {r.emotion && <Badge variant="outline">{r.emotion}</Badge>}
                  <span>{Number(r.score).toFixed(2)}</span>
                  <span>{formatDateTime(r.analyzed_at)}</span>
                </div>
              </div>
            ))}
            {!ls.data?.length && (
              <p className="text-muted-foreground py-4 text-center">Sem análises ainda.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
