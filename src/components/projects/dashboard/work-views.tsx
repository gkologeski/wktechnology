// Visões "Meu trabalho" e "Equipe e entrega" (apresentação pura).
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FolderKanban,
  Gauge,
  Hourglass,
  Send,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/techhire/ui";
import {
  OverviewList,
  OverviewListItem,
  OverviewPanel,
} from "@/components/dashboard/overview-panel";
import type { DashSummary } from "@/lib/projects/dashboard-views.types";
import { formatHours } from "@/lib/projects/reconciliation-labels";
import { Grid, HoursMetric, Metric, Notice, int, num, type ViewCtx } from "./dash-view-parts";

const NO_CALENDAR =
  "Feriados e ausências não são descontados: o TechPeople ainda não tem esse cadastro. A capacidade mostrada é a jornada contratada.";

function CapacityValue({ v, known }: { v: number | null | undefined; known: number }) {
  if (known === 0 || v === null || v === undefined) return <>Sem jornada</>;
  return <>{formatHours(Number(v))}</>;
}

export function MeView({ data, ctx }: { data: DashSummary; ctx: ViewCtx }) {
  const e = data.entries;
  const p = data.people?.all;
  const known = Number(p?.known ?? 0);
  const allocations = data.my_allocations ?? [];
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link to="/projects/my-hours">
            <Clock3 className="mr-2 h-4 w-4" aria-hidden />
            Apontar horas
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/projects/my-work">Meu trabalho (tarefas)</Link>
        </Button>
        {Number(data.pending_approvals ?? 0) > 0 ? (
          <Button asChild size="sm" variant="outline">
            <Link to="/projects/hours-review">
              Revisar horas ({int(Number(data.pending_approvals))})
            </Link>
          </Button>
        ) : null}
      </div>
      <Grid>
        <HoursMetric ctx={ctx} map={e} prev={data.entries_prev} metric="total" icon={Clock3} />
        <HoursMetric ctx={ctx} map={e} metric="awaiting_review" icon={Send} />
        <HoursMetric ctx={ctx} map={e} metric="validated" icon={CheckCircle2} tone="positive" />
        <HoursMetric
          ctx={ctx}
          map={e}
          metric="pending_mine"
          icon={Hourglass}
          tone={num(e, "pending_mine") > 0 ? "warning" : "neutral"}
        />
      </Grid>
      <Grid>
        <Metric
          ctx={ctx}
          dataset="people"
          metric="all"
          value={<CapacityValue v={p?.contracted} known={known} />}
          hint={
            known === 0
              ? "Jornada não cadastrada no TechPeople: nenhuma jornada padrão é presumida"
              : `Alocado ${formatHours(Number(p?.allocated_total ?? 0))} · registrado ${formatHours(Number(p?.registered ?? 0))}`
          }
          icon={Gauge}
          missing={NO_CALENDAR}
        />
        <Metric
          ctx={ctx}
          dataset="people"
          metric="gap"
          value={known === 0 ? "Sem base" : formatHours(Number(data.people?.gap?.gap ?? 0))}
          hint="Alocado até hoje menos o registrado"
          icon={AlertTriangle}
          tone={Number(data.people?.gap?.n ?? 0) > 0 ? "warning" : "neutral"}
          missing={NO_CALENDAR}
        />
        <Metric
          ctx={ctx}
          dataset="tasks"
          metric="overdue"
          value={int(num(data.tasks, "overdue"))}
          hint={`${int(num(data.tasks, "open"))} tarefas abertas`}
          icon={AlertTriangle}
          tone={num(data.tasks, "overdue") > 0 ? "warning" : "neutral"}
          current
        />
        <Metric
          ctx={ctx}
          dataset="milestones"
          metric="due_soon"
          value={int(num(data.milestones, "due_soon"))}
          hint={`${int(num(data.tasks, "due_soon"))} tarefas também vencem em 14 dias`}
          icon={CalendarClock}
          current
        />
      </Grid>
      <OverviewPanel
        title="Minhas alocações vigentes"
        description="Alocações do TechPeople no período. Projeto sem acesso aparece sem nome."
      >
        {allocations.length === 0 ? (
          <EmptyState
            compact
            icon={Users}
            title="Nenhuma alocação no período"
            description="Quando você for alocado em um projeto, ele aparece aqui."
          />
        ) : (
          <OverviewList>
            {allocations.map((a) => (
              <OverviewListItem key={a.id}>
                <div className="min-w-0 flex-1">
                  {a.project_id && a.project_name ? (
                    <Link
                      to="/projects/$id"
                      params={{ id: a.project_id }}
                      className="block truncate text-sm font-medium text-text-primary hover:underline"
                    >
                      {a.project_name}
                    </Link>
                  ) : (
                    <p className="text-sm text-text-tertiary">
                      {a.project_id ? "Projeto sem acesso" : "Alocação sem projeto"}
                    </p>
                  )}
                  <p className="text-xs text-text-tertiary">{a.role_title ?? "Sem função"}</p>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-text-secondary">
                  {a.allocation_pct !== null
                    ? `${Number(a.allocation_pct).toLocaleString("pt-BR")}%`
                    : a.hours_per_week !== null
                      ? `${Number(a.hours_per_week).toLocaleString("pt-BR")} h/sem`
                      : "Sem carga definida"}
                </span>
              </OverviewListItem>
            ))}
          </OverviewList>
        )}
      </OverviewPanel>
    </div>
  );
}

export function TeamView({ data, ctx }: { data: DashSummary; ctx: ViewCtx }) {
  const e = data.entries;
  const all = data.people?.all;
  const known = Number(all?.known ?? 0);
  const total = Number(all?.n ?? 0);
  return (
    <div className="flex flex-col gap-6">
      <Notice>
        {data.scope.team_scope === "workspace"
          ? "Escopo: todos os projetos do workspace (visão completa de horas)."
          : `Escopo: ${int(data.scope.led_projects)} projeto(s) que você lidera (responsável, gestor ou aprovador).`}{" "}
        {NO_CALENDAR}
      </Notice>
      <Grid>
        <Metric
          ctx={ctx}
          dataset="people"
          metric="all"
          value={<CapacityValue v={all?.contracted} known={known} />}
          hint={`${int(known)} de ${int(total)} pessoas com jornada conhecida (somente elas entram na soma)`}
          icon={Gauge}
          missing={
            known < total
              ? `${int(total - known)} pessoa(s) sem jornada: capacidade parcial.`
              : NO_CALENDAR
          }
        />
        <Metric
          ctx={ctx}
          dataset="people"
          metric="overbooked"
          value={known === 0 ? "Sem base" : int(Number(data.people?.overbooked?.n ?? 0))}
          hint={
            known === 0
              ? "Sem jornada cadastrada: sobrealocação não calculada"
              : "Pessoas com dias acima da jornada (todas as alocações, sem expor projetos ocultos)"
          }
          icon={Users}
          tone={Number(data.people?.overbooked?.n ?? 0) > 0 ? "warning" : "neutral"}
        />
        <HoursMetric ctx={ctx} map={e} metric="awaiting_review" icon={Send} />
        <Metric
          ctx={ctx}
          dataset="people"
          metric="gap"
          value={known === 0 ? "Sem base" : int(Number(data.people?.gap?.n ?? 0))}
          hint={
            known === 0
              ? "Sem jornada cadastrada: lacuna não calculada"
              : `Lacuna total ${formatHours(Number(data.people?.gap?.gap ?? 0))}`
          }
          icon={AlertTriangle}
          tone={Number(data.people?.gap?.n ?? 0) > 0 ? "warning" : "neutral"}
        />
      </Grid>
      <Grid>
        <Metric
          ctx={ctx}
          dataset="projects"
          metric="active_now"
          value={int(num(data.projects, "active_now"))}
          hint={`${int(num(data.projects, "open"))} em andamento`}
          icon={FolderKanban}
          current
        />
        <Metric
          ctx={ctx}
          dataset="milestones"
          metric="overdue"
          value={int(num(data.milestones, "overdue"))}
          hint={`${int(num(data.projects, "overdue"))} projetos com prazo vencido`}
          icon={CalendarClock}
          tone={num(data.milestones, "overdue") > 0 ? "negative" : "neutral"}
          current
        />
        <Metric
          ctx={ctx}
          dataset="projects"
          metric="no_approver"
          value={int(num(data.projects, "no_approver"))}
          hint={`${int(num(data.projects, "no_owner"))} sem responsável operacional`}
          icon={AlertTriangle}
          tone={num(data.projects, "no_approver") > 0 ? "warning" : "neutral"}
          current
        />
        <Metric
          ctx={ctx}
          dataset="tasks"
          metric="no_estimate"
          value={int(num(data.tasks, "no_estimate"))}
          hint={`${int(num(data.tasks, "overdue"))} tarefas atrasadas`}
          icon={Hourglass}
          current
        />
      </Grid>
      <Grid>
        <Metric
          ctx={ctx}
          dataset="forecast"
          metric="forecast"
          value={int(num(data.forecast, "forecast"))}
          hint={`de ${int(num(data.forecast, "open"))} projetos em andamento`}
          icon={CalendarClock}
          current
        />
        <Metric
          ctx={ctx}
          dataset="forecast"
          metric="late"
          value={int(num(data.forecast, "late"))}
          hint="Data provável depois do prazo"
          icon={AlertTriangle}
          tone={num(data.forecast, "late") > 0 ? "negative" : "neutral"}
          current
        />
        <Metric
          ctx={ctx}
          dataset="forecast"
          metric="no_base"
          value={int(num(data.forecast, "no_base"))}
          hint="Sem estimativa ou ritmo: nenhuma data é inventada"
          icon={Hourglass}
          current
        />
        <HoursMetric ctx={ctx} map={e} prev={data.entries_prev} metric="total" icon={Clock3} />
      </Grid>
    </div>
  );
}
