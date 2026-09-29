import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, CircleDollarSign, FileCheck2, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, MetricCard, PageHeader, Skeletons } from "@/components/techhire/ui";
import { DashboardError } from "@/components/dashboard/dashboard-error";
import {
  DistributionBar,
  OverviewList,
  OverviewListItem,
  OverviewPanel,
} from "@/components/dashboard/overview-panel";
import { getContractDashboard } from "@/lib/contracts/dashboard.functions";
import { formatCurrency } from "@/lib/crm";

const STATUS: Record<string, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  in_negotiation: "Em negociação",
  awaiting_signature: "Aguardando assinatura",
  active: "Ativo",
  renewing: "Renovando",
  ended: "Encerrado",
  terminated: "Rescindido",
};
const date = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "Sem data";
const contractsSearch = {
  view: "table" as const,
  groupBy: "none" as const,
  page: 1,
  pageSize: 50,
  q: "",
  role: "",
  status: "",
  assignee: "",
  companyId: "",
  companyName: "",
  legalEntityId: "",
  startsFrom: "",
  startsTo: "",
  endsFrom: "",
  endsTo: "",
  tab: "all" as const,
  sort: "created_at",
  dir: "desc" as const,
};

export const Route = createFileRoute("/_authenticated/contracts/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard | TechContracts" },
      {
        name: "description",
        content: "Acompanhe carteira, valores, assinaturas e vencimentos de contratos.",
      },
      { property: "og:title", content: "Dashboard | TechContracts" },
      {
        property: "og:description",
        content: "Acompanhe carteira, valores, assinaturas e vencimentos de contratos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContractsDashboard,
});

function ContractsDashboard() {
  const get = useServerFn(getContractDashboard);
  const query = useQuery({
    queryKey: ["contracts-dashboard"],
    queryFn: () => get(),
    staleTime: 60_000,
  });
  const data = query.data;
  return (
    <div className="flex flex-col gap-6 pb-10">
      <PageHeader
        eyebrow="TechContracts · Contratos"
        title="Dashboard"
        description="Visão geral da carteira, assinaturas e vencimentos."
        primaryAction={
          <Button asChild size="sm">
            <Link to="/contracts" search={contractsSearch}>
              <FileText className="mr-2 h-4 w-4" />
              Ir para Contratos
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
              label="Contratos ativos"
              value={data.activeCount}
              hint="Ativos e em renovação"
              icon={FileCheck2}
              tone="positive"
            />
            <MetricCard
              label="Valor contratado ativo"
              value={formatCurrency(data.activeValue)}
              hint="Valor total da carteira atual"
              icon={CircleDollarSign}
            />
            <MetricCard
              label="Em aprovação ou assinatura"
              value={data.awaitingCount}
              hint="Revisão, negociação e assinatura"
              icon={FileText}
              tone={data.awaitingCount > 0 ? "warning" : "neutral"}
            />
            <MetricCard
              label="Vencem em 30 dias"
              value={data.expiringCount}
              hint="Contratos ativos com término próximo"
              icon={CalendarClock}
              tone={data.expiringCount > 0 ? "warning" : "neutral"}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <OverviewPanel
              title="Carteira por status"
              description="Distribuição atual dos contratos."
            >
              <div className="space-y-3">
                {data.statusCounts.map((row) => (
                  <DistributionBar
                    key={row.status}
                    label={STATUS[row.status] ?? row.status}
                    value={row.count}
                    total={Math.max(
                      1,
                      data.statusCounts.reduce((s, r) => s + r.count, 0),
                    )}
                  />
                ))}
              </div>
            </OverviewPanel>
            <OverviewPanel
              title="Próximos vencimentos"
              description="Contratos ativos que vencem nos próximos 30 dias."
              action={
                <Link
                  to="/contracts"
                  search={{ ...contractsSearch, tab: "expiring" }}
                  className="text-xs text-text-secondary hover:text-text-primary"
                >
                  Ver contratos →
                </Link>
              }
            >
              {data.expiring.length === 0 ? (
                <EmptyState
                  compact
                  icon={CalendarClock}
                  title="Nenhum vencimento próximo"
                  description="A carteira ativa não tem vencimentos nos próximos 30 dias."
                />
              ) : (
                <OverviewList>
                  {data.expiring.map((row) => (
                    <OverviewListItem key={row.id}>
                      <div className="min-w-0">
                        <Link
                          to="/contracts/$id"
                          params={{ id: row.id }}
                          className="truncate text-sm font-medium text-text-primary hover:underline"
                        >
                          {row.title}
                        </Link>
                        <p className="text-xs text-text-tertiary">
                          {row.number ?? "Sem número"} ·{" "}
                          {row.autoRenew ? "Renovação automática" : "Renovação manual"}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-text-secondary">
                        {date(row.endsAt)}
                      </span>
                    </OverviewListItem>
                  ))}
                </OverviewList>
              )}
            </OverviewPanel>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <OverviewPanel
              title="Precisam de atenção"
              description="Pendências de aprovação, assinatura ou prazo."
            >
              {data.attention.length === 0 ? (
                <EmptyState
                  compact
                  icon={FileCheck2}
                  title="Nenhuma pendência"
                  description="Não há contratos exigindo atenção agora."
                />
              ) : (
                <OverviewList>
                  {data.attention.map((row) => (
                    <OverviewListItem key={row.id}>
                      <div className="min-w-0">
                        <Link
                          to="/contracts/$id"
                          params={{ id: row.id }}
                          className="truncate text-sm font-medium text-text-primary hover:underline"
                        >
                          {row.title}
                        </Link>
                        <p className="text-xs text-text-tertiary">
                          {STATUS[row.status] ?? row.status}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-text-secondary">
                        {date(row.endsAt)}
                      </span>
                    </OverviewListItem>
                  ))}
                </OverviewList>
              )}
            </OverviewPanel>
            <OverviewPanel
              title="Contratos recentes"
              description="Últimos contratos adicionados à carteira."
            >
              <OverviewList>
                {data.recent.map((row) => (
                  <OverviewListItem key={row.id}>
                    <div className="min-w-0">
                      <Link
                        to="/contracts/$id"
                        params={{ id: row.id }}
                        className="truncate text-sm font-medium text-text-primary hover:underline"
                      >
                        {row.title}
                      </Link>
                      <p className="text-xs text-text-tertiary">
                        {STATUS[row.status] ?? row.status}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-text-secondary">
                      {formatCurrency(row.totalValue)}
                    </span>
                  </OverviewListItem>
                ))}
              </OverviewList>
            </OverviewPanel>
          </div>
        </>
      )}
    </div>
  );
}
