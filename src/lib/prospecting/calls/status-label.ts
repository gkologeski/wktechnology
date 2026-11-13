// Situação da campanha de ligação em PT-BR (lista e ficha).
export const CALL_CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  running: "Em andamento",
  paused: "Pausada",
  done: "Concluída",
  canceled: "Cancelada",
};
export function callCampaignStatusLabel(s: string): string {
  return CALL_CAMPAIGN_STATUS_LABEL[s] ?? s;
}

export type CallCampaignChecklist = { key: string; label: string; ok: boolean; hint: string }[];

/** Itens obrigatórios para Iniciar; pós-ligação é opcional. */
export function callCampaignChecklist(i: {
  hasAudience: boolean;
  variants: { script_id: string; weight: number }[];
  weighted: boolean;
  days: number[];
  start: string;
  end: string;
  meeting?: {
    meeting_assignment_mode: string;
    meeting_member_ids: string[];
    meeting_template_name: string | null;
  };
}): CallCampaignChecklist {
  const withScript = i.variants.filter((v) => v.script_id);
  const sum = withScript.reduce((s, v) => s + v.weight, 0);
  return [
    {
      key: "audience",
      label: "Público definido",
      ok: i.hasAudience,
      hint: "Escolha quem vai receber as ligações no passo 1.",
    },
    {
      key: "scripts",
      label: i.weighted ? "Roteiros com pesos somando 100%" : "Ao menos um roteiro",
      ok: withScript.length > 0 && (!i.weighted || sum === 100),
      hint:
        withScript.length === 0
          ? "Adicione um roteiro no passo 2."
          : `Os pesos somam ${sum}%; ajuste para 100%.`,
    },
    {
      key: "schedule",
      label: "Agenda de discagem válida",
      ok: i.days.length > 0 && i.start < i.end,
      hint: "Escolha ao menos um dia e um horário de início antes do fim no passo 3.",
    },
    ...(i.meeting && i.meeting.meeting_assignment_mode !== "unassigned"
      ? [
          {
            key: "meetings",
            label: "Distribuição das reuniões completa",
            ok:
              !!i.meeting.meeting_template_name &&
              (i.meeting.meeting_assignment_mode === "auto" ||
                (i.meeting.meeting_assignment_mode === "member"
                  ? i.meeting.meeting_member_ids.length === 1
                  : i.meeting.meeting_member_ids.length >= 2)),
            hint: "No passo 4, escolha quem recebe as reuniões e o modelo com o link.",
          },
        ]
      : []),
  ];
}

/** Edição só em rascunho ou pausada. */
export function canEditCallCampaign(status: string): boolean {
  return status === "draft" || status === "paused";
}
/** Exclusão bloqueada enquanto em andamento. */
export function canDeleteCallCampaign(status: string): boolean {
  return status !== "running";
}
/** Encerrar (cancelar) vale para rascunho, em andamento ou pausada. */
export function canCancelCallCampaign(status: string): boolean {
  return status === "draft" || status === "running" || status === "paused";
}

export type CallCampaignStats = {
  done: number;
  failed: number;
  pending: number;
  total: number;
  startedAt: string | null;
  /** Próxima tentativa na fila (scheduled_at mais cedo). */
  nextAt: string | null;
};
const FAILED = new Set(["failed", "no_answer", "busy"]);
const PENDING = new Set(["queued", "ringing", "in_progress"]);

export function summarizeCallAttempts(
  rows: { campaign_id: string; status: string; created_at: string; scheduled_at?: string | null }[],
): Map<string, CallCampaignStats> {
  const out = new Map<string, CallCampaignStats>();
  for (const r of rows) {
    const s = out.get(r.campaign_id) ?? {
      done: 0,
      failed: 0,
      pending: 0,
      total: 0,
      startedAt: null,
      nextAt: null,
    };
    s.total++;
    if (r.status === "completed") s.done++;
    else if (FAILED.has(r.status)) s.failed++;
    else if (PENDING.has(r.status)) s.pending++;
    if (!s.startedAt || r.created_at < s.startedAt) s.startedAt = r.created_at;
    if (r.status === "queued") {
      const at = r.scheduled_at ?? r.created_at;
      if (!s.nextAt || at < s.nextAt) s.nextAt = at;
    }
    out.set(r.campaign_id, s);
  }
  return out;
}

export type DialingWindow = { start: string; end: string; timezone: string; days: number[] };
export type CallPace =
  | { kind: "none"; label: string }
  | { kind: "estimate"; nextAt: Date; endAt: Date };

/** Ritmo do discador: rodada a cada 2 min, até 10 ligações por rodada. */
export const DIAL_TICK_MINUTES = 2;
export const DIAL_TICK_BATCH = 10;

function localParts(d: Date, tz: string): { day: number; minutes: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz || "America/Sao_Paulo",
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = fmt.formatToParts(d);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
  return { day, minutes: h * 60 + m };
}
function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
export function insideDialingWindow(d: Date, win: DialingWindow | null): boolean {
  if (!win) return true;
  const { day, minutes } = localParts(d, win.timezone);
  return win.days.includes(day) && minutes >= toMin(win.start) && minutes < toMin(win.end);
}

/** Estimativa de próxima ligação e término; pura, para lista e ficha. */
export function estimateCallPace(i: {
  status: string;
  pending: number;
  nextAt: string | null;
  window: DialingWindow | null;
  now: Date;
}): CallPace {
  if (i.status === "paused") return { kind: "none", label: "Pausada — sem previsão" };
  if (i.status !== "running") return { kind: "none", label: "" };
  if (i.pending <= 0) return { kind: "none", label: "Sem ligações na fila" };
  if (i.window && i.window.days.length === 0)
    return { kind: "none", label: "Agenda sem dias de discagem" };
  const step = DIAL_TICK_MINUTES * 60_000;
  let t = Math.max(i.now.getTime(), i.nextAt ? new Date(i.nextAt).getTime() : 0);
  let remaining = i.pending;
  let first: Date | null = null;
  const limit = t + 120 * 24 * 60 * 60_000;
  while (remaining > 0 && t < limit) {
    const d = new Date(t);
    if (insideDialingWindow(d, i.window)) {
      if (!first) first = d;
      remaining -= DIAL_TICK_BATCH;
      if (remaining <= 0) return { kind: "estimate", nextAt: first, endAt: d };
    }
    t += step;
  }
  return { kind: "none", label: "Sem previsão (mais de 120 dias)" };
}
