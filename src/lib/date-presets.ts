// Presets de data padronizados em todo o sistema.
// Use `getDateRange(preset, now?, custom?)` para obter `{ start, end }` (end exclusivo).

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

// Ordem canônica usada pelos seletores.
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

// Opções no formato esperado por RadioFilter (readonly [value, label]).
export const DATE_PRESET_OPTIONS = DATE_PRESETS.map(
  (p) => [p, DATE_PRESET_LABELS[p]] as const,
) as readonly (readonly [DatePreset, string])[];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export type CustomRange = { start?: string; end?: string };

/**
 * Retorna o intervalo [start, end) correspondente ao preset.
 * `any` retorna `{}` (sem filtro). Para `custom`, passe `custom` com
 * strings ISO (YYYY-MM-DD) para `start`/`end` (inclusive).
 * Semana inicia na segunda-feira. Semestres = jan-jun / jul-dez.
 */
export function getDateRange(
  preset: DatePreset,
  now: Date = new Date(),
  custom?: CustomRange,
): { start?: Date; end?: Date } {
  if (preset === "any") return {};

  const today = startOfDay(now);

  if (preset === "custom") {
    const start = custom?.start ? startOfDay(new Date(custom.start)) : undefined;
    const end = custom?.end ? addDays(startOfDay(new Date(custom.end)), 1) : undefined;
    return { start, end };
  }

  switch (preset) {
    case "today":
      return { start: today, end: addDays(today, 1) };
    case "yesterday":
      return { start: addDays(today, -1), end: today };
    case "tomorrow":
      return { start: addDays(today, 1), end: addDays(today, 2) };
  }

  // Últimos N dias = [today - N, today + 1) — inclui hoje
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
    return { start: addDays(today, -(n - 1)), end: addDays(today, 1) };
  }

  // Semana ISO (segunda a domingo)
  const dow = (today.getDay() + 6) % 7;
  const weekStart = addDays(today, -dow);
  if (preset === "this_week") return { start: weekStart, end: addDays(weekStart, 7) };
  if (preset === "last_week")
    return { start: addDays(weekStart, -7), end: weekStart };
  if (preset === "next_week")
    return { start: addDays(weekStart, 7), end: addDays(weekStart, 14) };

  const y = today.getFullYear();
  const m = today.getMonth();

  if (preset === "this_month")
    return { start: new Date(y, m, 1), end: new Date(y, m + 1, 1) };
  if (preset === "last_month")
    return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
  if (preset === "next_month")
    return { start: new Date(y, m + 1, 1), end: new Date(y, m + 2, 1) };

  const q = Math.floor(m / 3);
  if (preset === "this_quarter")
    return { start: new Date(y, q * 3, 1), end: new Date(y, q * 3 + 3, 1) };
  if (preset === "last_quarter")
    return { start: new Date(y, q * 3 - 3, 1), end: new Date(y, q * 3, 1) };
  if (preset === "next_quarter")
    return { start: new Date(y, q * 3 + 3, 1), end: new Date(y, q * 3 + 6, 1) };

  const s = m < 6 ? 0 : 6;
  if (preset === "this_semester")
    return { start: new Date(y, s, 1), end: new Date(y, s + 6, 1) };
  if (preset === "last_semester")
    return { start: new Date(y, s - 6, 1), end: new Date(y, s, 1) };
  if (preset === "next_semester")
    return { start: new Date(y, s + 6, 1), end: new Date(y, s + 12, 1) };

  if (preset === "this_year")
    return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1) };
  if (preset === "last_year")
    return { start: new Date(y - 1, 0, 1), end: new Date(y, 0, 1) };
  if (preset === "next_year")
    return { start: new Date(y + 1, 0, 1), end: new Date(y + 2, 0, 1) };

  return {};
}
