import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BriefcaseBusiness,
  FileWarning,
  RefreshCw,
  TrendingUp,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, MetricCard, PageHeader, Skeletons } from "@/components/techhire/ui";
import { DashboardError } from "@/components/dashboard/dashboard-error";
import {
  DistributionBar,
  OverviewList,
  OverviewListItem,
  OverviewPanel,
} from "@/components/dashboard/overview-panel";
import { getPeopleDashboard } from "@/lib/people/dashboard.functions";

const EMPLOYMENT: Record<string, string> = {
  clt: "CLT",
  contractor: "Prestador",
  pj: "PJ",
  intern: "Estágio",
  temporary: "Temporário",
  apprentice: "Aprendiz",
  partner: "Sócio",
};

export const Route = createFileRoute("/_authenticated/people/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard | TechPeople" },
      {
        name: "description",
        content: "Acompanhe pessoas, alocações, documentos e jornadas internas.",
      },
      { property: "og:title", content: "Dashboard | TechPeople" },
      {
        property: "og:description",
        content: "Acompanhe pessoas, alocações, documentos e jornadas internas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PeopleDashboard,
});

function PeopleDashboard() {
  const get = useServerFn(getPeopleDashboard);
  const query = useQuery({
    queryKey: ["people-dashboard"],
    queryFn: () => get(),
    staleTime: 60_000,
  });
  const data = query.data;
  return (
    <div className="flex flex-col gap-6 pb-10">
      <PageHeader
        eyebrow="TechPeople · Pessoas"
        title="Dashboard"
        description="Visão geral do quadro, alocações e jornadas internas."
        primaryAction={
          <Button asChild size="sm">
            <Link to="/people">
              <Users className="mr-2 h-4 w-4" />
              Ir para Pessoas
            </Link>
          </Button>
        }
        secondaryActions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw
              className={query.isFetching ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"}
            />
            Atualizar
          </Button>
        }
      />
      {query.isLoading ? (
        <>
          <Skeletons.MetricsGrid count={4} />
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeletons.Card lines={5} />
            <Skeletons.Card lines={5} />
          </div>
        </>
      ) : query.isError || !data ? (
        <DashboardError retry={() => void query.refetch()} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Pessoas ativas"
              value={data.headcount}
              hint="Quadro atual visível"
              icon={Users}
              tone="positive"
            />
            <MetricCard
              label="Alocações ativas"
              value={data.canViewFinancials ? data.activeAllocations : "Restrito"}
              hint={
                data.canViewFinancials
                  ? `${Math.round(data.allocationRate)}% de alocação média`
                  : "Conforme sua permissão"
              }
              icon={BriefcaseBusiness}
            />
            <MetricCard
              label="Documentos a vencer"
              value={data.expiringDocuments}
              hint="Vencidos ou nos próximos 30 dias"
              icon={FileWarning}
              tone={data.expiringDocuments > 0 ? "warning" : "neutral"}
            />
            <MetricCard
              label="Margem de alocação"
              value={
                data.canViewFinancials && data.marginPct !== null
                  ? `${data.marginPct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
                  : "Restrito"
              }
              hint="Disponível conforme sua permissão"
              icon={TrendingUp}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <OverviewPanel title="Composição do quadro" description="Pessoas ativas por vínculo.">
              {data.employment.length === 0 ? (
                <EmptyState
                  compact
                  icon={Users}
                  title="Nenhuma pessoa ativa"
                  description="Cadastre pessoas para visualizar a composição do quadro."
                />
              ) : (
                <div className="space-y-3">
                  {data.employment.map((row) => (
                    <DistributionBar
                      key={row.type}
                      label={EMPLOYMENT[row.type] ?? row.type}
                      value={row.count}
                      total={Math.max(1, data.headcount)}
                    />
                  ))}
                </div>
              )}
            </OverviewPanel>
            <OverviewPanel
              title="Jornadas em andamento"
              description="Onboarding e offboarding que ainda precisam ser concluídos."
            >
              <OverviewList>
                <OverviewListItem>
                  <div>
                    <p className="text-sm font-medium text-text-primary">Onboardings ativos</p>
                    <p className="text-xs text-text-tertiary">Jornadas de entrada em andamento</p>
                  </div>
                  <span className="text-lg font-semibold tabular-nums text-text-primary">
                    {data.activeOnboarding}
                  </span>
                </OverviewListItem>
                <OverviewListItem>
                  <div>
                    <p className="text-sm font-medium text-text-primary">Offboardings ativos</p>
                    <p className="text-xs text-text-tertiary">Jornadas de saída em andamento</p>
                  </div>
                  <span className="text-lg font-semibold tabular-nums text-text-primary">
                    {data.activeOffboarding}
                  </span>
                </OverviewListItem>
                <OverviewListItem>
                  <div>
                    <p className="text-sm font-medium text-text-primary">Planos atrasados</p>
                    <p className="text-xs text-text-tertiary">Prazo previsto já ultrapassado</p>
                  </div>
                  <span className="text-lg font-semibold tabular-nums text-text-primary">
                    {data.overduePlans}
                  </span>
                </OverviewListItem>
              </OverviewList>
            </OverviewPanel>
          </div>
          <OverviewPanel
            title="Acessos rápidos"
            description="Continue pelos principais fluxos do módulo."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <Button asChild variant="outline" className="justify-start">
                <Link to="/people">
                  <Users className="mr-2 h-4 w-4" />
                  Pessoas
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link to="/people/onboarding">
                  <UserRoundCheck className="mr-2 h-4 w-4" />
                  Onboarding
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link to="/people/documents">
                  <FileWarning className="mr-2 h-4 w-4" />
                  Documentos
                </Link>
              </Button>
            </div>
          </OverviewPanel>
        </>
      )}
    </div>
  );
}
