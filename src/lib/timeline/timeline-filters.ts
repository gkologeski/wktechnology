// Filtros da timeline no padrão HubSpot, adaptados aos tipos que o TechERP
// registra. Funções puras: a UI só lê o catálogo e chama `applyTimelineFilters`.
import type { HistoryGroup } from "@/lib/timeline/history-groups";

export type TimelineCategory =
  | "call"
  | "email"
  | "whatsapp"
  | "message"
  | "note"
  | "task"
  | "meeting"
  | "survey"
  | "stage"
  | "substatus"
  | "owner"
  | "fields";

export const TIMELINE_CATEGORY_GROUPS: {
  label: string;
  items: { key: TimelineCategory; label: string }[];
}[] = [
  {
    label: "Comunicação",
    items: [
      { key: "call", label: "Chamadas" },
      { key: "email", label: "E-mails" },
      { key: "whatsapp", label: "WhatsApp" },
      { key: "message", label: "Mensagens (SMS, LinkedIn, correio)" },
    ],
  },
  {
    label: "Atividade da equipe",
    items: [
      { key: "note", label: "Observações" },
      { key: "task", label: "Tarefas" },
      { key: "meeting", label: "Reuniões" },
      { key: "survey", label: "Pesquisas" },
    ],
  },
  {
    label: "Atualizações",
    items: [
      { key: "stage", label: "Mudança de etapa" },
      { key: "substatus", label: "Mudança de substatus" },
      { key: "owner", label: "Responsável" },
      { key: "fields", label: "Outras alterações de campos" },
    ],
  },
];

export const ALL_CATEGORIES: TimelineCategory[] = TIMELINE_CATEGORY_GROUPS.flatMap((g) =>
  g.items.map((i) => i.key),
);

export const TIMELINE_TABS: { key: "all" | TimelineCategory; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "note", label: "Observações" },
  { key: "email", label: "E-mails" },
  { key: "call", label: "Chamadas" },
  { key: "task", label: "Tarefas" },
  { key: "meeting", label: "Reuniões" },
  { key: "whatsapp", label: "WhatsApp" },
];

/** Valor especial do filtro de responsável para itens sem responsável. */
export const UNASSIGNED = "__unassigned__";

export type TimelineFilters = {
  tab: "all" | TimelineCategory;
  search: string;
  categories: TimelineCategory[];
  assignees: string[]; // vazio = todos
};

export const DEFAULT_TIMELINE_FILTERS: TimelineFilters = {
  tab: "all",
  search: "",
  categories: ALL_CATEGORIES,
  assignees: [],
};

export function isFiltered(f: TimelineFilters): boolean {
  return (
    f.tab !== "all" ||
    f.search.trim() !== "" ||
    f.categories.length !== ALL_CATEGORIES.length ||
    f.assignees.length > 0
  );
}

export function activityCategory(type: string | null | undefined): TimelineCategory {
  switch (type) {
    case "call":
    case "email":
    case "whatsapp":
    case "task":
    case "meeting":
    case "survey":
      return type;
    case "sms":
    case "linkedin_message":
    case "postal_mail":
      return "message";
    default:
      return "note";
  }
}

const STAGE_PROPS = new Set(["stage", "stage_id", "pipeline_id", "status", "lifecycle_stage"]);
const OWNER_PROPS = new Set(["assigned_to", "owner_id"]);

export function propertyCategory(property: string): TimelineCategory {
  if (property === "stage_substatus_id") return "substatus";
  if (STAGE_PROPS.has(property)) return "stage";
  if (OWNER_PROPS.has(property)) return "owner";
  return "fields";
}

export type FilterableActivity = {
  type?: string | null;
  subject?: string | null;
  body?: string | null;
  owner_id?: string | null;
  assigned_to?: string | null;
};

export type FilterableEntry<A extends FilterableActivity = FilterableActivity> = {
  activity?: A;
  history?: HistoryGroup;
};

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, " ");
}

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Aplica aba, tipos, responsável e busca. Grupos de histórico ficam só com as
 * alterações das categorias selecionadas; grupos vazios saem da lista.
 */
export function applyTimelineFilters(
  entries: readonly FilterableEntry[],
  f: TimelineFilters,
  opts: {
    extraText?: (a: FilterableActivity & { id?: string }) => string;
    historyText?: (g: HistoryGroup) => string;
  } = {},
): FilterableEntry[] {
  const allowed = new Set<TimelineCategory>(
    f.tab === "all" ? f.categories : f.categories.includes(f.tab) ? [f.tab] : [],
  );
  const q = norm(f.search.trim());
  const assignees = new Set(f.assignees);
  const out: FilterableEntry[] = [];
  for (const e of entries) {
    if (e.activity) {
      const a = e.activity;
      if (!allowed.has(activityCategory(a.type))) continue;
      if (assignees.size) {
        const who = a.assigned_to ?? a.owner_id ?? null;
        if (!(who ? assignees.has(who) : assignees.has(UNASSIGNED))) continue;
      }
      if (q) {
        const text = `${a.subject ?? ""} ${stripHtml(a.body ?? "")} ${opts.extraText?.(a) ?? ""}`;
        if (!norm(text).includes(q)) continue;
      }
      out.push(e);
    } else if (e.history) {
      const changes = e.history.changes.filter((c) => allowed.has(propertyCategory(c.property)));
      if (!changes.length) continue;
      if (assignees.size) {
        const who = e.history.changed_by;
        if (!(who ? assignees.has(who) : assignees.has(UNASSIGNED))) continue;
      }
      const group = { ...e.history, changes };
      if (q && !norm(opts.historyText?.(group) ?? "").includes(q)) continue;
      out.push({ ...e, history: group });
    }
  }
  return out;
}

export function countByCategory(entries: FilterableEntry[]): Map<TimelineCategory, number> {
  const m = new Map<TimelineCategory, number>();
  for (const e of entries) {
    if (e.activity) {
      const c = activityCategory(e.activity.type);
      m.set(c, (m.get(c) ?? 0) + 1);
    }
  }
  return m;
}
