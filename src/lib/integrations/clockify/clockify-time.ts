// Tempo do Clockify → TechProjects. Puro e client-safe.
// Regras: instantes UTC e segundos são a fonte da verdade. A divisão por dia usa o
// fuso IANA da pessoa, nunca altera o total de segundos e trata meia-noite e DST.

/** "PT1H30M15S", "P1DT2H", "PT0S" → segundos. null quando inválido. */
export function parseIsoDuration(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(value.trim());
  if (!m || value.trim() === "P" || value.trim() === "PT") return null;
  const [, d, h, mi, s] = m;
  return (
    Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(mi ?? 0) * 60 + Math.round(Number(s ?? 0))
  );
}

/** ISO UTC → segundos inteiros desde a época (Clockify usa precisão de segundos). */
export function toEpochSeconds(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? Math.round(ms / 1000) : null;
}

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    fmtCache.set(tz, f);
  }
  return f;
}

/** Data e hora locais (YYYY-MM-DD, HH:MM:SS) de um instante em segundos. */
export function localParts(epochSeconds: number, tz: string): { date: string; time: string } {
  const parts = formatter(tz).formatToParts(new Date(epochSeconds * 1000));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${hour}:${get("minute")}:${get("second")}`,
  };
}

function clockToSeconds(hms: string): number {
  const [h, m, s] = hms.split(":").map(Number);
  return h * 3600 + m * 60 + (s ?? 0);
}

/** Primeiro instante (segundos) cuja data local é posterior à data local de `t`. */
export function nextLocalDayStart(t: number, tz: string): number {
  const here = localParts(t, tz);
  const day = here.date;
  // Caminho rápido: sem transição de fuso no dia, a virada fica no fim do relógio local.
  const guess = t + (86400 - clockToSeconds(here.time));
  if (localParts(guess, tz).date !== day && localParts(guess - 1, tz).date === day) return guess;
  // Transição de DST: busca binária ao segundo.
  let lo = t;
  let hi = t + 27 * 3600; // nenhum dia civil passa de 25 h
  while (localParts(hi, tz).date === day) hi += 3600;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (localParts(mid, tz).date === day) lo = mid;
    else hi = mid;
  }
  return hi;
}

export type DaySegment = {
  index: number;
  localDate: string;
  /** HH:MM:SS local no início do segmento. */
  startTime: string;
  /** HH:MM:SS local no fim; "24:00:00" quando termina na virada do dia. */
  endTime: string;
  startUtc: number;
  endUtc: number;
  /** Segundos reais (instantes UTC). */
  seconds: number;
  /** Segundos pelo relógio de parede local (diferem dos reais em transições de DST). */
  wallSeconds: number;
  dstMismatch: boolean;
};

/** Divide [start, end) em segmentos por dia civil no fuso. Soma dos segundos = end - start. */
export function segmentByLocalDay(startUtc: number, endUtc: number, tz: string): DaySegment[] {
  if (!(endUtc > startUtc)) return [];
  const out: DaySegment[] = [];
  let cur = startUtc;
  while (cur < endUtc && out.length < 400) {
    const boundary = nextLocalDayStart(cur, tz);
    const segEnd = Math.min(boundary, endUtc);
    const s = localParts(cur, tz);
    const endsAtBoundary = segEnd === boundary;
    const endTime = endsAtBoundary ? "24:00:00" : localParts(segEnd, tz).time;
    const wallSeconds =
      (endsAtBoundary ? 86400 : clockToSeconds(endTime)) - clockToSeconds(s.time);
    const seconds = segEnd - cur;
    out.push({
      index: out.length,
      localDate: s.date,
      startTime: s.time,
      endTime,
      startUtc: cur,
      endUtc: segEnd,
      seconds,
      wallSeconds,
      dstMismatch: wallSeconds !== seconds,
    });
    cur = segEnd;
  }
  return out;
}

/** Minutos que o ERP vai gravar para o segmento (mesma regra do gatilho: arredondamento). */
export function erpMinutesForSegment(seg: DaySegment): number {
  return Math.round((seg.dstMismatch ? seg.seconds : seg.wallSeconds) / 60);
}

export function epochToIso(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toISOString().replace(".000Z", "Z");
}

/** Mês local (YYYY-MM) do segmento, para relatórios por mês. */
export function monthOf(localDate: string): string {
  return localDate.slice(0, 7);
}
