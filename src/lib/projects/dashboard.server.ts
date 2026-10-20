import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { ProjectDashboardData } from "./dashboard.types";

type Raw = {
  from: string;
  to: string;
  tz: string;
  today: string;
  generated_at: string;
  projects: { total: number; by_status: Record<string, number> };
  in_progress_total: number;
  in_progress: Array<{
    id: string;
    name: string;
    status: string;
    dueAt: string | null;
    tasksTotal: number;
    tasksDone: number;
    periodSeconds: number;
  }>;
  active_with_task_base: number;
  active_task_completion: number | null;
  attention_total: number;
  attention: Array<{ id: string; name: string; status: string; dueAt: string | null }>;
  tasks: { open: number; overdue: number };
  period: {
    rows: number;
    seconds: number;
    rows_in_review: number;
    seconds_in_review: number;
    by_status: Array<{ status: string; rows: number; seconds: number }>;
  };
  coverage: {
    issues_visible: boolean;
    can_open_center: boolean;
    open_issues: number;
    last_refresh_at: string | null;
  };
};

/**
 * Agregação exata no banco (sem limites de linhas), com o mesmo escopo visível das
 * listas: a função roda como o usuário (RLS, negações e workspace ativo).
 */
export async function loadProjectDashboard(
  supabase: SupabaseClient<Database>,
  from: string,
  to: string,
  tz: string,
): Promise<ProjectDashboardData> {
  const { data, error } = await supabase.rpc("project_dashboard_summary", {
    p_from: from,
    p_to: to,
    p_tz: tz,
  });
  if (error) throw new Error(`Não foi possível carregar os projetos: ${error.message}`);
  const r = data as unknown as Raw;
  return {
    from: r.from,
    to: r.to,
    tz: r.tz,
    today: r.today,
    generatedAt: r.generated_at,
    activeCount: Number(r.projects.by_status.active ?? 0),
    projectsTotal: Number(r.projects.total),
    activeWithTaskBase: Number(r.active_with_task_base),
    activeTaskCompletion:
      r.active_task_completion === null ? null : Number(r.active_task_completion),
    openTasks: Number(r.tasks.open),
    overdueTasks: Number(r.tasks.overdue),
    period: {
      rows: Number(r.period.rows),
      seconds: Number(r.period.seconds),
      rowsInReview: Number(r.period.rows_in_review),
      secondsInReview: Number(r.period.seconds_in_review),
      byStatus: r.period.by_status.map((s) => ({
        status: s.status,
        rows: Number(s.rows),
        seconds: Number(s.seconds),
      })),
    },
    coverage: {
      issuesVisible: Boolean(r.coverage.issues_visible),
      canOpenCenter: Boolean(r.coverage.can_open_center),
      openIssues: Number(r.coverage.open_issues),
      lastRefreshAt: r.coverage.last_refresh_at,
    },
    inProgressTotal: Number(r.in_progress_total),
    projects: r.in_progress.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      dueAt: p.dueAt,
      tasksTotal: Number(p.tasksTotal),
      tasksDone: Number(p.tasksDone),
      progressPct:
        Number(p.tasksTotal) > 0 ? (Number(p.tasksDone) / Number(p.tasksTotal)) * 100 : null,
      periodSeconds: Number(p.periodSeconds),
    })),
    attentionTotal: Number(r.attention_total),
    attention: r.attention,
  };
}
