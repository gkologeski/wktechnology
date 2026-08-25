// Presets de data padronizados em todo o sistema.
// Use `getDateRange(preset, now?, custom?)` para obter `{ start, end }` (end exclusivo).
// Contém DUAS APIs coexistindo por retrocompatibilidade:
//   - API antiga (DatePreset/getDateRange/CustomRange) usada em filtros de listas/timeline.
//   - API nova pt-BR (PresetKey/PRESETS/getPresetRange/DateRange) usada pelo DateRangePicker.

import {
  addDays as _addDays,
  addMonths,
  addQuarters,
  addWeeks,
  addYears,
  endOfDay,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  startOfDay as _startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subDays,
  subQuarters,
  subWeeks,
  subYears,
} from "date-fns";

// ---------------------------------------------------------------------------
// API antiga (mantida por compatibilidade com filtros existentes)
// ---------------------------------------------------------------------------

export type DatePreset =
  | "any"
  | "today"
  | "yesterday"
  | "tomorrow"
  | "last_7d"
  | "last_14d"
  | "last_30d"
  | "last_60d"
  | "last_90d"
  | "last_180d"
  | "last_365d"
  | "this_week"
  | "last_week"
  | "next_week"
  | "this_month"
  | "last_month"
  | "next_month"
  | "this_quarter"
  | "last_quarter"
  | "next_quarter"
  | "this_semester"
  | "last_semester"
  | "next_semester"
  | "this_year"
  | "last_year"
  | "next_year"
  | "custom";

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  any: "Qualquer data",
  today: "Hoje",
  yesterday: "Ontem",
  tomorrow: "Amanhã",
  last_7d: "Últimos 7 dias",
  last_14d: "Últimos 14 dias",
  last_30d: "Últimos 30 dias",
  last_60d: "Últimos 60 dias",
  last_90d: "Últimos 90 dias",
  last_180d: "Últimos 180 dias",
  last_365d: "Últimos 365 dias",
  this_week: "Esta semana",
  last_week: "Semana passada",
  next_week: "Próxima semana",
  this_month: "Este mês",
  last_month: "Mês passado",
  next_month: "Próximo mês",
  this_quarter: "Este trimestre",
  last_quarter: "Trimestre passado",
  next_quarter: "Próximo trimestre",
  this_semester: "Este semestre",
  last_semester: "Semestre passado",
  next_semester: "Próximo semestre",
  this_year: "Este ano",
  last_year: "Ano passado",
  next_year: "Próximo ano",
  custom: "Personalizar…",
};

export const DATE_PRESETS: DatePreset[] = [
  "any",
  "today",
  "yesterday",
  "tomorrow",
  "last_7d",
  "last_14d",
  "last_30d",
  "last_60d",
  "last_90d",
  "last_180d",
  "last_365d",
  "this_week",
  "last_week",
  "next_week",
  "this_month",
  "last_month",
  "next_month",
  "this_quarter",
  "last_quarter",
  "next_quarter",
  "this_semester",
  "last_semester",
  "next_semester",
  "this_year",
  "last_year",
  "next_year",
  "custom",
];

export const DATE_PRESET_OPTIONS = DATE_PRESETS.map(
  (p) => [p, DATE_PRESET_LABELS[p]] as const,
) as readonly (readonly [DatePreset, string])[];

function _legacyStartOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function _legacyAddDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export type CustomRange = { start?: string; end?: string };

/**
 * API antiga — Retorna o intervalo [start, end) correspondente ao preset.
 * `any` retorna `{}` (sem filtro). Para `custom`, passe `custom` com
 * strings ISO (YYYY-MM-DD) para `start`/`end` (inclusive).
 */
export function getDateRange(
  preset: DatePreset,
  now: Date = new Date(),
  custom?: CustomRange,
): { start?: Date; end?: Date } {
  if (preset === "any") return {};

  const today = _legacyStartOfDay(now);

  if (preset === "custom") {
    const start = custom?.start ? _legacyStartOfDay(new Date(custom.start)) : undefined;
    const end = custom?.end
      ? _legacyAddDays(_legacyStartOfDay(new Date(custom.end)), 1)
      : undefined;
    return { start, end };
  }

  switch (preset) {
    case "today":
      return { start: today, end: _legacyAddDays(today, 1) };
    case "yesterday":
      return { start: _legacyAddDays(today, -1), end: today };
    case "tomorrow":
      return { start: _legacyAddDays(today, 1), end: _legacyAddDays(today, 2) };
  }

  const lastN: Partial<Record<DatePreset, number>> = {
    last_7d: 7,
    last_14d: 14,
    last_30d: 30,
    last_60d: 60,
    last_90d: 90,
    last_180d: 180,
    last_365d: 365,
  };
  if (preset in lastN) {
    const n = lastN[preset]!;
    return { start: _legacyAddDays(today, -(n - 1)), end: _legacyAddDays(today, 1) };
  }

  const dow = (today.getDay() + 6) % 7;
  const weekStart = _legacyAddDays(today, -dow);
  if (preset === "this_week") return { start: weekStart, end: _legacyAddDays(weekStart, 7) };
  if (preset === "last_week") return { start: _legacyAddDays(weekStart, -7), end: weekStart };
  if (preset === "next_week")
    return { start: _legacyAddDays(weekStart, 7), end: _legacyAddDays(weekStart, 14) };

  const y = today.getFullYear();
  const m = today.getMonth();

  if (preset === "this_month") return { start: new Date(y, m, 1), end: new Date(y, m + 1, 1) };
  if (preset === "last_month") return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
  if (preset === "next_month") return { start: new Date(y, m + 1, 1), end: new Date(y, m + 2, 1) };

  const q = Math.floor(m / 3);
  if (preset === "this_quarter")
    return { start: new Date(y, q * 3, 1), end: new Date(y, q * 3 + 3, 1) };
  if (preset === "last_quarter")
    return { start: new Date(y, q * 3 - 3, 1), end: new Date(y, q * 3, 1) };
  if (preset === "next_quarter")
    return { start: new Date(y, q * 3 + 3, 1), end: new Date(y, q * 3 + 6, 1) };

  const s = m < 6 ? 0 : 6;
  if (preset === "this_semester") return { start: new Date(y, s, 1), end: new Date(y, s + 6, 1) };
  if (preset === "last_semester") return { start: new Date(y, s - 6, 1), end: new Date(y, s, 1) };
  if (preset === "next_semester")
    return { start: new Date(y, s + 6, 1), end: new Date(y, s + 12, 1) };

  if (preset === "this_year") return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1) };
  if (preset === "last_year") return { start: new Date(y - 1, 0, 1), end: new Date(y, 0, 1) };
  if (preset === "next_year") return { start: new Date(y + 1, 0, 1), end: new Date(y + 2, 0, 1) };

  return {};
}

// ---------------------------------------------------------------------------
// API nova (skill date-range-picker-br) — usada pelo componente DateRangePicker
// ---------------------------------------------------------------------------

export type PresetKey =
  | "today"
  | "yesterday"
  | "tomorrow"
  | "thisWeek"
  | "lastWeek"
  | "nextWeek"
  | "thisQuarter"
  | "lastQuarter"
  | "nextQuarter"
  | "thisSemester"
  | "lastSemester"
  | "nextSemester"
  | "thisYear"
  | "lastYear"
  | "nextYear"
  | "last7"
  | "last14"
  | "last30"
  | "last60"
  | "last90"
  | "last180"
  | "last365";

export type DateRange = { from: Date; to: Date };

export type PresetGroup =
  | "Dias"
  | "Semanas"
  | "Trimestres"
  | "Semestres"
  | "Anos"
  | "Últimos N dias";

export const PRESETS: { key: PresetKey; label: string; group: PresetGroup }[] = [
  { key: "today", label: "Hoje", group: "Dias" },
  { key: "yesterday", label: "Ontem", group: "Dias" },
  { key: "tomorrow", label: "Amanhã", group: "Dias" },
  { key: "thisWeek", label: "Essa Semana", group: "Semanas" },
  { key: "lastWeek", label: "Semana Passada", group: "Semanas" },
  { key: "nextWeek", label: "Próxima Semana", group: "Semanas" },
  { key: "thisQuarter", label: "Esse Trimestre", group: "Trimestres" },
  { key: "lastQuarter", label: "Trimestre Passado", group: "Trimestres" },
  { key: "nextQuarter", label: "Próximo Trimestre", group: "Trimestres" },
  { key: "thisSemester", label: "Esse Semestre", group: "Semestres" },
  { key: "lastSemester", label: "Semestre Passado", group: "Semestres" },
  { key: "nextSemester", label: "Próximo Semestre", group: "Semestres" },
  { key: "thisYear", label: "Esse Ano", group: "Anos" },
  { key: "lastYear", label: "Ano Passado", group: "Anos" },
  { key: "nextYear", label: "Próximo Ano", group: "Anos" },
  { key: "last7", label: "Últimos 7 dias", group: "Últimos N dias" },
  { key: "last14", label: "Últimos 14 dias", group: "Últimos N dias" },
  { key: "last30", label: "Últimos 30 dias", group: "Últimos N dias" },
  { key: "last60", label: "Últimos 60 dias", group: "Últimos N dias" },
  { key: "last90", label: "Últimos 90 dias", group: "Últimos N dias" },
  { key: "last180", label: "Últimos 180 dias", group: "Últimos N dias" },
  { key: "last365", label: "Últimos 365 dias", group: "Últimos N dias" },
];

const WEEK_OPTS = { weekStartsOn: 1 as const };

function semesterBounds(d: Date): DateRange {
  const isFirstHalf = d.getMonth() < 6;
  const from = isFirstHalf
    ? startOfMonth(new Date(d.getFullYear(), 0, 1))
    : startOfMonth(new Date(d.getFullYear(), 6, 1));
  const to = isFirstHalf
    ? endOfMonth(new Date(d.getFullYear(), 5, 1))
    : endOfMonth(new Date(d.getFullYear(), 11, 1));
  return { from, to: endOfDay(to) };
}

export function getPresetRange(key: PresetKey, now: Date = new Date()): DateRange {
  switch (key) {
    case "today":
      return { from: _startOfDay(now), to: endOfDay(now) };
    case "yesterday": {
      const d = subDays(now, 1);
      return { from: _startOfDay(d), to: endOfDay(d) };
    }
    case "tomorrow": {
      const d = _addDays(now, 1);
      return { from: _startOfDay(d), to: endOfDay(d) };
    }
    case "thisWeek":
      return { from: startOfWeek(now, WEEK_OPTS), to: endOfWeek(now, WEEK_OPTS) };
    case "lastWeek": {
      const d = subWeeks(now, 1);
      return { from: startOfWeek(d, WEEK_OPTS), to: endOfWeek(d, WEEK_OPTS) };
    }
    case "nextWeek": {
      const d = addWeeks(now, 1);
      return { from: startOfWeek(d, WEEK_OPTS), to: endOfWeek(d, WEEK_OPTS) };
    }
    case "thisQuarter":
      return { from: startOfQuarter(now), to: endOfQuarter(now) };
    case "lastQuarter": {
      const d = subQuarters(now, 1);
      return { from: startOfQuarter(d), to: endOfQuarter(d) };
    }
    case "nextQuarter": {
      const d = addQuarters(now, 1);
      return { from: startOfQuarter(d), to: endOfQuarter(d) };
    }
    case "thisSemester":
      return semesterBounds(now);
    case "lastSemester":
      return semesterBounds(addMonths(now, -6));
    case "nextSemester":
      return semesterBounds(addMonths(now, 6));
    case "thisYear":
      return { from: startOfYear(now), to: endOfYear(now) };
    case "lastYear": {
      const d = subYears(now, 1);
      return { from: startOfYear(d), to: endOfYear(d) };
    }
    case "nextYear": {
      const d = addYears(now, 1);
      return { from: startOfYear(d), to: endOfYear(d) };
    }
    case "last7":
      return { from: _startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case "last14":
      return { from: _startOfDay(subDays(now, 13)), to: endOfDay(now) };
    case "last30":
      return { from: _startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case "last60":
      return { from: _startOfDay(subDays(now, 59)), to: endOfDay(now) };
    case "last90":
      return { from: _startOfDay(subDays(now, 89)), to: endOfDay(now) };
    case "last180":
      return { from: _startOfDay(subDays(now, 179)), to: endOfDay(now) };
    case "last365":
      return { from: _startOfDay(subDays(now, 364)), to: endOfDay(now) };
  }
}
