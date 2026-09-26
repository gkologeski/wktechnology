// Painel inicial do TechSales. Reúne KPIs comparativos, negócios em fase
// avançada, próximas reuniões, volume de contatos, funil e pendências.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { BarChart3, Briefcase, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { useCurrentUserId } from "@/hooks/use-current-user-id";
import { EmptyState, PageHeader, Skeletons } from "@/components/techhire/ui";
import { getSalesDashboard } from "@/lib/deals/sales-dashboard.functions";
import { resolveAssignee, resolveDashboardRange, toIsoDay } from "@/lib/deals/dashboard-period";
import { SalesKpiStrip } from "@/components/deals/dashboard/kpi-strip";
import { AdvancedDealsPanel, AttentionDealsPanel } from "@/components/deals/dashboard/deal-panels";
import { MeetingsAgenda } from "@/components/deals/dashboard/meetings-agenda";
import { ContactsChart } from "@/components/deals/dashboard/contacts-chart";
import { FunnelPanel } from "@/components/deals/dashboard/funnel-panel";
import { TasksPanel, LeadsToWorkPanel } from "@/components/deals/dashboard/tasks-and-leads";
import { ClosingsByMonthCard } from "@/components/deals/dashboard/closings-by-month-card";
import { DashboardFilters } from "@/components/deals/dashboard/dashboard-filters";
import {
  LeadChannelsPanel,
  LeadFunnelPanel,
  LeadJourneyKpis,
  LeadJourneyOverview,
} from "@/components/deals/dashboard/lead-journey-panels";
import type { LeadChannel } from "@/lib/deals/sales-dashboard.types";

const SearchSchema = z.object({
  preset: z.string().max(20).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  /** Legado */
  period: z.coerce.number().optional(),
  pipeline: z.string().uuid().optional(),
  leadPipeline: z.string().uuid().optional(),
  channel: z
    .enum([
      "prospecting",
      "website",
      "paid",
      "organic",
      "referral",
      "offline",
      "import",
      "other",
      "unknown",
    ])
    .optional(),
  assignee: z.union([z.enum(["__all__", "__me__", "__none__"]), z.string().uuid()]).optional(),
  /** Legado */
  scope: z.enum(["me", "team"]).optional(),
});

export const Route = createFileRoute("/_authenticated/dashboard")({
  validateSearch: (s) => SearchSchema.parse(s),
  component: DashboardPage,
});

function DashboardPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const { range } = resolveDashboardRange(search);
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();
  const pipelineId = search.pipeline ?? null;
  const leadPipelineId = search.leadPipeline ?? null;
  const channel: LeadChannel | null = search.channel ?? null;
  const assignee = resolveAssignee(search.assignee, search.scope);

  const userId = useCurrentUserId();
  const fetchDashboard = useServerFn(getSalesDashboard);
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["sales-dashboard", fromIso, toIso, pipelineId, leadPipelineId, channel, assignee],
    queryFn: async () => {
      const result = await fetchDashboard({
        data: { from: fromIso, to: toIso, pipelineId, leadPipelineId, channel, assignee },
      });
      if (!result) {
        throw new Error(
          "Sessão expirada ou indisponível. Entre novamente ou tente atualizar o painel.",
        );
      }
      return result;
    },
    enabled: !!userId,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    staleTime: 60_000,
  });
  const loading = isLoading || !userId;

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
        range={range}
        onRangeChange={(r, key) =>
          navigate({
            search: (s) => ({
              ...s,
              period: undefined,
              preset: key ?? "custom",
              from: key ? undefined : toIsoDay(r.from),
              to: key ? undefined : toIsoDay(r.to),
            }),
          })
        }
        pipelines={data?.pipelines ?? []}
        pipelineId={pipelineId}
        onPipelineChange={(v) => navigate({ search: (s) => ({ ...s, pipeline: v ?? undefined }) })}
        leadPipelines={data?.leadPipelines ?? []}
        leadPipelineId={leadPipelineId}
        onLeadPipelineChange={(v) =>
          navigate({ search: (s) => ({ ...s, leadPipeline: v ?? undefined }) })
        }
        channel={channel}
        onChannelChange={(v) => navigate({ search: (s) => ({ ...s, channel: v ?? undefined }) })}
        assignee={data?.effectiveAssignee ?? assignee}
        onAssigneeChange={(v) =>
          navigate({ search: (s) => ({ ...s, scope: undefined, assignee: v }) })
        }
        canViewTeam={data?.canViewTeam ?? false}
        disabled={loading}
      />

      <OnboardingChecklist />

      {loading ? (
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
          <LeadJourneyKpis journey={data.leadJourney} />
          <LeadJourneyOverview journey={data.leadJourney} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <LeadChannelsPanel
              journey={data.leadJourney}
              onSelect={(v) => navigate({ search: (s) => ({ ...s, channel: v ?? undefined }) })}
            />
            <LeadFunnelPanel journey={data.leadJourney} />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <div className="h-px flex-1 bg-border-subtle" />
            <h2 className="text-sm font-semibold text-text-primary">Operação comercial</h2>
            <div className="h-px flex-1 bg-border-subtle" />
          </div>

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
      <Skeletons.Card />
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
