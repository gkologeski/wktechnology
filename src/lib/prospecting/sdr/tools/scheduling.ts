// Cálculo de horários da Lia (puro, sem rede). Fuso IANA explícito, DST
// tratado por conversão em duas passadas, buffers e antecedência do agente.
export const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export type Schedule = {
  timezone: string;
  duration_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  min_notice_hours: number;
  horizon_days: number;
  working_hours: Partial<Record<Weekday, { start: string; end: string }[]>>;
  /** Datas locais (YYYY-MM-DD) sem expediente, ex.: feriados. */
  holidays: string[];
  /** Passo entre inícios possíveis (min). */
  step_minutes?: number;
};
export type Busy = { start: number; end: number };
export type Slot = { start: number; end: number };

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function localParts(ms: number, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  })
    .formatToParts(new Date(ms))
    .reduce<Record<string, string>>((a, p) => {
      if (p.type !== "literal") a[p.type] = p.value;
      return a;
    }, {});
  const wd = parts.weekday.toLowerCase().slice(0, 3) as Weekday;
  return {
    y: +parts.year,
    m: +parts.month,
    d: +parts.day,
    h: +parts.hour % 24,
    mi: +parts.minute,
    wd,
    ymd: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

/** Horário local → instante UTC; duas passadas corrigem a virada de horário de verão. */
export function zonedToUtc(y: number, m: number, d: number, h: number, mi: number, tz: string) {
  const naive = Date.UTC(y, m - 1, d, h, mi);
  const off = (at: number) => {
    const p = localParts(at, tz);
    return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) - Math.floor(at / 60000) * 60000;
  };
  let t = naive - off(naive);
  t = naive - off(t);
  return t;
}

const hhmm = (s: string) => {
  const r = /^(\d{2}):(\d{2})$/.exec(s);
  if (!r) return null;
  const h = +r[1];
  const m = +r[2];
  return h <= 24 && m < 60 ? { h, m } : null;
};

export function parseYmd(s: string) {
  const r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!r) return null;
  const y = +r[1];
  const m = +r[2];
  const d = +r[3];
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return { y, m, d };
}

function addDays(y: number, m: number, d: number, n: number) {
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}
const ymdKey = (p: { y: number; m: number; d: number }) =>
  `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;

export function overlapsBusy(s: Schedule, slot: Slot, busy: Busy[]) {
  const bb = s.buffer_before_minutes * 60000;
  const ba = s.buffer_after_minutes * 60000;
  return busy.some((b) => slot.start - bb < b.end && slot.end + ba > b.start);
}

/** Inícios dentro do expediente, antecedência e horizonte, sem conflito. */
export function generateSlots(
  s: Schedule,
  busy: Busy[],
  now: number,
  range?: { fromYmd?: string; toYmd?: string },
): Slot[] {
  const tz = s.timezone;
  const dur = s.duration_minutes * 60000;
  const step = (s.step_minutes ?? 30) * 60000;
  const minStart = now + s.min_notice_hours * 3600000;
  const maxEnd = now + s.horizon_days * 86400000;
  const today = localParts(now, tz);
  const holidays = new Set(s.holidays);
  const out: Slot[] = [];
  for (let i = 0; i <= s.horizon_days + 1; i++) {
    const day = addDays(today.y, today.m, today.d, i);
    const key = ymdKey(day);
    if (range?.fromYmd && key < range.fromYmd) continue;
    if (range?.toYmd && key > range.toYmd) break;
    if (holidays.has(key)) continue;
    const wd = WEEKDAYS[new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay()];
    for (const w of s.working_hours[wd] ?? []) {
      const a = hhmm(w.start);
      const b = hhmm(w.end);
      if (!a || !b) continue;
      const ws = zonedToUtc(day.y, day.m, day.d, a.h, a.m, tz);
      const we = zonedToUtc(day.y, day.m, day.d, b.h, b.m, tz);
      for (let t = ws; t + dur <= we; t += step) {
        const slot = { start: t, end: t + dur };
        if (t < minStart || slot.end > maxEnd) continue;
        if (!overlapsBusy(s, slot, busy)) out.push(slot);
      }
    }
  }
  return out.sort((x, y) => x.start - y.start);
}

export type DayPart = "morning" | "afternoon" | "evening";
export function dayPart(ms: number, tz: string): DayPart {
  const h = localParts(ms, tz).h;
  return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
}

/**
 * Até N opções em ordem cronológica, distribuídas por turnos e em pelo menos
 * dois dias quando a agenda permite. Nunca inventa: devolve menos se não houver.
 */
export function pickDiverse(slots: Slot[], tz: string, n = 3, exclude: number[] = []): Slot[] {
  const ex = new Set(exclude);
  const pool = slots.filter((s) => !ex.has(s.start));
  const picked: Slot[] = [];
  const keyOf = (s: Slot) => `${localParts(s.start, tz).ymd}:${dayPart(s.start, tz)}`;
  const dayOf = (s: Slot) => localParts(s.start, tz).ymd;
  // 1) turnos distintos; a última vaga prioriza um segundo dia
  for (const s of pool) {
    if (picked.length >= n) break;
    const keys = new Set(picked.map(keyOf));
    if (keys.has(keyOf(s))) continue;
    const days = new Set(picked.map(dayOf));
    const lastSlot = picked.length === n - 1;
    if (lastSlot && days.size === 1 && days.has(dayOf(s))) {
      const otherDay = pool.some((o) => !days.has(dayOf(o)) && !keys.has(keyOf(o)));
      if (otherDay) continue;
    }
    picked.push(s);
  }
  // 2) completa com horários restantes distantes ao menos 1 h dos escolhidos
  for (const s of pool) {
    if (picked.length >= n) break;
    if (picked.some((p) => Math.abs(p.start - s.start) < 3600000)) continue;
    picked.push(s);
  }
  for (const s of pool) {
    if (picked.length >= n) break;
    if (!picked.includes(s)) picked.push(s);
  }
  return picked.sort((a, b) => a.start - b.start);
}

const WD_PT = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];
export function formatSlotPt(ms: number, tz: string): string {
  const p = localParts(ms, tz);
  const wd = WD_PT[WEEKDAYS.indexOf(p.wd)];
  return `${wd}, ${String(p.d).padStart(2, "0")}/${String(p.m).padStart(2, "0")}/${p.y} às ${String(p.h).padStart(2, "0")}:${String(p.mi).padStart(2, "0")}`;
}

export type SpecificRequest = { date: string; time: string | null; timezone: string | null };
export type SpecificResult =
  | { status: "invalid"; reason: string }
  | { status: "free"; slot: Slot }
  | {
      status: "busy" | "outside_hours" | "too_soon" | "beyond_horizon" | "past" | "day_listing";
      alternatives: Slot[];
    };

/** Pedido de data/hora específica: consulta exatamente o intervalo, no fuso do pedido. */
export function evaluateSpecific(
  s: Schedule,
  busy: Busy[],
  now: number,
  req: SpecificRequest,
): SpecificResult {
  const date = parseYmd(req.date);
  if (!date) return { status: "invalid", reason: "Data inválida; use dia, mês e ano completos." };
  const tz = req.timezone ?? s.timezone;
  if (!isValidTimeZone(tz)) return { status: "invalid", reason: "Fuso horário desconhecido." };
  const alternativesFrom = (fromYmd: string) =>
    pickDiverse(generateSlots(s, busy, now, { fromYmd }), s.timezone, 3);
  if (!req.time) {
    const sameDay = generateSlots(s, busy, now, { fromYmd: req.date, toYmd: req.date });
    return {
      status: "day_listing",
      alternatives: sameDay.length
        ? pickDiverse(sameDay, s.timezone, 3)
        : alternativesFrom(req.date),
    };
  }
  const t = hhmm(req.time);
  if (!t) return { status: "invalid", reason: "Horário inválido; use HH:MM." };
  const start = zonedToUtc(date.y, date.m, date.d, t.h, t.m, tz);
  const slot = { start, end: start + s.duration_minutes * 60000 };
  // Converte para o dia local do anfitrião para validar expediente e alternativas.
  const host = localParts(start, s.timezone);
  if (start < now)
    return { status: "past", alternatives: alternativesFrom(ymdKey(localParts(now, s.timezone))) };
  if (start < now + s.min_notice_hours * 3600000)
    return { status: "too_soon", alternatives: alternativesFrom(host.ymd) };
  if (slot.end > now + s.horizon_days * 86400000)
    return { status: "beyond_horizon", alternatives: [] };
  const inHours =
    !s.holidays.includes(host.ymd) &&
    (s.working_hours[host.wd] ?? []).some((w) => {
      const a = hhmm(w.start);
      const b = hhmm(w.end);
      if (!a || !b) return false;
      const ws = zonedToUtc(host.y, host.m, host.d, a.h, a.m, s.timezone);
      const we = zonedToUtc(host.y, host.m, host.d, b.h, b.m, s.timezone);
      return slot.start >= ws && slot.end <= we;
    });
  if (!inHours) return { status: "outside_hours", alternatives: alternativesFrom(host.ymd) };
  if (overlapsBusy(s, slot, busy))
    return { status: "busy", alternatives: alternativesFrom(host.ymd) };
  return { status: "free", slot };
}
