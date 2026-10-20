// Conciliação e duplicidade entre fontes. Puro.
// - Timesheets do Jibble são REFERÊNCIA: comparam-se com os intervalos reconstruídos, nunca
//   somam junto (isso contaria as mesmas horas duas vezes).
// - Duplicidade entre fontes (Clockify/manual/timer × Jibble) é só SINALIZADA; a decisão é
//   humana. Sobreposição não prova que é o mesmo evento.
import { parseIsoDuration } from "../clockify/clockify-time";
import type { JbInterval } from "./jibble-reconstruct";

export type TimesheetDay = {
  personId: string;
  date: string;
  trackedSeconds: number | null;
  regularSeconds: number | null;
  overtimeSeconds: number | null;
};

/** TimesheetsSummary → um registro por pessoa/dia (durações ISO, inclusive frações). */
export function flattenTimesheetSummary(
  rows: Array<{
    personId?: string;
    daily?: Array<{ date?: string; tracked?: string; regular?: string; overtime?: string }>;
  }>,
): TimesheetDay[] {
  const out: TimesheetDay[] = [];
  for (const r of rows) {
    if (!r.personId) continue;
    for (const d of r.daily ?? []) {
      if (!d.date) continue;
      out.push({
        personId: r.personId,
        date: d.date,
        trackedSeconds: parseIsoDuration(d.tracked),
        regularSeconds: parseIsoDuration(d.regular),
        overtimeSeconds: parseIsoDuration(d.overtime),
      });
    }
  }
  return out;
}

export type DayDivergence = {
  date: string;
  reconstructedSeconds: number;
  hourEntrySeconds: number;
  timesheetSeconds: number;
  diffSeconds: number;
};

/**
 * Compara, por dia do Jibble (belongsToDate), trabalho reconstruído + pausas pagas +
 * lançamentos de horas sem relógio (HourEntries) com o "tracked" do timesheet.
 */
export function reconcileDays(
  intervals: JbInterval[],
  hourEntries: Array<{ date: string; seconds: number }>,
  timesheet: TimesheetDay[],
  toleranceSeconds = 60,
): { divergences: DayDivergence[]; matchedDays: number; daysWithoutTimesheet: number } {
  const rec = new Map<string, number>();
  for (const iv of intervals) {
    if (iv.seconds == null || iv.seconds <= 0 || !iv.belongsToDate) continue;
    if (iv.kind === "break" && iv.paid !== true) continue;
    rec.set(iv.belongsToDate, (rec.get(iv.belongsToDate) ?? 0) + iv.seconds);
  }
  const he = new Map<string, number>();
  for (const h of hourEntries) he.set(h.date, (he.get(h.date) ?? 0) + h.seconds);
  const ts = new Map(timesheet.map((t) => [t.date, t.trackedSeconds ?? 0]));
  const days = new Set([...rec.keys(), ...he.keys(), ...ts.keys()]);
  const divergences: DayDivergence[] = [];
  let matchedDays = 0;
  let daysWithoutTimesheet = 0;
  for (const date of [...days].sort()) {
    const r = rec.get(date) ?? 0;
    const h = he.get(date) ?? 0;
    if (!ts.has(date)) {
      if (r + h > 0) daysWithoutTimesheet++;
      continue;
    }
    const t = ts.get(date)!;
    const diff = r + h - t;
    if (Math.abs(diff) > toleranceSeconds)
      divergences.push({
        date,
        reconstructedSeconds: r,
        hourEntrySeconds: h,
        timesheetSeconds: t,
        diffSeconds: diff,
      });
    else matchedDays++;
  }
  return { divergences, matchedDays, daysWithoutTimesheet };
}

export type ErpEntry = {
  id: string;
  source: string | null;
  external_id: string | null;
  project_id: string | null;
  started_at: string | null;
  stopped_at: string | null;
};

export type DuplicateHit = {
  entryId: string;
  source: string;
  externalId: string | null;
  kind: "exact" | "overlap";
  overlapSeconds: number;
  sameProject: boolean;
};

/** Origem legível do apontamento existente (import Clockify, manual, timer, api...). */
export function entryOrigin(e: Pick<ErpEntry, "source" | "external_id">): string {
  const ext = e.external_id ?? "";
  if (ext.startsWith("clockify:")) return "clockify";
  if (ext.startsWith("jibble:")) return "jibble";
  return e.source ?? "desconhecida";
}

/**
 * Sinaliza apontamentos existentes da MESMA pessoa que se sobrepõem ao segmento.
 * "exact": início e fim a até `toleranceSeconds`. Apontamentos do próprio Jibble são ignorados
 * (o vínculo idempotente cuida deles). Sem início/fim reais não há como comparar com segurança.
 */
export function findCrossSourceDuplicates(
  seg: { startUtc: number; endUtc: number },
  targetProjectId: string | null,
  entries: ErpEntry[],
  toleranceSeconds = 120,
): DuplicateHit[] {
  const hits: DuplicateHit[] = [];
  for (const e of entries) {
    if (entryOrigin(e) === "jibble") continue;
    const s = e.started_at ? Math.round(Date.parse(e.started_at) / 1000) : NaN;
    const en = e.stopped_at ? Math.round(Date.parse(e.stopped_at) / 1000) : NaN;
    if (!Number.isFinite(s) || !Number.isFinite(en) || en <= s) continue;
    const overlap = Math.min(seg.endUtc, en) - Math.max(seg.startUtc, s);
    if (overlap <= 0) continue;
    const exact =
      Math.abs(seg.startUtc - s) <= toleranceSeconds &&
      Math.abs(seg.endUtc - en) <= toleranceSeconds;
    hits.push({
      entryId: e.id,
      source: entryOrigin(e),
      externalId: e.external_id,
      kind: exact ? "exact" : "overlap",
      overlapSeconds: overlap,
      sameProject: !!targetProjectId && e.project_id === targetProjectId,
    });
  }
  return hits;
}

export type JbTotals = {
  intervals: number;
  workSeconds: number;
  paidBreakSeconds: number;
  unpaidBreakSeconds: number;
  openIntervals: number;
  byPersonMonth: Record<string, number>;
  byProjectMonth: Record<string, number>;
  reasons: Record<string, number>;
};

export function emptyJbTotals(): JbTotals {
  return {
    intervals: 0,
    workSeconds: 0,
    paidBreakSeconds: 0,
    unpaidBreakSeconds: 0,
    openIntervals: 0,
    byPersonMonth: {},
    byProjectMonth: {},
    reasons: {},
  };
}

export function accumulateInterval(t: JbTotals, iv: JbInterval) {
  t.intervals++;
  for (const r of iv.reasons) t.reasons[r] = (t.reasons[r] ?? 0) + 1;
  if (iv.endUtc == null) {
    t.openIntervals++;
    return;
  }
  const s = iv.seconds ?? 0;
  if (s <= 0) return;
  if (iv.kind === "break") {
    if (iv.paid) t.paidBreakSeconds += s;
    else t.unpaidBreakSeconds += s;
    return;
  }
  t.workSeconds += s;
  const month = (iv.belongsToDate ?? "").slice(0, 7) || "sem-data";
  const pk = `${iv.personId}|${month}`;
  t.byPersonMonth[pk] = (t.byPersonMonth[pk] ?? 0) + s;
  const jk = `${iv.projectId ?? "sem-projeto"}|${month}`;
  t.byProjectMonth[jk] = (t.byProjectMonth[jk] ?? 0) + s;
}
