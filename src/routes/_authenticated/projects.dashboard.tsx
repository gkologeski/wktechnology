import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Clock3, FolderKanban, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, MetricCard, PageHeader, Skeletons } from "@/components/techhire/ui";
import { DashboardError } from "@/components/dashboard/dashboard-error";
import {
  DistributionBar,
  OverviewList,
  OverviewListItem,
  OverviewPanel,
} from "@/components/dashboard/overview-panel";
import { getProjectDashboard } from "@/lib/projects/dashboard.functions";

const STATUS: Record<string, string> = {
  planning: "Planejamento",
  active: "Ativo",
  on_hold: "Em espera",
  done: "Concluído",
  cancelled: "Cancelado",
  draft: "Rascunho",
  submitted: "Enviado",
  approved: "Aprovado",
  rejected: "Rejeitado",
};
const date = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "Sem prazo";
const hours = (minutes: number) =>
  `${(minutes / 60).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;

export const Route = createFileRoute("/_authenticated/projects/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard | TechProjects" },
      { name: "description", content: "Acompanhe projetos, tarefas, prazos e horas registradas." },
      { property: "og:title", content: "Dashboard | TechProjects" },
      {
        property: "og:description",
        content: "Acompanhe projetos, tarefas, prazos e horas registradas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProjectsDashboard,
});

function ProjectsDashboard() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const get = useServerFn(getProjectDashboard);
  const query = useQuery({
    queryKey: ["projects-dashboard", from, to],
    queryFn: () => get({ data: { from, to } }),
    staleTime: 60_000,
  });
  const data = query.data;
  return (
    <div className="flex flex-col gap-6 pb-10">
      <PageHeader
        eyebrow="TechProjects · Projetos"
        title="Dashboard"
        description="Visão geral de execução, prazos e esforço do mês."
        primaryAction={
          <Button asChild size="sm">
            <Link to="/projects">
              <FolderKanban className="mr-2 h-4 w-4" />
              Ir para Projetos
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
              label="Projetos ativos"
              value={data.activeCount}
              hint="Em execução agora"
              icon={FolderKanban}
              tone="positive"
            />
            <MetricCard
              label="Progresso médio"
              value={`${Math.round(data.averageProgress)}%`}
              hint="Média dos projetos ativos"
              icon={CheckCircle2}
            />
            <MetricCard
              label="Tarefas em aberto"
              value={data.openTasks}
              hint={`${data.overdueTasks} atrasadas`}
              icon={AlertTriangle}
              tone={data.overdueTasks > 0 ? "warning" : "neutral"}
            />
            <MetricCard
              label="Horas no mês"
              value={hours(data.trackedMinutes)}
              hint="Registros visíveis no período"
              icon={Clock3}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <OverviewPanel
              title="Projetos em andamento"
              description="Progresso e prazo dos projetos mais recentes."
              action={
                <Link
                  to="/projects"
                  className="text-xs text-text-secondary hover:text-text-primary"
                >
                  Ver projetos →
                </Link>
              }
            >
              {data.projects.length === 0 ? (
                <EmptyState
                  compact
                  icon={FolderKanban}
                  title="Nenhum projeto"
                  description="Crie um projeto para começar a acompanhar a execução."
                />
              ) : (
                <OverviewList>
                  {data.projects.map((row) => (
                    <OverviewListItem key={row.id}>
                      <div className="min-w-0 flex-1">
                        <Link
                          to="/projects/$id"
                          params={{ id: row.id }}
                          className="truncate text-sm font-medium text-text-primary hover:underline"
                        >
                          {row.name}
                        </Link>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.max(0, Math.min(100, row.progress))}%` }}
                          />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-medium tabular-nums text-text-primary">
                          {Math.round(row.progress)}%
                        </p>
                        <p className="text-xs text-text-tertiary">{date(row.dueAt)}</p>
                      </div>
                    </OverviewListItem>
                  ))}
                </OverviewList>
              )}
            </OverviewPanel>
            <OverviewPanel
              title="Precisam de atenção"
              description="Projetos pausados ou com prazo ultrapassado."
            >
              {data.attention.length === 0 ? (
                <EmptyState
                  compact
                  icon={CheckCircle2}
                  title="Tudo em dia"
                  description="Não há projetos atrasados ou pausados."
                />
              ) : (
                <OverviewList>
                  {data.attention.map((row) => (
                    <OverviewListItem key={row.id}>
                      <div className="min-w-0">
                        <Link
                          to="/projects/$id"
                          params={{ id: row.id }}
                          className="truncate text-sm font-medium text-text-primary hover:underline"
                        >
                          {row.name}
                        </Link>
                        <p className="text-xs text-text-tertiary">
                          {STATUS[row.status] ?? row.status}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-text-secondary">
                        {date(row.dueAt)}
                      </span>
                    </OverviewListItem>
                  ))}
                </OverviewList>
              )}
            </OverviewPanel>
          </div>
          <OverviewPanel
            title="Horas por situação"
            description="Distribuição das horas registradas neste mês."
          >
            {data.statusMinutes.length === 0 ? (
              <EmptyState
                compact
                icon={Clock3}
                title="Sem horas registradas"
                description="Ainda não há apontamentos no período atual."
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {data.statusMinutes.map((row) => (
                  <DistributionBar
                    key={row.status}
                    label={STATUS[row.status] ?? row.status}
                    value={Math.round(row.minutes / 60)}
                    total={Math.max(1, Math.round(data.trackedMinutes / 60))}
                  />
                ))}
              </div>
            )}
          </OverviewPanel>
        </>
      )}
    </div>
  );
}
