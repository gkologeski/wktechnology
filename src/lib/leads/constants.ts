import type { CustomRange, DatePreset } from "@/lib/date-presets";

/** Fila manual reutilizável usada pelo atalho "Modo Prospecção" a partir de /leads. */
export const PROSPECTING_MODE_QUEUE_NAME = "Modo Prospecção (rápida)";
export const PROSPECTING_MODE_LIMIT = 500;

export const STATUS_TONE: Record<string, { dot: string; bg: string; text: string }> = {
  new: { dot: "bg-sky-500", bg: "bg-sky-500/10", text: "text-sky-700 dark:text-sky-300" },
  contacted: {
    dot: "bg-violet-500",
    bg: "bg-violet-500/10",
    text: "text-violet-700 dark:text-violet-300",
  },
  qualified: {
    dot: "bg-emerald-500",
    bg: "bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  disqualified: {
    dot: "bg-rose-500",
    bg: "bg-rose-500/10",
    text: "text-rose-700 dark:text-rose-300",
  },
};

export type ViewId = "all" | "open" | "mine" | "unassigned" | "new_week";
export const VIEWS: { id: ViewId; label: string }[] = [
  { id: "all", label: "Todos os leads" },
  { id: "open", label: "Abertos" },
  { id: "mine", label: "Meus leads" },
  { id: "unassigned", label: "Sem responsável" },
  { id: "new_week", label: "Novos esta semana" },
];

/** Colunas fixas ordenáveis do grid; colunas do catálogo entram como string. */
export type SortKey = string;
export const DECLARED_SORT_KEYS = ["first_name", "created_at", "score"] as const;
/** Colunas sempre projetadas (ações, filtros, seleção e células fixas). */
export const BASE_LEAD_KEYS = [
  "id",
  "first_name",
  "last_name",
  "email",
  "phone",
  "mobile_phone",
  "linkedin_url",

  "company_name",
  "company_id",
  "status",
  "stage_id",
  "stage_substatus_id",
  "source",
  "score",

  "label",
  "owner_id",
  "assigned_to",
  "assigned_user_id",
  "hubspot_owner_id",
  "created_at",
  "updated_at",
] as const;
export type SortDir = "asc" | "desc";

export type Filters = {
  status: string[];
  substatusIds: string[];
  source: string[];
  scoreMin: number;
  scoreMax: number;
  createdPreset: DatePreset;
  createdCustom: CustomRange;
  ownerIds: string[];
  includeUnassigned: boolean;
};

export const DEFAULT_FILTERS: Filters = {
  status: [],
  substatusIds: [],
  source: [],
  scoreMin: 0,
  scoreMax: 100,
  createdPreset: "any",
  createdCustom: {},
  ownerIds: [],
  includeUnassigned: false,
};

import type { Lead } from "@/lib/db-types";

/** Linha do grid de leads: campos fixos de Lead + colunas dinâmicas do catálogo. */
export type LeadGridRow = Lead & Record<string, unknown>;
