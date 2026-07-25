import {
  addDays,
  addMonths,
  addQuarters,
  addWeeks,
  addYears,
  endOfDay,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subDays,
  subQuarters,
  subWeeks,
  subYears,
} from "date-fns";

export type PresetKey =
  | "today" | "yesterday" | "tomorrow"
  | "thisWeek" | "lastWeek" | "nextWeek"
  | "thisQuarter" | "lastQuarter" | "nextQuarter"
  | "thisSemester" | "lastSemester" | "nextSemester"
  | "thisYear" | "lastYear" | "nextYear"
  | "last7" | "last14" | "last30" | "last60" | "last90" | "last180" | "last365";

export type DateRange = { from: Date; to: Date };

export type PresetGroup =
  | "Dias" | "Semanas" | "Trimestres" | "Semestres" | "Anos" | "Últimos N dias";

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
    case "today": return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": { const d = subDays(now, 1); return { from: startOfDay(d), to: endOfDay(d) }; }
    case "tomorrow": { const d = addDays(now, 1); return { from: startOfDay(d), to: endOfDay(d) }; }
    case "thisWeek": return { from: startOfWeek(now, WEEK_OPTS), to: endOfWeek(now, WEEK_OPTS) };
    case "lastWeek": { const d = subWeeks(now, 1); return { from: startOfWeek(d, WEEK_OPTS), to: endOfWeek(d, WEEK_OPTS) }; }
    case "nextWeek": { const d = addWeeks(now, 1); return { from: startOfWeek(d, WEEK_OPTS), to: endOfWeek(d, WEEK_OPTS) }; }
    case "thisQuarter": return { from: startOfQuarter(now), to: endOfQuarter(now) };
    case "lastQuarter": { const d = subQuarters(now, 1); return { from: startOfQuarter(d), to: endOfQuarter(d) }; }
    case "nextQuarter": { const d = addQuarters(now, 1); return { from: startOfQuarter(d), to: endOfQuarter(d) }; }
    case "thisSemester": return semesterBounds(now);
    case "lastSemester": return semesterBounds(addMonths(now, -6));
    case "nextSemester": return semesterBounds(addMonths(now, 6));
    case "thisYear": return { from: startOfYear(now), to: endOfYear(now) };
    case "lastYear": { const d = subYears(now, 1); return { from: startOfYear(d), to: endOfYear(d) }; }
    case "nextYear": { const d = addYears(now, 1); return { from: startOfYear(d), to: endOfYear(d) }; }
    case "last7": return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case "last14": return { from: startOfDay(subDays(now, 13)), to: endOfDay(now) };
    case "last30": return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case "last60": return { from: startOfDay(subDays(now, 59)), to: endOfDay(now) };
    case "last90": return { from: startOfDay(subDays(now, 89)), to: endOfDay(now) };
    case "last180": return { from: startOfDay(subDays(now, 179)), to: endOfDay(now) };
    case "last365": return { from: startOfDay(subDays(now, 364)), to: endOfDay(now) };
  }
}
