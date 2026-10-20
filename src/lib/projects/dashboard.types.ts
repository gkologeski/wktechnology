export type ProjectDashboardItem = {
  id: string;
  name: string;
  status: string;
  dueAt: string | null;
  /** Base de progresso: tarefas concluídas / total. Sem tarefas → sem base (null). */
  tasksTotal: number;
  tasksDone: number;
  progressPct: number | null;
  periodSeconds: number;
};

export type ProjectDashboardAttention = {
  id: string;
  name: string;
  status: string;
  dueAt: string | null;
};

export type ProjectDashboardData = {
  from: string;
  to: string;
  tz: string;
  today: string;
  generatedAt: string;
  /** Situação atual, independente do período. */
  activeCount: number;
  projectsTotal: number;
  activeWithTaskBase: number;
  /** Conclusão de tarefas dos ativos com base; null quando nenhum tem tarefas. */
  activeTaskCompletion: number | null;
  openTasks: number;
  overdueTasks: number;
  /** Horas do período, por segundos exatos. */
  period: {
    rows: number;
    seconds: number;
    rowsInReview: number;
    secondsInReview: number;
    byStatus: Array<{ status: string; rows: number; seconds: number }>;
  };
  coverage: {
    issuesVisible: boolean;
    canOpenCenter: boolean;
    openIssues: number;
    lastRefreshAt: string | null;
  };
  inProgressTotal: number;
  projects: ProjectDashboardItem[];
  attentionTotal: number;
  attention: ProjectDashboardAttention[];
};
