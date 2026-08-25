// Dashboard analítico do ATS — KPIs + funil + fontes (Wave 0/1 piloto).
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Briefcase,
  Users,
  CheckCircle2,
  Clock,
  TrendingUp,
  AlertCircle,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getAtsAnalytics } from "@/lib/ats/analytics.functions";
import { OnboardingChecklist as ModuleOnboarding } from "@/components/onboarding/module-onboarding-checklist";
import {
  AtsPageHeader,
  AtsSectionHeader,
  MetricCard,
  EmptyState,
  SourceBadge,
  Skeletons,
} from "@/components/ats/ui";
import { PipelineInsightsPanel } from "@/components/ats/pipeline-insights-panel";

export const Route = createFileRoute("/_authenticated/(ats)/insights")({
  component: AtsInsightsPage,
});

function AtsInsightsPage() {
  const fetcher = useServerFn(getAtsAnalytics);
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["ats-analytics"],
    queryFn: () => fetcher(),
    staleTime: 30_000,
  });

  return (
    <div className="flex flex-col gap-6 pb-10">
      <AtsPageHeader
        eyebrow="ATS · Insights"
        title="Dashboard de recrutamento"
        description="Visão geral das vagas, candidatos e funil — últimos 30 dias e totais."
      />

      <ModuleOnboarding />

      {isError ? (
        <EmptyState
          icon={AlertCircle}
          title="Não foi possível carregar os indicadores"
          description="Verifique sua conexão e tente novamente. Se persistir, abra um chamado."
          action={
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          }
        />
      ) : isLoading || !data ? (
        <InsightsSkeleton />
      ) : (
        <InsightsContent data={data} refreshing={isFetching} />
      )}
    </div>
  );
}

function InsightsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeletons.MetricsGrid count={4} />
      <Skeletons.Card lines={5} />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeletons.Card lines={4} />
        <Skeletons.Card lines={3} />
      </div>
    </div>
  );
}

function InsightsContent({
  data,
  refreshing,
}: {
  data: Awaited<ReturnType<typeof getAtsAnalytics>>;
  refreshing: boolean;
}) {
  const t = data.totals;
  const maxFunnel = Math.max(1, ...data.funnel.map((f) => f.count));
  const conversion = Number(t.conversionRate ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Vagas publicadas"
          value={t.jobsPublished}
          hint={`${t.jobs} no total`}
          icon={Briefcase}
          tone="neutral"
        />
        <MetricCard
          label="Candidaturas (30d)"
          value={t.applicationsRecent30d}
          hint={`${t.applications} totais`}
          icon={Users}
          tone="neutral"
        />
        <MetricCard
          label="Contratados"
          value={t.hired}
          hint={`${t.rejected} rejeitados`}
          icon={CheckCircle2}
          tone="positive"
        />
        <MetricCard
          label="Taxa de conversão"
          value={`${conversion}%`}
          hint={`${t.active} candidatos ativos`}
          icon={TrendingUp}
          tone={conversion >= 20 ? "positive" : conversion >= 8 ? "warning" : "negative"}
        />
      </div>

      <section className="rounded-lg border border-border-subtle bg-surface-2 p-5 shadow-xs">
        <AtsSectionHeader
          title="Funil de candidaturas"
          description="Distribuição dos candidatos pelas etapas do pipeline."
          action={
            refreshing ? <span className="text-xs text-text-tertiary">Atualizando…</span> : null
          }
        />
        {data.funnel.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              compact
              icon={Inbox}
              title="Sem candidaturas ainda"
              description="Publique uma vaga para começar a receber candidatos."
            />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {data.funnel.map((f) => (
              <div key={f.value}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="text-text-primary">{f.label}</span>
                  <span className="text-text-tertiary tabular-nums">{f.count}</span>
                </div>
                <Progress
                  value={(f.count / maxFunnel) * 100}
                  aria-label={`${f.label}: ${f.count} candidatos`}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-lg border border-border-subtle bg-surface-2 p-5 shadow-xs">
          <AtsSectionHeader
            title="Fontes de candidatos"
            description="De onde vêm seus candidatos."
          />
          <div className="mt-4">
            {data.sources.length === 0 ? (
              <EmptyState
                compact
                icon={Users}
                title="Sem dados de origem"
                description="Os candidatos aparecerão aqui assim que se aplicarem."
              />
            ) : (
              <ul className="divide-y divide-border-subtle">
                {data.sources.map((s) => (
                  <li key={s.source} className="flex items-center justify-between py-2 text-sm">
                    <SourceBadge source={s.source} />
                    <span className="text-text-primary tabular-nums">{s.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-border-subtle bg-surface-2 p-5 shadow-xs">
          <AtsSectionHeader
            title="Tempo médio para fechar"
            description="Da candidatura até a etapa final (contratado ou rejeitado)."
          />
          <div className="mt-4 flex items-end gap-2">
            <span className="text-4xl font-semibold tracking-tight text-text-primary tabular-nums">
              {t.avgDaysToClose}
            </span>
            <span className="pb-1 text-sm text-text-secondary">dias</span>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-text-secondary">
            <Clock className="h-3.5 w-3.5 text-text-tertiary" aria-hidden />
            <span>
              Aprovação atual:{" "}
              <strong className="text-text-primary tabular-nums">{conversion}%</strong>
            </span>
          </div>
        </section>
      </div>

      <PipelineInsightsPanel />
    </div>
  );
}
