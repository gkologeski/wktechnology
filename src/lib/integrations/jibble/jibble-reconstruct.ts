// Reconstrução de intervalos a partir dos eventos brutos do Jibble (TimeEntries). Puro.
//
// No Jibble cada registro é um EVENTO (In/Out e, quando houver, pausa), não um intervalo.
// Regras (por pessoa, em ordem de instante UTC):
// - empate no mesmo instante: Out → Pausa → In → desconhecido, depois pelo id (determinístico);
// - In com intervalo aberto = troca de projeto/atividade: fecha o atual e abre outro;
// - Out fecha; Out sem intervalo aberto vira "saída órfã" para revisão (nada é inventado);
// - pausa fecha o trabalho e abre um intervalo de pausa (paga/não paga); o próximo In a encerra;
// - evento arquivado (excluído no Jibble) fica no staging mas não entra na reconstrução;
// - intervalo sem saída fica ABERTO no staging, sem fim inventado.
import { isValidTimeZone, segmentByLocalDay, type DaySegment } from "../clockify/clockify-time";

export type JbTimeEntry = {
  id: string;
  type?: string | null;
  time?: string | null;
  localTime?: string | null;
  belongsToDate?: string | null;
  personId?: string | null;
  projectId?: string | null;
  activityId?: string | null;
  locationId?: string | null;
  note?: string | null;
  status?: string | null;
  // Campos de pausa: não documentados na coleção pública; aceitos quando existirem.
  isBreak?: boolean | null;
  breakId?: string | null;
  isPaidBreak?: boolean | null;
  breakType?: string | null;
};

export type IntervalReason =
  | "open_interval"
  | "long_interval"
  | "zero_length"
  | "no_project"
  | "offset_changed";

export type EventAnomaly = {
  eventId: string;
  reason: "orphan_out" | "orphan_break" | "unknown_event" | "invalid_time" | "duplicate_break";
};

export type JbInterval = {
  id: string;
  personId: string;
  kind: "work" | "break";
  paid: boolean | null;
  startEventId: string;
  endEventId: string | null;
  startUtc: number;
  endUtc: number | null;
  seconds: number | null;
  projectId: string | null;
  activityId: string | null;
  locationId: string | null;
  note: string | null;
  endNote: string | null;
  startOffset: string | null;
  endOffset: string | null;
  belongsToDate: string | null;
  status: "ready" | "open" | "pending_review" | "skipped";
  reasons: IntervalReason[];
};

export type ReconstructResult = {
  intervals: JbInterval[];
  anomalies: EventAnomaly[];
  archivedEvents: number;
};

export type ReconstructOptions = {
  /** Pausa paga por padrão quando o evento não informa (vem da jornada do Jibble). */
  defaultBreakPaid?: boolean | null;
  /** Intervalo maior que isto vai para revisão (provável saída esquecida). */
  maxSeconds?: number;
};

type Kind = "in" | "out" | "break" | "unknown";

export function eventKind(e: JbTimeEntry): Kind {
  const t = (e.type ?? "").trim().toLowerCase();
  if (t === "break" || t === "breakstart" || t === "break_start") return "break";
  if (t === "out" && (e.isBreak === true || !!e.breakId)) return "break";
  if (t === "in") return "in";
  if (t === "out") return "out";
  return "unknown";
}

const RANK: Record<Kind, number> = { out: 0, break: 1, in: 2, unknown: 3 };

/** Milissegundos UTC; ordena com precisão total e grava em segundos inteiros. */
function epochMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

export function offsetOf(localTime: string | null | undefined): string | null {
  const m = /([+-]\d{2}:\d{2}|Z)$/.exec(localTime ?? "");
  return m ? (m[1] === "Z" ? "+00:00" : m[1]) : null;
}

export function sortEvents(events: JbTimeEntry[]): JbTimeEntry[] {
  return [...events].sort((a, b) => {
    const ta = epochMs(a.time) ?? Number.MAX_SAFE_INTEGER;
    const tb = epochMs(b.time) ?? Number.MAX_SAFE_INTEGER;
    if (ta !== tb) return ta - tb;
    const r = RANK[eventKind(a)] - RANK[eventKind(b)];
    if (r !== 0) return r;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

function isArchived(e: JbTimeEntry) {
  return (e.status ?? "").toLowerCase() === "archived";
}

export function reconstructIntervals(
  personId: string,
  events: JbTimeEntry[],
  opts: ReconstructOptions = {},
): ReconstructResult {
  const maxSeconds = opts.maxSeconds ?? 16 * 3600;
  const intervals: JbInterval[] = [];
  const anomalies: EventAnomaly[] = [];
  let archivedEvents = 0;
  let open: { kind: "work" | "break"; ev: JbTimeEntry; ms: number; paid: boolean | null } | null =
    null;

  const close = (end: JbTimeEntry | null, endMs: number | null) => {
    if (!open) return;
    const s = open.ev;
    const startUtc = Math.round(open.ms / 1000);
    const endUtc = endMs == null ? null : Math.round(endMs / 1000);
    const seconds = endUtc == null ? null : endUtc - startUtc;
    const reasons: IntervalReason[] = [];
    let status: JbInterval["status"] = "ready";
    if (endUtc == null) {
      reasons.push("open_interval");
      status = "open";
    } else if (seconds! <= 0) {
      reasons.push("zero_length");
      status = "skipped";
    } else if (seconds! > maxSeconds) {
      reasons.push("long_interval");
      status = "pending_review";
    }
    if (open.kind === "work" && !s.projectId) {
      reasons.push("no_project");
      if (status === "ready") status = "pending_review";
    }
    const so = offsetOf(s.localTime);
    const eo = end ? offsetOf(end.localTime) : null;
    if (so && eo && so !== eo) reasons.push("offset_changed");
    intervals.push({
      id: s.id,
      personId,
      kind: open.kind,
      paid: open.kind === "break" ? open.paid : null,
      startEventId: s.id,
      endEventId: end?.id ?? null,
      startUtc,
      endUtc,
      seconds,
      projectId: open.kind === "work" ? (s.projectId ?? null) : null,
      activityId: open.kind === "work" ? (s.activityId ?? null) : null,
      locationId: s.locationId ?? null,
      note: s.note?.trim() || null,
      endNote: end?.note?.trim() || null,
      startOffset: so,
      endOffset: eo,
      belongsToDate: s.belongsToDate ?? null,
      status,
      reasons,
    });
    open = null;
  };

  for (const ev of sortEvents(events)) {
    if (isArchived(ev)) {
      archivedEvents++;
      continue;
    }
    const ms = epochMs(ev.time);
    if (ms == null) {
      anomalies.push({ eventId: ev.id, reason: "invalid_time" });
      continue;
    }
    const k = eventKind(ev);
    if (k === "in") {
      close(ev, ms);
      open = { kind: "work", ev, ms, paid: null };
    } else if (k === "out") {
      if (open) close(ev, ms);
      else anomalies.push({ eventId: ev.id, reason: "orphan_out" });
    } else if (k === "break") {
      if (open?.kind === "work") {
        close(ev, ms);
        const paid =
          ev.isPaidBreak ??
          (ev.breakType ? ev.breakType.toLowerCase() === "paid" : (opts.defaultBreakPaid ?? null));
        open = { kind: "break", ev, ms, paid };
      } else if (open?.kind === "break") {
        anomalies.push({ eventId: ev.id, reason: "duplicate_break" });
      } else {
        anomalies.push({ eventId: ev.id, reason: "orphan_break" });
      }
    } else {
      anomalies.push({ eventId: ev.id, reason: "unknown_event" });
    }
  }
  close(null, null);
  return { intervals, anomalies, archivedEvents };
}

/** "+04:00" → minutos. */
export function offsetMinutes(offset: string | null | undefined): number | null {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(offset ?? "");
  if (!m) return null;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Divide por dia civil com deslocamento fixo (quando a pessoa não tem fuso IANA válido). */
export function segmentByFixedOffset(
  startUtc: number,
  endUtc: number,
  offMin: number,
): DaySegment[] {
  if (!(endUtc > startUtc)) return [];
  const out: DaySegment[] = [];
  const shift = offMin * 60;
  let cur = startUtc;
  while (cur < endUtc && out.length < 400) {
    const local = cur + shift;
    const dayStartLocal = Math.floor(local / 86400) * 86400;
    const boundary = dayStartLocal + 86400 - shift;
    const segEnd = Math.min(boundary, endUtc);
    const d = new Date(local * 1000);
    const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
    let endTime = "24:00:00";
    if (segEnd !== boundary) {
      const e = new Date((segEnd + shift) * 1000);
      endTime = `${pad(e.getUTCHours())}:${pad(e.getUTCMinutes())}:${pad(e.getUTCSeconds())}`;
    }
    const seconds = segEnd - cur;
    out.push({
      index: out.length,
      localDate: date,
      startTime: time,
      endTime,
      startUtc: cur,
      endUtc: segEnd,
      seconds,
      wallSeconds: seconds,
      dstMismatch: false,
    });
    cur = segEnd;
  }
  return out;
}

/**
 * Segmentos por dia civil: fuso IANA da pessoa quando válido (trata DST); senão o
 * deslocamento registrado no evento de entrada. A soma dos segundos é sempre a do intervalo.
 */
export function segmentInterval(iv: JbInterval, timeZone: string | null): DaySegment[] {
  if (iv.endUtc == null) return [];
  if (isValidTimeZone(timeZone)) return segmentByLocalDay(iv.startUtc, iv.endUtc, timeZone);
  return segmentByFixedOffset(iv.startUtc, iv.endUtc, offsetMinutes(iv.startOffset) ?? 0);
}
