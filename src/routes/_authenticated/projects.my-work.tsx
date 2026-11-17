import { HrScreenAccess } from "@/components/hr-access";
// Sprint E — Fase 4.4: Meu trabalho.
// Tela pessoal do TechProjects: tarefas de hoje/semana, timer ativo,
// tarefas atrasadas. Reúne dados existentes de `project_tasks` e do timer.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CalendarDays, ListTodo, Timer as TimerIcon } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listAllProjectTasks } from "@/lib/projects.functions";
import { getTimesheetOverview } from "@/lib/projects/time-workflow.functions";
import { useCurrentUserId } from "@/hooks/use-current-user-id";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/projects/my-work")({
  head: () => ({
    meta: [
      { title: "Meu trabalho — TechProjects" },
      { name: "description", content: "Tarefas do dia, timer ativo e agenda semanal." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <HrScreenAccess resources={["techprojects.my_work"]}>
      <MyWorkPage />
    </HrScreenAccess>
  ),
});

function toIsoDate(d: Date): string {
  return d.toLocaleDateString("sv-SE");
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
  const minutes = Math.round(h * 60);
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  return `${hh}h${String(mm).padStart(2, "0")}`;
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
  const overviewFn = useServerFn(getTimesheetOverview);
  const me = useCurrentUserId();

  const weekStart = useMemo(() => startOfWeek(new Date()), []);
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [weekStart]);
  const todayIso = toIsoDate(new Date());

  const tasksQuery = useInfiniteQuery({
    queryKey: ["my-work", "tasks", me],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      tasksFn({ data: { mineOnly: true, offset: pageParam, limit: 500 } }),
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === 500 ? pages.length * 500 : undefined,
    enabled: !!me,
  });
  const weekQuery = useQuery({
    queryKey: ["my-work", "timesheet", me, toIsoDate(weekStart), toIsoDate(weekEnd)],
    queryFn: () =>
      overviewFn({ data: { from: toIsoDate(weekStart), to: toIsoDate(weekEnd), userId: me } }),
    enabled: !!me,
  });

  const allTasks = (tasksQuery.data?.pages.flat() ?? []) as Task[];
  const openTasks = allTasks.filter((t) => t.status !== "done");
  const today = openTasks.filter((t) => t.due_at && t.due_at.slice(0, 10) === todayIso);
  const overdue = openTasks.filter((t) => t.due_at && t.due_at.slice(0, 10) < todayIso);
  const weekAhead = openTasks.filter((t) => {
    if (!t.due_at) return false;
    const d = t.due_at.slice(0, 10);
    const end = new Date();
    end.setDate(end.getDate() + 7);
    return d > todayIso && d <= toIsoDate(end);
  });

  const weekTotal = weekQuery.data?.totals.registered;
  const weekApproved = weekQuery.data?.totals.approved;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meu trabalho"
        description="Seu foco do dia: tarefas atribuídas, timer e horas da semana."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <MetricCard
          icon={<TimerIcon className="h-4 w-4" />}
          label="Registro de horas"
          value="Manual"
          hint="Use Minhas Horas para apontar. O cronômetro está indisponível."
        />
        <MetricCard
          icon={<ListTodo className="h-4 w-4" />}
          label="Hoje"
          value={
            tasksQuery.isError
              ? "Indisponível"
              : `${today.length}${tasksQuery.hasNextPage ? "+" : ""}`
          }
          hint="tarefas com vencimento hoje"
        />
        <MetricCard
          icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
          label="Atrasadas"
          value={
            tasksQuery.isError
              ? "Indisponível"
              : `${overdue.length}${tasksQuery.hasNextPage ? "+" : ""}`
          }
          hint="tarefas em aberto vencidas"
        />
        <MetricCard
          icon={<CalendarDays className="h-4 w-4" />}
          label="Horas na semana"
          value={
            weekQuery.isError
              ? "Indisponível"
              : weekTotal === undefined
                ? "…"
                : fmtHours(weekTotal / 3600)
          }
          hint={
            weekApproved === undefined
              ? "Aguardando consulta das horas"
              : `${fmtHours(weekApproved / 3600)} aprovadas · total completo da semana`
          }
        />
      </div>

      {(tasksQuery.isError || weekQuery.isError) && (
        <div role="alert" className="rounded-md border p-3 text-sm">
          Não foi possível consultar {tasksQuery.isError ? "as tarefas" : "as horas"}. Ausência de
          resposta não significa zero.
          <Button
            variant="outline"
            onClick={() => {
              void tasksQuery.refetch();
              void weekQuery.refetch();
            }}
          >
            Tentar novamente
          </Button>
        </div>
      )}
      {tasksQuery.hasNextPage && (
        <div role="status" className="text-sm">
          Indicadores das {allTasks.length} tarefas carregadas. Há mais resultados.
          <Button
            variant="outline"
            disabled={tasksQuery.isFetchingNextPage}
            onClick={() => void tasksQuery.fetchNextPage()}
          >
            Carregar mais tarefas
          </Button>
        </div>
      )}
      {!tasksQuery.isError && (
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
      )}
      <Button asChild variant="outline">
        <Link to="/projects/my-hours">Apontar minhas horas</Link>
      </Button>
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
              to="/projects/tasks"
              search={{ taskId: t.id }}
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
