import type { SequenceDefinition, SequenceStep } from "./draft";
export type ExecutionState =
  | "active"
  | "waiting_task"
  | "paused"
  | "cancelled"
  | "completed"
  | "human"
  | "agent"
  | "blocked"
  | "uncertain";
export type ExecutionSignals = {
  optedOut: boolean;
  commercialBlock?: string | null;
  replied: boolean;
  previousReplied: boolean;
  previousContactExists?: boolean;
  responseAgentId?: string | null;
  meetingBooked: boolean;
  callAnswered: boolean;
  hasPhone: boolean;
  callResultKnown?: boolean;
  hasEmail: boolean;
  hasWhatsApp: boolean;
  /** Número do cadastro bloqueado por recusa da Meta (131026/131049): etapa pulada com esse motivo. */
  whatsAppSuppressed?: "no_whatsapp" | "engagement_limit" | null;
};
export type ExecutionDecision =
  | { kind: "stop"; state: ExecutionState; reason: string; agentId?: string }
  | { kind: "advance"; nextStep: number; dueAt: string; reason: string }
  | { kind: "effect"; step: SequenceStep; key: string };
const minute = 60_000;
function localParts(at: Date, zone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (key: string) => Number(parts.find((p) => p.type === key)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}
/** Calendar arithmetic uses local civil days, never a fixed UTC offset. */
export function waitUntil(
  at: Date,
  step: Extract<SequenceStep, { type: "wait" }>,
  settings: SequenceDefinition["settings"],
): Date {
  if (!Number.isFinite(at.getTime())) throw new Error("Data de referência inválida.");
  if (step.unit === "minutes") return new Date(at.getTime() + step.duration * minute);
  if (step.unit === "hours") return new Date(at.getTime() + step.duration * 60 * minute);
  const p = localParts(at, settings.timezone);
  const calendar = new Date(Date.UTC(p.year, p.month - 1, p.day));
  let remaining = step.duration;
  while (remaining) {
    calendar.setUTCDate(calendar.getUTCDate() + 1);
    if (step.unit === "days" || settings.businessDays.includes(calendar.getUTCDay())) remaining--;
  }
  const desired = Date.UTC(
    calendar.getUTCFullYear(),
    calendar.getUTCMonth(),
    calendar.getUTCDate(),
    p.hour,
    p.minute,
  );
  // Resolve gaps by choosing the first local minute after the requested civil time.
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: settings.timezone,
    dateStyle: "short",
    timeStyle: "short",
    hourCycle: "h23",
  });
  const target = `${calendar.toISOString().slice(0, 10)} ${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
  let best: Date | null = null;
  let bestLabel = "";
  for (let t = desired - 18 * 60 * minute; t <= desired + 18 * 60 * minute; t += minute) {
    const candidate = new Date(t),
      label = formatter.format(candidate);
    if (label === target) return candidate;
    if (label > target && (!best || label < bestLabel)) {
      best = candidate;
      bestLabel = label;
    }
  }
  if (!best) throw new Error("Não foi possível resolver o fuso da espera.");
  return best;
}
export function nextBusinessInstant(at: Date, settings: SequenceDefinition["settings"]): Date {
  if (!Number.isFinite(at.getTime()) || !settings.businessDays.length)
    throw new Error("Expediente inválido.");
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: settings.timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  // Preserve seconds when already inside the window; otherwise align to the next minute.
  let t = at.getTime();
  for (let i = 0; i <= 8 * 24 * 60; i++) {
    const p = formatter.formatToParts(new Date(t));
    const value = (key: string) => p.find((v) => v.type === key)?.value ?? "";
    const clock = `${value("hour")}:${value("minute")}`;
    if (
      settings.businessDays.includes(weekdays.indexOf(value("weekday"))) &&
      clock >= settings.start &&
      clock < settings.end
    )
      return new Date(t);
    t = Math.floor(t / minute) * minute + minute;
  }
  throw new Error("Nenhum expediente encontrado nos próximos oito dias.");
}
/** Pure planner. Effects require a durable reservation and a fresh authorization outside this function. */
export function decideExecution(input: {
  runId: string;
  state: ExecutionState;
  cursor: number;
  definition: SequenceDefinition;
  signals: ExecutionSignals;
  now: Date;
  previousAt: Date | null;
}): ExecutionDecision {
  const { definition: d, signals: s, cursor, now } = input;
  const stop = (state: ExecutionState, reason: string, agentId?: string): ExecutionDecision => ({
    kind: "stop",
    state,
    reason,
    ...(agentId ? { agentId } : {}),
  });
  if (input.state !== "active") return stop(input.state, "not_active");
  if (s.optedOut) return stop("blocked", "opt_out");
  if (s.commercialBlock) return stop("blocked", s.commercialBlock);
  if (s.meetingBooked && d.settings.stopOnMeeting) return stop("completed", "meeting_booked");
  const step = d.steps[cursor];
  const previousOutreach = d.steps
    .slice(0, cursor)
    .reverse()
    .find((s) => s.type === "email" || s.type === "whatsapp");
  const responseAgent =
    s.responseAgentId !== undefined
      ? s.responseAgentId
      : (previousOutreach?.type === "whatsapp" ? previousOutreach.agentId : null) ||
        d.settings.agentId;
  if (s.replied && d.settings.stopOnReply) {
    const agentId = responseAgent;
    if (step?.type === "wait" && step.onReply === "human") return stop("human", "reply");
    return agentId ? stop("agent", "reply", agentId) : stop("human", "reply");
  }
  if (!step) return stop("completed", "sequence_finished");
  const next = (due: Date, reason: string): ExecutionDecision => ({
    kind: "advance",
    nextStep: cursor + 1,
    dueAt: due.toISOString(),
    reason,
  });
  if (step.type === "end") return stop("completed", step.reason || "sequence_finished");
  if (step.type === "agent")
    return step.agentId
      ? stop("agent", "agent_step", step.agentId)
      : stop("blocked", "agent_missing");
  if (step.type === "wait") {
    if (step.source === "previous" && s.previousContactExists === false)
      return next(now, "previous_contact_skipped");
    if (step.source === "any" ? s.replied : s.previousReplied)
      return step.onReply === "human"
        ? stop("human", "reply")
        : responseAgent
          ? stop("agent", "reply", responseAgent)
          : stop("blocked", "agent_missing");
    if (!input.previousAt) return stop("blocked", "wait_without_reference");
    const due = waitUntil(input.previousAt, step, d.settings);
    return due.getTime() > now.getTime()
      ? { kind: "advance", nextStep: cursor, dueAt: due.toISOString(), reason: "wait" }
      : next(now, "wait_elapsed");
  }
  if (step.type === "condition") {
    if (step.criteria === "call_answered" && s.callResultKnown === false)
      return stop("blocked", "call_outcome_unknown");
    const conditions = {
      replied: s.replied,
      has_email: s.hasEmail,
      has_whatsapp: s.hasWhatsApp,
      call_answered: s.callAnswered,
      meeting_booked: s.meetingBooked,
    };
    const branch = conditions[step.criteria] ? step.yes : step.no;
    if (branch === "next") return next(now, "condition_next");
    if (branch === "agent")
      return d.settings.agentId
        ? stop("agent", "condition", d.settings.agentId)
        : stop("blocked", "agent_missing");
    return stop(branch === "end" ? "completed" : "human", "condition");
  }
  if (step.type === "email" && !s.hasEmail) return next(now, "missing_email");
  if (step.type === "whatsapp" && !s.hasWhatsApp)
    return next(
      now,
      s.whatsAppSuppressed === "no_whatsapp"
        ? "whatsapp_suppressed_no_whatsapp"
        : s.whatsAppSuppressed === "engagement_limit"
          ? "whatsapp_suppressed_engagement"
          : "missing_whatsapp",
    );
  if (step.type === "call" && !s.hasPhone) return next(now, "missing_phone");
  const due = nextBusinessInstant(now, d.settings);
  if (due.getTime() > now.getTime())
    return {
      kind: "advance",
      nextStep: cursor,
      dueAt: due.toISOString(),
      reason: "outside_business_hours",
    };
  return { kind: "effect", step, key: `${input.runId}:${step.id}` };
}

/** Only trusted adapter checks before invoking a transport may use this error. */
export class SequenceNotStartedError extends Error {
  constructor(public readonly code: "source_changed_before_send" | "sender_changed_before_send") {
    super(code);
  }
}
