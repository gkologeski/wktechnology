// Painel por perfil do TechProjects (Ciclo 5): tipos, catálogo de indicadores e utilitários puros.
// Sem acesso a dados: usado pelo servidor, pela rota e pelos componentes de apresentação.

export const DASH_VIEWS = ["me", "team", "commercial", "finance", "quality"] as const;
export type DashView = (typeof DASH_VIEWS)[number];

export const DASH_VIEW_LABEL: Record<DashView, string> = {
  me: "Meu trabalho",
  team: "Equipe e entrega",
  commercial: "Comercial",
  finance: "Financeiro e gestão",
  quality: "Qualidade dos dados",
};

export const DASH_DATASETS = [
  "entries",
  "projects",
  "tasks",
  "milestones",
  "people",
  "forecast",
  "deals",
  "measurements",
  "cost",
  "alerts",
] as const;
export type DashDataset = (typeof DASH_DATASETS)[number];

export const DASH_ORIGINS = ["manual", "timer", "clockify", "jibble", "import_other"] as const;
export const DASH_ORIGIN_LABEL: Record<string, string> = {
  manual: "Manual",
  timer: "Cronômetro",
  clockify: "Clockify",
  jibble: "Jibble",
  import_other: "Outra importação",
};
export const DASH_ENTRY_STATUSES = [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "locked",
  "locked_import",
] as const;

/** Filtros aceitos (todos opcionais além do período). IDs são revalidados no banco. */
export type DashFilters = {
  from: string;
  to: string;
  tz: string;
  compare?: boolean;
  project?: string;
  company?: string;
  service?: string;
  leader?: string;
  person?: string;
  origin?: string;
  status?: string;
  currency?: string;
};

export const DASH_FILTER_KEYS = [
  "project",
  "company",
  "service",
  "leader",
  "person",
  "origin",
  "status",
  "currency",
] as const;
export type DashFilterKey = (typeof DASH_FILTER_KEYS)[number];

/** Quais filtros cada visão aplica (os demais ficam ocultos para não sugerir efeito inexistente). */
export const DASH_VIEW_FILTERS: Record<DashView, DashFilterKey[]> = {
  me: ["project", "company", "service", "origin", "status"],
  team: ["project", "company", "service", "leader", "person", "origin", "status"],
  commercial: ["company", "person"],
  finance: ["project", "company", "service", "leader", "person", "currency"],
  quality: ["project", "company", "service", "person", "origin", "status"],
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export type DashSearch = {
  view?: string;
  from?: string;
  to?: string;
  compare?: boolean;
  project?: string;
  company?: string;
  service?: string;
  leader?: string;
  person?: string;
  origin?: string;
  status?: string;
  currency?: string;
};

/** Normaliza a URL: descarta valores malformados em vez de quebrar a tela. */
export function parseDashSearch(s: Record<string, unknown>): DashSearch {
  const str = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : undefined);
  const id = (v: unknown) => {
    const x = str(v);
    return x && UUID.test(x) ? x.toLowerCase() : undefined;
  };
  const day = (v: unknown) => {
    const x = str(v);
    return x && ISO_DAY.test(x) ? x : undefined;
  };
  const view = str(s.view);
  const origin = str(s.origin);
  const status = str(s.status);
  const currency = str(s.currency)?.toUpperCase();
  return {
    view: view && (DASH_VIEWS as readonly string[]).includes(view) ? view : undefined,
    from: day(s.from),
    to: day(s.to),
    compare: s.compare === true || s.compare === "true" ? true : undefined,
    project: id(s.project),
    company: id(s.company),
    service: id(s.service),
    leader: id(s.leader),
    person: id(s.person),
    origin: origin && (DASH_ORIGINS as readonly string[]).includes(origin) ? origin : undefined,
    status:
      status && (DASH_ENTRY_STATUSES as readonly string[]).includes(status) ? status : undefined,
    currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : undefined,
  };
}

/** Somente os filtros válidos para a visão (troca de visão não carrega filtro sem efeito). */
export function filtersForView(view: DashView, search: DashSearch): Partial<DashFilters> {
  const out: Partial<DashFilters> = {};
  for (const k of DASH_VIEW_FILTERS[view]) {
    const v = search[k];
    if (v) out[k] = v;
  }
  return out;
}

/** Chave da preferência salva: por workspace + usuário (nunca compartilhada entre contas). */
export function dashPreferenceKey(workspaceId: string, userId: string): string {
  return `techprojects:dashboard:v1:${workspaceId}:${userId}`;
}

/** Escolhe a visão: pedida (se permitida) → salva (se permitida) → primeira permitida. */
export function resolveDashView(
  requested: string | undefined,
  saved: string | undefined,
  allowed: Partial<Record<DashView, boolean>>,
): DashView {
  const ok = (v: string | undefined): v is DashView =>
    !!v && (DASH_VIEWS as readonly string[]).includes(v) && allowed[v as DashView] === true;
  if (ok(requested)) return requested;
  if (ok(saved)) return saved;
  return DASH_VIEWS.find((v) => allowed[v]) ?? "me";
}

/** Definição de cada indicador: o que conta, de onde vem e o que falta. Mostrada no cartão e na lista. */
export { METRIC_DEFS, metricDef, type MetricDef } from "./dashboard-metric-defs.shared";

export const ALERT_RULE_LABEL: Record<string, string> = {
  milestone_overdue: "Marco atrasado",
  project_overdue: "Projeto com prazo vencido",
  hours_budget: "Orçamento de horas",
  capacity_exceeded: "Capacidade excedida",
  hours_unreviewed: "Horas sem revisão",
  approver_missing: "Projeto sem aprovador",
  schedule_missing: "Pessoa sem jornada",
  deal_won_no_project: "Ganho sem projeto",
  no_operational_owner: "Sem responsável operacional",
};

export const ALERT_STATUS_LABEL: Record<string, string> = {
  open: "Aberto",
  acknowledged: "Reconhecido",
  snoozed: "Adiado",
  resolved: "Resolvido",
};

export const ALERT_SEVERITY_LABEL: Record<string, string> = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

/**
 * Célula CSV segura: neutraliza fórmulas (=, +, -, @, tab, CR) para planilhas e escapa aspas,
 * separador e quebras de linha. Números ficam como números.
 */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return v ? "sim" : "não";
  let s = typeof v === "string" ? v : JSON.stringify(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toSafeCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
}

/** Limite real da exportação: o arquivo informa quando o total é maior. */
export const DASH_EXPORT_MAX_ROWS = 5000;
export const DASH_PAGE_SIZE = 50;
