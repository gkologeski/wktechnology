import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectDashboardData, ProjectDashboardItem } from "./dashboard.types";

type ProjectRow = {
  id: string;
  name: string;
  status: string;
  progress: number | null;
  due_at: string | null;
};
type TaskRow = { status: string; due_at: string | null };
type TimeRow = { status: string; duration_minutes: number | null; hours: number | null };

function projectItem(row: ProjectRow): ProjectDashboardItem {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    progress: Number(row.progress ?? 0),
    dueAt: row.due_at,
  };
}

export async function loadProjectDashboard(
  supabase: SupabaseClient,
  from: string,
  to: string,
): Promise<ProjectDashboardData> {
  const [projectsResult, tasksResult, timeResult] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, status, progress, due_at")
      .order("updated_at", { ascending: false })
      .limit(1000),
    supabase.from("project_tasks").select("status, due_at").limit(5000),
    supabase
      .from("project_time_entries")
      .select("status, duration_minutes, hours")
      .gte("entry_date", from)
      .lte("entry_date", to)
      .limit(5000),
  ]);
  const firstError = projectsResult.error ?? tasksResult.error ?? timeResult.error;
  if (firstError) throw new Error(`Não foi possível carregar os projetos: ${firstError.message}`);

  const projects = (projectsResult.data ?? []) as ProjectRow[];
  const tasks = (tasksResult.data ?? []) as TaskRow[];
  const times = (timeResult.data ?? []) as TimeRow[];
  const active = projects.filter((row) => row.status === "active");
  const today = new Date().toISOString().slice(0, 10);
  const openTasks = tasks.filter((row) => row.status !== "done");
  const byStatus = new Map<string, number>();
  let trackedMinutes = 0;
  for (const row of times) {
    const minutes = Number(row.duration_minutes ?? 0) || Number(row.hours ?? 0) * 60;
    trackedMinutes += minutes;
    byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + minutes);
  }
  const attention = projects
    .filter(
      (row) =>
        row.status === "on_hold" ||
        ((row.status === "active" || row.status === "planning") &&
          Boolean(row.due_at) &&
          String(row.due_at).slice(0, 10) < today),
    )
    .sort((a, b) => String(a.due_at).localeCompare(String(b.due_at)));

  return {
    activeCount: active.length,
    averageProgress:
      active.length > 0
        ? active.reduce((sum, row) => sum + Number(row.progress ?? 0), 0) / active.length
        : 0,
    openTasks: openTasks.length,
    overdueTasks: openTasks.filter(
      (row) => Boolean(row.due_at) && String(row.due_at).slice(0, 10) < today,
    ).length,
    trackedMinutes,
    statusMinutes: Array.from(byStatus, ([status, minutes]) => ({ status, minutes })).sort(
      (a, b) => b.minutes - a.minutes,
    ),
    projects: projects.slice(0, 8).map(projectItem),
    attention: attention.slice(0, 8).map(projectItem),
  };
}
