// Painel inicial do TechSales. Reúne KPIs comparativos, negócios em fase
// avançada, próximas reuniões, volume de contatos, funil e pendências.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { BarChart3, Briefcase, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { EmptyState, PageHeader, Skeletons } from "@/components/techhire/ui";
import { getSalesDashboard } from "@/lib/deals/sales-dashboard.functions";
import type {
  SalesDashboardPeriodDays,
  SalesDashboardScope,
} from "@/lib/deals/sales-dashboard.types";
import { SalesKpiStrip } from "@/components/deals/dashboard/kpi-strip";
import {
  AdvancedDealsPanel,
  AttentionDealsPanel,
} from "@/components/deals/dashboard/deal-panels";
import { MeetingsAgenda } from "@/components/deals/dashboard/meetings-agenda";
import { ContactsChart } from "@/components/deals/dashboard/contacts-chart";
import { FunnelPanel } from "@/components/deals/dashboard/funnel-panel";
import { TasksPanel, LeadsToWorkPanel } from "@/components/deals/dashboard/tasks-and-leads";
import { ClosingsByMonthCard } from "@/components/deals/dashboard/closings-by-month-card";
import { DashboardFilters } from "@/components/deals/dashboard/dashboard-filters";

const SearchSchema = z.object({
  period: z.union([z.literal(7), z.literal(30), z.literal(90)]).optional(),
  pipeline: z.string().uuid().optional(),
  scope: z.enum(["me", "team"]).optional(),
});

export const Route = createFileRoute("/_authenticated/dashboard")({
  validateSearch: (s) => SearchSchema.parse(s),
  component: DashboardPage,
});

function DashboardPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const periodDays: SalesDashboardPeriodDays = search.period ?? 30;
  const pipelineId = search.pipeline ?? null;
  const scope: SalesDashboardScope = search.scope ?? "me";

  const fetchDashboard = useServerFn(getSalesDashboard);
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["sales-dashboard", periodDays, pipelineId, scope],
    queryFn: () => fetchDashboard({ data: { periodDays, pipelineId, scope } }),
    staleTime: 60_000,
  });

  const header = (
    <PageHeader
      eyebrow="TechSales · Vendas"
      title="Painel de vendas"
      description={
        data
          ? `${data.kpis.openDeals} negócios abertos · ${data.meetings.length} reunião(ões) nos próximos 7 dias`
          : "Visão consolidada do funil, agenda e produtividade comercial."
      }
      descriptionLive
      primaryAction={
        <Button asChild size="sm">
          <Link to="/deals">
            <Briefcase className="mr-2 h-4 w-4" aria-hidden />
            Ir para Negócios
          </Link>
        </Button>
      }
      secondaryActions={
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Atualizar painel"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} aria-hidden />
            Atualizar
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/reports">
              <BarChart3 className="mr-2 h-4 w-4" aria-hidden />
              Relatórios
            </Link>
          </Button>
        </>
      }
    />
  );

  return (
    <div className="flex flex-col gap-6 pb-10">
      {header}

      <DashboardFilters
        periodDays={periodDays}
        onPeriodChange={(v) => navigate({ search: (s) => ({ ...s, period: v }) })}
        pipelines={data?.pipelines ?? []}
        pipelineId={pipelineId}
        onPipelineChange={(v) =>
          navigate({ search: (s) => ({ ...s, pipeline: v ?? undefined }) })
        }
        scope={data?.effectiveScope ?? scope}
        onScopeChange={(v) => navigate({ search: (s) => ({ ...s, scope: v }) })}
        canViewTeam={data?.canViewTeam ?? false}
        disabled={isLoading}
      />

      <OnboardingChecklist />

      {isLoading ? (
        <DashboardSkeleton />
      ) : isError ? (
        <EmptyState
          title="Não foi possível carregar o painel"
          description={error instanceof Error ? error.message : "Tente novamente em instantes."}
          action={
            <Button type="button" size="sm" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          }
        />
      ) : !data ? (
        <EmptyState
          title="Não foi possível carregar o painel"
          description="Os dados do painel não estão disponíveis."
          action={
            <Button type="button" size="sm" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          }
        />
      ) : (
        <>
          <SalesKpiStrip kpis={data.kpis} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AdvancedDealsPanel deals={data.advancedDeals} />
            <MeetingsAgenda meetings={data.meetings} />
          </div>

          <ContactsChart data={data.contactsByDay} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <FunnelPanel funnel={data.funnel} pipelineName={data.selectedPipelineName} />
            <AttentionDealsPanel deals={data.attentionDeals} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TasksPanel tasks={data.tasks} />
            <LeadsToWorkPanel leads={data.leadsToWork} />
          </div>

          <ClosingsByMonthCard />
        </>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeletons.MetricsGrid count={4} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeletons.Card />
        <Skeletons.Card />
      </div>
      <Skeletons.Card />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeletons.Card />
        <Skeletons.Card />
      </div>
    </div>
  );
}
