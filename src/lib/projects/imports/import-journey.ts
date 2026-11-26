/** Shared, credential-free contract for the TechProjects import centre. */
export const IMPORT_PROVIDERS = ["clockify", "jibble", "clickup"] as const;
export type ImportProvider = (typeof IMPORT_PROVIDERS)[number];
export const IMPORT_ENTITY_LABELS: Record<string, string> = {
  workspace: "Organização",
  organization: "Organização",
  user: "Pessoas",
  person: "Pessoas",
  group: "Grupos",
  position: "Cargos",
  client: "Clientes",
  project: "Projetos",
  task: "Tarefas",
  tag: "Etiquetas",
  custom_field: "Campos personalizados",
  approval_request: "Pedidos de aprovação",
  time_entry: "Lançamentos de horas / ponto",
  running_time_entry: "Cronômetros abertos",
  expense: "Despesas",
  invoice: "Faturas",
  holiday: "Feriados",
  time_off_policy: "Políticas de ausência",
  time_off_request: "Pedidos de ausência",
  time_off: "Ausências",
  attendance: "Relatório de presença",
  report_summary: "Relatório de horas",
  activity: "Atividades",
  location: "Locais",
  schedule: "Jornadas",
  pay_period_definition: "Regras de competência",
  pay_period: "Competências",
  hour_entry: "Ajustes e totais de horas",
  timesheet_day: "Timesheets diários",
  timesheet_summary: "Resumos de timesheet",
  calendar: "Calendários",
  calendar_day: "Dias do calendário",
  screenshot: "Capturas de tela",
  screenshot_content: "Arquivos de capturas",
  inventory: "Inventário de cobertura",
  space: "Espaços",
  folder: "Pastas",
  list: "Listas",
  comment: "Comentários",
  attachment: "Anexos",
  document: "Documentos",
  document_page: "Páginas de documentos",
  hierarchy: "Estrutura",
  docs_format: "Formato de documentos",
  deleted_tasks: "Tarefas excluídas",
};
export type JourneyCoverage = {
  entity: string;
  label: string;
  status: "available" | "unavailable" | "unknown" | "not_collected";
  count: number | null;
  reason?: string;
};
export type JourneyRun = {
  id: string;
  provider: ImportProvider;
  sourceName: string;
  status: "running" | "paused" | "failed" | "complete" | "partial";
  phase: string;
  received: number;
  ready: number;
  pending: number;
  coverageComplete: boolean;
  sourceLimited?: boolean;
  error?: string | null;
  createdAt: string;
  finishedAt?: string | null;
  resumable: boolean;
};
export type JourneySource = {
  provider: ImportProvider;
  label: string;
  canView: boolean;
  canManage: boolean;
  configured: boolean;
  ready: boolean;
  sourceId: string | null;
  sourceName: string | null;
  connectionStatus: string;
  error: string | null;
  coverage: JourneyCoverage[];
  latestRun?: JourneyRun;
};
export type JourneyStatus = {
  workspaceId: string;
  legacyPending: boolean;
  sources: JourneySource[];
  runs: JourneyRun[];
  summary: { received: number; ready: number; pending: number; unclassified: number };
};
export type JourneyRecord = {
  id: string;
  provider: ImportProvider;
  entity: string;
  label: string;
  externalId: string;
  sourceName: string;
  status: "received" | "pending" | "ready";
  issues: string[];
  receivedAt: string;
  versionCount: number;
  reviewAssigneeId?: string | null;
};
export type ImportJson =
  | string
  | number
  | boolean
  | null
  | ImportJson[]
  | { [key: string]: ImportJson };
export type JourneyRecordDetail = JourneyRecord & {
  original: ImportJson;
  history: Array<{ at: string; actor: string; note: string }>;
  versions: Array<{ id: string; at: string; hash: string }>;
  currentVersionId: string | null;
  versionsCursor: string | null;
  historyCursor: string | null;
  files?: Array<{
    id: string;
    name: string;
    size: number | null;
    status: "preserved" | "pending";
    issue?: string | null;
    contentType?: string | null;
  }>;
  canManage: boolean;
  reviewAssignee?: { id: string; label: string } | null;
  targetId?: string | null;
  targetType?: "person" | "project" | "member";
  linkExternalId?: string;
};
export type JourneyEvidencePage = {
  versions: JourneyRecordDetail["versions"];
  history: JourneyRecordDetail["history"];
  nextCursor: string | null;
};
export type JourneyRecordFilters = {
  provider?: ImportProvider;
  status?: JourneyRecord["status"];
  issuesOnly?: boolean;
  assigneeId?: string;
  q?: string;
  page?: number;
};
export type JourneyRecordPage = {
  records: JourneyRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export function importResource(provider: ImportProvider) {
  return `techprojects.${provider}_import` as const;
}

export function importCoverageComplete(coverage: JourneyCoverage[]) {
  return coverage.length > 0 && coverage.every((item) => item.status === "available");
}
