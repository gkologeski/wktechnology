// Visão geral (layout produtivo anterior, preservado sem mudança de conteúdo).
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Clock3, FolderKanban } from "lucide-react";
import { EmptyState, MetricCard } from "@/components/techhire/ui";
import {
  DistributionBar,
  OverviewList,
  OverviewListItem,
  OverviewPanel,
} from "@/components/dashboard/overview-panel";
import { CoverageStrip } from "@/components/projects/dashboard/coverage-strip";
import type { ProjectDashboardData } from "@/lib/projects/dashboard.types";
import {
  DASHBOARD_HOURS_STATUS_LABEL,
  PROJECT_STATUS_LABEL,
  formatHours,
} from "@/lib/projects/reconciliation-labels";

const date = (value: string | null) =>
  value
    ? new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" })
    : "Sem prazo";

export function OverviewView({
  data,
  from,
  to,
}: {
  data: ProjectDashboardData;
  from: string;
  to: string;
}) {
  const periodLabel = `${date(from)} a ${date(to)}`;
  const reviewSearch = { tab: "issues" as const, from, to };
  return (
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
            <Link to="/projects" className="text-xs text-text-secondary hover:text-text-primary">
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
  );
}
