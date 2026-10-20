import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FolderKanban,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, MetricCard, PageHeader, Skeletons } from "@/components/techhire/ui";
import { DashboardError } from "@/components/dashboard/dashboard-error";
import { IsoDateRangePicker } from "@/components/iso-date-range-picker";
import {
  DistributionBar,
  OverviewList,
  OverviewListItem,
  OverviewPanel,
} from "@/components/dashboard/overview-panel";
import { getProjectDashboard } from "@/lib/projects/dashboard.functions";
import {
  DASHBOARD_HOURS_STATUS_LABEL,
  PROJECT_STATUS_LABEL,
  formatHours,
  isIanaTimeZone,
  monthRangeInTimeZone,
  validateIsoRange,
} from "@/lib/projects/reconciliation-labels";

type Search = { from?: string; to?: string };
const ISO = /^\d{4}-\d{2}-\d{2}$/;

const date = (value: string | null) =>
  value
    ? new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" })
    : "Sem prazo";
const dateTime = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : "nunca";

export const Route = createFileRoute("/_authenticated/projects/dashboard")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    from: typeof s.from === "string" && ISO.test(s.from) ? s.from : undefined,
    to: typeof s.to === "string" && ISO.test(s.to) ? s.to : undefined,
  }),
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

function useTimeZone() {
  return useMemo(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && isIanaTimeZone(tz) ? tz : "America/Sao_Paulo";
  }, []);
}

function ProjectsDashboard() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const tz = useTimeZone();
  const fallback = monthRangeInTimeZone(new Date(), tz);
  const valid = search.from && search.to && !validateIsoRange(search.from, search.to);
  const from = valid ? (search.from as string) : fallback.from;
  const to = valid ? (search.to as string) : fallback.to;
  const get = useServerFn(getProjectDashboard);
  const query = useQuery({
    queryKey: ["projects-dashboard", from, to, tz],
    queryFn: () => get({ data: { from, to, tz } }),
    staleTime: 60_000,
  });
  const data = query.data;
  const periodLabel = `${date(from)} a ${date(to)}`;
  const reviewSearch = { tab: "issues" as const, from, to };
  return (
    <div className="flex flex-col gap-6 pb-10">
      <PageHeader
        eyebrow="TechProjects · Projetos"
        title="Dashboard"
        description="Situação atual dos projetos e horas do período escolhido."
        primaryAction={
          <Button asChild size="sm">
            <Link to="/projects">
              <FolderKanban className="mr-2 h-4 w-4" />
              Ir para Projetos
            </Link>
          </Button>
        }
        secondaryActions={
          <div className="flex flex-wrap items-center gap-2">
            <IsoDateRangePicker
              size="sm"
              align="end"
              ariaLabel="Período das horas"
              from={from}
              to={to}
              defaultPreset="thisMonth"
              onChange={(r) => void navigate({ search: { from: r.from, to: r.to } })}
              onClear={() => void navigate({ search: {} })}
            />
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
          </div>
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
              label="Projetos ativos agora"
              value={data.activeCount}
              hint={`Situação atual, não depende do período · ${data.projectsTotal} no total`}
              icon={FolderKanban}
              tone="positive"
            />
            <MetricCard
              label="Conclusão de tarefas"
              value={
                data.activeTaskCompletion === null
                  ? "Sem base"
                  : `${Math.round(data.activeTaskCompletion * 100)}%`
              }
              hint={`Tarefas concluídas dos ativos com tarefas (${data.activeWithTaskBase} de ${data.activeCount})`}
              icon={CheckCircle2}
            />
            <MetricCard
              label="Tarefas em aberto"
              value={data.openTasks.toLocaleString("pt-BR")}
              hint={`${data.overdueTasks.toLocaleString("pt-BR")} atrasadas em ${date(data.today)}`}
              icon={AlertTriangle}
              tone={data.overdueTasks > 0 ? "warning" : "neutral"}
            />
            <MetricCard
              label="Horas no período"
              value={formatHours(data.period.seconds)}
              hint={`${periodLabel} · ${data.period.rows.toLocaleString("pt-BR")} apontamentos`}
              icon={Clock3}
            />
          </div>

          <CoverageStrip data={data} reviewSearch={reviewSearch} />

          <div className="grid gap-4 lg:grid-cols-2">
            <OverviewPanel
              title="Projetos em andamento"
              description={`${data.inProgressTotal} projetos com situação Ativo; os 8 mais recentes.`}
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
                  title="Nenhum projeto ativo"
                  description="Projetos com situação Ativo aparecem aqui."
                />
              ) : (
                <OverviewList>
                  {data.projects.map((row) => (
                    <OverviewListItem key={row.id}>
                      <div className="min-w-0 flex-1">
                        <Link
                          to="/projects/$id"
                          params={{ id: row.id }}
                          className="block truncate text-sm font-medium text-text-primary hover:underline"
                        >
                          {row.name}
                        </Link>
                        {row.progressPct === null ? (
                          <p className="mt-1 text-xs text-text-tertiary">
                            Sem base de progresso (nenhuma tarefa)
                          </p>
                        ) : (
                          <div
                            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-sunken"
                            role="progressbar"
                            aria-label={`Tarefas concluídas de ${row.name}`}
                            aria-valuenow={Math.round(row.progressPct)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          >
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.max(0, Math.min(100, row.progressPct))}%` }}
                            />
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-medium tabular-nums text-text-primary">
                          {row.progressPct === null
                            ? "—"
                            : `${Math.round(row.progressPct)}% · ${row.tasksDone}/${row.tasksTotal}`}
                        </p>
                        <p className="text-xs text-text-tertiary">
                          {date(row.dueAt)} · {formatHours(row.periodSeconds)}
                        </p>
                      </div>
                    </OverviewListItem>
                  ))}
                </OverviewList>
              )}
            </OverviewPanel>
            <OverviewPanel
              title="Precisam de atenção"
              description={`${data.attentionTotal} projetos pausados ou com prazo ultrapassado.`}
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
                      <div className="min-w-0 flex-1">
                        <Link
                          to="/projects/$id"
                          params={{ id: row.id }}
                          className="block truncate text-sm font-medium text-text-primary hover:underline"
                        >
                          {row.name}
                        </Link>
                        <p className="text-xs text-text-tertiary">
                          {PROJECT_STATUS_LABEL[row.status] ?? row.status}
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
            description={`Apontamentos de ${periodLabel}. Importado bloqueado não é aprovação nem faturamento.`}
            action={
              data.coverage.canOpenCenter ? (
                <Link
                  to="/projects/settings/imports/reconciliation"
                  search={{ tab: "breakdown", from, to }}
                  className="text-xs text-text-secondary hover:text-text-primary"
                >
                  Conferir registros →
                </Link>
              ) : undefined
            }
          >
            {data.period.byStatus.length === 0 ? (
              <EmptyState
                compact
                icon={Clock3}
                title="Sem horas registradas"
                description="Não há apontamentos visíveis no período escolhido."
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {data.period.byStatus.map((row) => (
                  <DistributionBar
                    key={row.status}
                    label={`${DASHBOARD_HOURS_STATUS_LABEL[row.status] ?? row.status} · ${formatHours(row.seconds)}`}
                    value={row.rows}
                    total={Math.max(1, data.period.rows)}
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

function CoverageStrip({
  data,
  reviewSearch,
}: {
  data: NonNullable<Awaited<ReturnType<typeof getProjectDashboard>>>;
  reviewSearch: { tab: "issues"; from: string; to: string };
}) {
  const validated = data.period.seconds - data.period.secondsInReview;
  return (
    <section
      aria-label="Cobertura e pendências das horas"
      className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-2 p-4 shadow-xs md:flex-row md:items-center md:justify-between"
    >
      <dl className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-text-tertiary">Total bruto no período</dt>
          <dd className="text-sm font-medium tabular-nums text-text-primary">
            {formatHours(data.period.seconds)} · {data.period.rows.toLocaleString("pt-BR")}{" "}
            registros
          </dd>
        </div>
        <div>
          <dt className="text-xs text-text-tertiary">Sem alerta aberto</dt>
          <dd className="text-sm font-medium tabular-nums text-text-primary">
            {data.coverage.issuesVisible
              ? formatHours(validated)
              : "Não disponível para seu acesso"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-text-tertiary">Em revisão (alerta aberto)</dt>
          <dd className="text-sm font-medium tabular-nums text-text-primary">
            {data.coverage.issuesVisible
              ? `${formatHours(data.period.secondsInReview)} · ${data.period.rowsInReview.toLocaleString("pt-BR")} registros`
              : "Não disponível para seu acesso"}
          </dd>
        </div>
      </dl>
      <div className="flex flex-col items-start gap-1 md:items-end">
        {data.coverage.issuesVisible ? (
          <p className="flex items-center gap-1.5 text-xs text-text-secondary">
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
            {data.coverage.openIssues.toLocaleString("pt-BR")} pendências abertas · fila conferida
            em {dateTime(data.coverage.lastRefreshAt)}
          </p>
        ) : null}
        <p className="text-xs text-text-tertiary">
          Dados atualizados em {dateTime(data.generatedAt)}
        </p>
        {data.coverage.canOpenCenter ? (
          <Link
            to="/projects/settings/imports/reconciliation"
            search={reviewSearch}
            className="text-xs font-medium text-primary hover:underline"
          >
            Abrir pendências do período →
          </Link>
        ) : null}
      </div>
    </section>
  );
}
