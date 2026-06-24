// Dashboard analítico do ATS — KPIs + funil + fontes.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Briefcase, Users, CheckCircle2, XCircle, Clock, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getAtsAnalytics } from "@/lib/ats/analytics.functions";
import { OnboardingChecklist as ModuleOnboarding } from "@/components/onboarding/module-onboarding-checklist";

export const Route = createFileRoute("/_authenticated/(ats)/insights")({
  component: AtsInsightsPage,
});

function AtsInsightsPage() {
  const fetcher = useServerFn(getAtsAnalytics);
  const { data, isLoading } = useQuery({
    queryKey: ["ats-analytics"],
    queryFn: () => fetcher(),
    staleTime: 30_000,
  });

  if (isLoading || !data) {
    return <div className="text-sm text-muted-foreground p-6">Carregando…</div>;
  }

  const t = data.totals;
  const maxFunnel = Math.max(1, ...data.funnel.map((f) => f.count));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold">Dashboard ATS</h1>
        <p className="text-sm text-muted-foreground">Visão geral do recrutamento — últimos 30 dias e totais.</p>
      </header>

      <ModuleOnboarding />


      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Vagas publicadas" value={t.jobsPublished} sub={`${t.jobs} no total`} icon={Briefcase} />
        <Kpi label="Candidaturas (30d)" value={t.applicationsRecent30d} sub={`${t.applications} totais`} icon={Users} />
        <Kpi label="Contratados" value={t.hired} sub={`${t.rejected} rejeitados`} icon={CheckCircle2} />
        <Kpi label="Taxa de conversão" value={`${t.conversionRate}%`} sub={`${t.active} ativos`} icon={TrendingUp} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Funil de candidaturas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.funnel.map((f) => (
            <div key={f.value}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span>{f.label}</span>
                <span className="text-muted-foreground">{f.count}</span>
              </div>
              <Progress value={(f.count / maxFunnel) * 100} />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fontes de candidatos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.sources.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem candidaturas ainda.</p>
            ) : (
              data.sources.map((s) => (
                <div key={s.source} className="flex items-center justify-between text-sm">
                  <Badge variant="outline">{s.source}</Badge>
                  <span>{s.count}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />Tempo médio para fechar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="text-3xl font-semibold">{t.avgDaysToClose}<span className="text-base font-normal text-muted-foreground"> dias</span></div>
            <p className="text-muted-foreground">Da candidatura até a etapa final (contratado/rejeitado).</p>
            <div className="flex items-center gap-2 pt-2">
              <XCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Aprovação: <strong>{t.conversionRate}%</strong></span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type IconType = React.ComponentType<{ className?: string }>;
function Kpi({ label, value, sub, icon: Icon }: { label: string; value: number | string; sub?: string; icon: IconType }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="text-2xl font-semibold">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}
