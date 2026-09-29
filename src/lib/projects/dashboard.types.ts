export type ProjectDashboardItem = {
  id: string;
  name: string;
  status: string;
  progress: number;
  dueAt: string | null;
};

export type ProjectDashboardData = {
  activeCount: number;
  averageProgress: number;
  openTasks: number;
  overdueTasks: number;
  trackedMinutes: number;
  statusMinutes: Array<{ status: string; minutes: number }>;
  projects: ProjectDashboardItem[];
  attention: ProjectDashboardItem[];
};
