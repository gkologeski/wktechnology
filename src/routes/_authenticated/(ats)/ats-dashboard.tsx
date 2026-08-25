// Dashboard principal do TechHire (ATS). É a "home" do módulo:
// KPIs macro + funil + entrevistas próximas + vagas em destaque + ofertas.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Briefcase,
  Users,
  CheckCircle2,
  TrendingUp,
  CalendarClock,
  FileSignature,
  Inbox,
  Sparkles,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getAtsAnalytics } from "@/lib/ats/analytics.functions";
import { getAtsDashboardExtras } from "@/lib/ats/dashboard.functions";
import { OnboardingChecklist as ModuleOnboarding } from "@/components/onboarding/module-onboarding-checklist";
import {
  AtsPageHeader,
  AtsSectionHeader,
  MetricCard,
  EmptyState,
  Skeletons,
} from "@/components/ats/ui";

export const Route = createFileRoute("/_authenticated/(ats)/ats-dashboard")({
  component: AtsDashboardPage,
});

function AtsDashboardPage() {
  const fetchAnalytics = useServerFn(getAtsAnalytics);
  const fetchExtras = useServerFn(getAtsDashboardExtras);

  const analytics = useQuery({
    queryKey: ["ats-analytics"],
    queryFn: () => fetchAnalytics(),
    staleTime: 30_000,
  });
  const extras = useQuery({
    queryKey: ["ats-dashboard-extras"],
    queryFn: () => fetchExtras(),
    staleTime: 30_000,
  });

  const loading = analytics.isLoading || extras.isLoading;

  return (
    <div className="flex flex-col gap-6 pb-10">
      <AtsPageHeader
        eyebrow="TechHire · Recrutamento"
        title="Dashboard"
        description="Visão geral do funil, entrevistas próximas e vagas em destaque."
        primaryAction={
          <Button asChild size="sm">
            <Link to="/jobs">
              <Briefcase className="mr-2 h-4 w-4" />
              Ir para Vagas
            </Link>
          </Button>
        }
        secondaryActions={
          <Button asChild size="sm" variant="outline">
            <Link to="/insights">
              <BarChart3 className="mr-2 h-4 w-4" />
              Insights avançados
            </Link>
          </Button>
        }
      />

      <ModuleOnboarding />

      {loading || !analytics.data || !extras.data ? (
        <DashboardSkeleton />
      ) : (
        <DashboardContent
          analytics={analytics.data}
          extras={extras.data}
          refreshing={analytics.isFetching || extras.isFetching}
        />
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeletons.MetricsGrid count={4} />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeletons.Card lines={5} />
        <Skeletons.Card lines={5} />
      </div>
      <Skeletons.Card lines={4} />
    </div>
  );
}

function DashboardContent({
  analytics,
  extras,
  refreshing,
}: {
  analytics: Awaited<ReturnType<typeof getAtsAnalytics>>;
  extras: Awaited<ReturnType<typeof getAtsDashboardExtras>>;
  refreshing: boolean;
}) {
  const t = analytics.totals;
  const conversion = Number(t.conversionRate ?? 0);
  const maxFunnel = Math.max(1, ...analytics.funnel.map((f) => f.count));

  return (
    <div className="flex flex-col gap-6">
      {/* KPIs macro */}
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
          hint={`${extras.offers.open} ofertas em aberto`}
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

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Funil */}
        <section className="rounded-lg border border-border-subtle bg-surface-2 p-5 shadow-xs">
          <AtsSectionHeader
            title="Funil de candidaturas"
            description="Distribuição atual dos candidatos."
            action={
              refreshing ? (
                <span className="text-xs text-text-tertiary">Atualizando…</span>
              ) : (
                <Link
                  to="/insights"
                  className="text-xs text-text-secondary hover:text-text-primary"
                >
                  Ver detalhes →
                </Link>
              )
            }
          />
          {analytics.funnel.length === 0 ? (
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
              {analytics.funnel.map((f) => (
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

        {/* Próximas entrevistas */}
        <section className="rounded-lg border border-border-subtle bg-surface-2 p-5 shadow-xs">
          <AtsSectionHeader
            title="Próximas entrevistas (7 dias)"
            description="Entrevistas agendadas e não canceladas."
            action={
              <Link
                to="/scheduling"
                className="text-xs text-text-secondary hover:text-text-primary"
              >
                Agenda →
              </Link>
            }
          />
          <div className="mt-4">
            {extras.upcomingInterviews.length === 0 ? (
              <EmptyState
                compact
                icon={CalendarClock}
                title="Nada agendado"
                description="As próximas entrevistas aparecerão aqui."
              />
            ) : (
              <ul className="divide-y divide-border-subtle">
                {extras.upcomingInterviews.map((iv) => {
                  const dt = new Date(iv.scheduled_at);
                  const when = dt.toLocaleString("pt-BR", {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <li
                      key={iv.id}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-text-primary">
                          {iv.candidate_name ?? "Candidato"}
                        </div>
                        <div className="truncate text-xs text-text-tertiary">
                          {iv.job_title ?? "Vaga —"}
                        </div>
                      </div>
                      <div className="shrink-0 text-xs text-text-secondary tabular-nums">
                        {when}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Vagas em destaque */}
        <section className="lg:col-span-2 rounded-lg border border-border-subtle bg-surface-2 p-5 shadow-xs">
          <AtsSectionHeader
            title="Vagas em destaque"
            description="Vagas publicadas com mais candidatos ativos."
            action={
              <Link to="/jobs" className="text-xs text-text-secondary hover:text-text-primary">
                Ver todas →
              </Link>
            }
          />
          <div className="mt-4">
            {extras.activeJobs.length === 0 ? (
              <EmptyState
                compact
                icon={Briefcase}
                title="Nenhuma vaga publicada"
                description="Crie e publique vagas para começar a receber candidaturas."
                action={
                  <Button size="sm" asChild>
                    <Link to="/jobs">Nova vaga</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-border-subtle">
                {extras.activeJobs.map((j) => (
                  <li key={j.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <Link
                      to="/jobs/$id"
                      params={{ id: j.id }}
                      className="min-w-0 flex-1 truncate text-text-primary hover:text-primary"
                    >
                      {j.title}
                    </Link>
                    <span className="shrink-0 text-xs text-text-tertiary tabular-nums">
                      {j.applications} ativos
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Ofertas + atalhos IA */}
        <section className="rounded-lg border border-border-subtle bg-surface-2 p-5 shadow-xs">
          <AtsSectionHeader
            title="Ofertas em andamento"
            description="Draft, enviadas e visualizadas."
          />
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Em aberto</span>
              <span className="text-text-primary tabular-nums">{extras.offers.open}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Enviadas / vistas</span>
              <span className="text-text-primary tabular-nums">{extras.offers.sent}</span>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/offers">
                <FileSignature className="mr-2 h-4 w-4" />
                Gerenciar ofertas
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/copilot">
                <Sparkles className="mr-2 h-4 w-4" />
                Abrir Recruiter Copilot
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
