// Resolução do período e do responsável do painel de vendas a partir da URL.
// Client-safe e puro para facilitar testes.
import { endOfDay, format, isValid, parseISO, startOfDay } from "date-fns";
import { PRESETS, getPresetRange, type DateRange, type PresetKey } from "@/lib/date-presets";

export const DASHBOARD_DEFAULT_PRESET: PresetKey = "last30";
export const ASSIGNEE_ALL = "__all__";
export const ASSIGNEE_ME = "__me__";
export const ASSIGNEE_NONE = "__none__";

const PRESET_KEYS = new Set<string>(PRESETS.map((p) => p.key));

export function isPresetKey(v: unknown): v is PresetKey {
  return typeof v === "string" && PRESET_KEYS.has(v);
}

export interface DashboardPeriodSearch {
  preset?: string;
  from?: string;
  to?: string;
  /** Legado: 7 | 30 | 90 */
  period?: number;
}

/** Converte a URL em intervalo concreto. Personalizado exige `from` e `to` válidos. */
export function resolveDashboardRange(
  s: DashboardPeriodSearch,
  now: Date = new Date(),
): { range: DateRange; preset: PresetKey | "custom" } {
  if (s.preset === "custom" && s.from && s.to) {
    const a = parseISO(s.from);
    const b = parseISO(s.to);
    if (isValid(a) && isValid(b)) {
      const [x, y] = a <= b ? [a, b] : [b, a];
      return { range: { from: startOfDay(x), to: endOfDay(y) }, preset: "custom" };
    }
  }
  let key: PresetKey = DASHBOARD_DEFAULT_PRESET;
  if (isPresetKey(s.preset)) key = s.preset;
  else if (s.period === 7) key = "last7";
  else if (s.period === 90) key = "last90";
  return { range: getPresetRange(key, now), preset: key };
}

/** Intervalo anterior de mesma duração, terminando imediatamente antes de `from`. */
export function previousRange(range: DateRange): DateRange {
  const len = range.to.getTime() - range.from.getTime();
  const to = new Date(range.from.getTime() - 1);
  return { from: new Date(to.getTime() - len), to };
}

export function toIsoDay(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** Mapeia o escopo legado (`me`/`team`) para o novo filtro de responsável. */
export function resolveAssignee(assignee?: string, legacyScope?: string): string {
  if (assignee) return assignee;
  if (legacyScope === "me") return ASSIGNEE_ME;
  return ASSIGNEE_ALL;
}
