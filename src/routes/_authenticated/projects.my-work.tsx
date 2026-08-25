// Sprint E — Fase 4.4: My Work.
// Tela pessoal do TechProjects: tarefas de hoje/semana, timer ativo,
// tarefas atrasadas. Reúne dados existentes de `project_tasks` e do timer.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CalendarDays, ListTodo, Timer as TimerIcon } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listAllProjectTasks } from "@/lib/projects.functions";
import { getRunningTimer, listTimesheet } from "@/lib/project-timer.functions";

export const Route = createFileRoute("/_authenticated/projects/my-work")({
  head: () => ({
    meta: [
      { title: "My Work — TechProjects" },
      { name: "description", content: "Tarefas do dia, timer ativo e agenda semanal." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyWorkPage,
});

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
function fmtHours(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}h${String(mm).padStart(2, "0")}`;
}
function fmtElapsed(startedAt: string | null | undefined): string {
  if (!startedAt) return "0h00";
  const diff = (Date.now() - new Date(startedAt).getTime()) / 3_600_000;
  return fmtHours(Math.max(0, diff));
}

type Task = {
  id: string;
  title: string;
  status: string;
  due_at: string | null;
  priority?: string | null;
  projects?: { id: string; name: string } | null;
};

function MyWorkPage() {
  const tasksFn = useServerFn(listAllProjectTasks);
  const timerFn = useServerFn(getRunningTimer);
  const timesheetFn = useServerFn(listTimesheet);

  const weekStart = useMemo(() => startOfWeek(new Date()), []);
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [weekStart]);
  const todayIso = toIsoDate(new Date());

  const tasksQuery = useQuery({
    queryKey: ["my-work", "tasks"],
    queryFn: () => tasksFn({ data: { mineOnly: true } }),
  });
  const timerQuery = useQuery({
    queryKey: ["timer", "running"],
    queryFn: () => timerFn(),
    refetchInterval: 30_000,
  });
  const weekQuery = useQuery({
    queryKey: ["my-work", "timesheet", toIsoDate(weekStart), toIsoDate(weekEnd)],
    queryFn: () => timesheetFn({ data: { from: toIsoDate(weekStart), to: toIsoDate(weekEnd) } }),
  });

  const allTasks = (tasksQuery.data ?? []) as Task[];
  const openTasks = allTasks.filter((t) => t.status !== "done");
  const today = openTasks.filter((t) => t.due_at && t.due_at.slice(0, 10) === todayIso);
  const overdue = openTasks.filter((t) => t.due_at && t.due_at.slice(0, 10) < todayIso);
  const weekAhead = openTasks.filter((t) => {
    if (!t.due_at) return false;
    const d = t.due_at.slice(0, 10);
    return d > todayIso && d <= toIsoDate(weekEnd);
  });

  const running = timerQuery.data as
    | (Record<string, unknown> & {
        started_at?: string | null;
        project_tasks?: { title?: string } | null;
        projects?: { name?: string } | null;
      })
    | null;

  const weekEntries = (weekQuery.data ?? []) as Array<{
    hours: number | null;
    billable: boolean;
    approved_at: string | null;
  }>;
  const weekTotals = useMemo(() => {
    let total = 0;
    let billable = 0;
    let approved = 0;
    for (const e of weekEntries) {
      const h = e.hours ?? 0;
      total += h;
      if (e.billable) billable += h;
      if (e.approved_at) approved += h;
    }
    return { total, billable, approved };
  }, [weekEntries]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Work"
        description="Seu foco do dia: tarefas atribuídas, timer e horas da semana."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <MetricCard
          icon={<TimerIcon className="h-4 w-4" />}
          label="Timer ativo"
          value={running ? fmtElapsed(running.started_at) : "—"}
          hint={
            running
              ? (running.project_tasks?.title ?? running.projects?.name ?? "Sem tarefa")
              : "Nenhum timer em execução"
          }
        />
        <MetricCard
          icon={<ListTodo className="h-4 w-4" />}
          label="Hoje"
          value={String(today.length)}
          hint="tarefas com vencimento hoje"
        />
        <MetricCard
          icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
          label="Atrasadas"
          value={String(overdue.length)}
          hint="tarefas em aberto vencidas"
        />
        <MetricCard
          icon={<CalendarDays className="h-4 w-4" />}
          label="Horas na semana"
          value={fmtHours(weekTotals.total)}
          hint={`${fmtHours(weekTotals.billable)} billable · ${fmtHours(weekTotals.approved)} aprovadas`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TaskListCard
          title="Hoje"
          tasks={today}
          loading={tasksQuery.isLoading}
          empty="Nada vence hoje. Bom foco."
        />
        <TaskListCard
          title="Atrasadas"
          tasks={overdue}
          loading={tasksQuery.isLoading}
          empty="Nenhuma tarefa atrasada."
          highlight
        />
        <TaskListCard
          title="Próximos 7 dias"
          tasks={weekAhead}
          loading={tasksQuery.isLoading}
          empty="Semana livre à frente."
        />
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums truncate">{value}</div>
        {hint ? <div className="text-xs text-muted-foreground mt-1 truncate">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}

function TaskListCard({
  title,
  tasks,
  loading,
  empty,
  highlight,
}: {
  title: string;
  tasks: Task[];
  loading: boolean;
  empty: string;
  highlight?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>{title}</span>
          <Badge variant={highlight ? "destructive" : "secondary"}>{tasks.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </>
        ) : tasks.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">{empty}</div>
        ) : (
          tasks.map((t) => (
            <Link
              key={t.id}
              to="/projects/$id"
              params={{ id: t.projects?.id ?? "" }}
              className="block rounded-md border p-2 hover:bg-accent transition-colors"
            >
              <div className="text-sm font-medium truncate">{t.title}</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <span className="truncate">{t.projects?.name ?? "—"}</span>
                {t.due_at ? (
                  <span className="tabular-nums">
                    · {new Date(t.due_at).toLocaleDateString("pt-BR")}
                  </span>
                ) : null}
                {t.priority ? (
                  <Badge variant="outline" className="text-[10px] py-0 h-4">
                    {t.priority}
                  </Badge>
                ) : null}
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
