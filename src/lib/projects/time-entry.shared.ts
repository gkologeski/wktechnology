// Helpers puros de apontamento de horas do TechProjects.
// Client-safe: sem acesso a banco, usado por telas e por testes.

export const TIME_ENTRY_STATUS = ["draft", "submitted", "approved", "rejected", "locked"] as const;
export type TimeEntryStatus = (typeof TIME_ENTRY_STATUS)[number];

export const TIME_ENTRY_STATUS_LABEL: Record<TimeEntryStatus, string> = {
  draft: "Rascunho",
  submitted: "Enviado",
  approved: "Aprovado",
  rejected: "Rejeitado",
  locked: "Travado",
};

export const TIME_ENTRY_SOURCE_LABEL: Record<string, string> = {
  manual: "Manual",
  timer: "Cronômetro",
  api: "API",
  integration: "Integração",
  import: "Importação",
};

/** Jornada base de referência (horas por dia útil). */
export const BASE_DAILY_HOURS = 8;

/** "09:00" ou "09:00:00" → minutos desde a meia-noite. Retorna null se inválido. */
export function parseClock(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** minutos desde a meia-noite → "09:00". */
export function formatClock(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Duração entre dois horários do dia, em minutos. null quando inválida. */
export function durationMinutes(
  start: string | null | undefined,
  end: string | null | undefined,
): number | null {
  const s = parseClock(start);
  const e = parseClock(end);
  if (s === null || e === null) return null;
  if (e <= s) return null;
  return e - s;
}

/** 210 → "3h30". */
export function formatMinutes(minutes: number | null | undefined): string {
  const total = Math.max(0, Math.round(minutes ?? 0));
  return `${Math.floor(total / 60)}h${String(total % 60).padStart(2, "0")}`;
}

/** Horas decimais → minutos inteiros. */
export function hoursToMinutes(hours: number | null | undefined): number {
  return Math.max(0, Math.round((hours ?? 0) * 60));
}

/** true quando a data (YYYY-MM-DD) cai em dia útil (seg–sex). */
export function isWorkday(isoDate: string): boolean {
  const day = new Date(`${isoDate}T12:00:00`).getDay();
  return day >= 1 && day <= 5;
}

export type AllocationSlice = {
  allocation_pct: number | null;
  starts_at: string | null;
  ends_at: string | null;
};

/**
 * Meta de horas de um dia, derivada das alocações vigentes do profissional.
 * Soma os percentuais das alocações ativas naquela data, limitada à jornada base.
 * Sem alocação vigente em dia útil, assume a jornada base.
 */
export function expectedMinutesForDate(isoDate: string, allocations: AllocationSlice[]): number {
  if (!isWorkday(isoDate)) return 0;
  const active = allocations.filter(
    (a) => (!a.starts_at || a.starts_at <= isoDate) && (!a.ends_at || a.ends_at >= isoDate),
  );
  if (active.length === 0) return BASE_DAILY_HOURS * 60;
  const pct = active.reduce((acc, a) => acc + (a.allocation_pct ?? 100), 0);
  const capped = Math.min(100, Math.max(0, pct));
  return Math.round((BASE_DAILY_HOURS * 60 * capped) / 100);
}

/** Meta acumulada de um intervalo de datas (inclusive). */
export function expectedMinutesForRange(
  from: string,
  to: string,
  allocations: AllocationSlice[],
): number {
  let total = 0;
  for (const d of eachIsoDate(from, to)) total += expectedMinutesForDate(d, allocations);
  return total;
}

/** Lista de datas YYYY-MM-DD entre `from` e `to`, inclusive. */
export function eachIsoDate(from: string, to: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** Detecta sobreposição com apontamentos já existentes no mesmo dia. */
export function findOverlap(
  entries: { id?: string; start_time: string | null; end_time: string | null }[],
  candidate: { id?: string; start_time: string; end_time: string },
): { start_time: string; end_time: string } | null {
  const cs = parseClock(candidate.start_time);
  const ce = parseClock(candidate.end_time);
  if (cs === null || ce === null) return null;
  for (const e of entries) {
    if (candidate.id && e.id === candidate.id) continue;
    const s = parseClock(e.start_time);
    const en = parseClock(e.end_time);
    if (s === null || en === null) continue;
    if (s < ce && en > cs) return { start_time: formatClock(s), end_time: formatClock(en) };
  }
  return null;
}
