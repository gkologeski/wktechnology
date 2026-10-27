/**
 * Rótulos e contagens da Operação do Agente SDR. Somente apresentação: não
 * lê dados nem verifica permissões; recebe o que o servidor já autorizou.
 */

export type SdrTone = "open" | "onhold" | "closed" | "draft";

/** Situações do atendimento que podem ser filtradas na lista. */
export const ENROLLMENT_FILTERS = ["active", "paused", "handoff", "opted_out"] as const;
export type EnrollmentFilter = (typeof ENROLLMENT_FILTERS)[number];

const STATUS: Record<string, { label: string; tone: SdrTone }> = {
  active: { label: "Em conversa", tone: "open" },
  paused: { label: "Pausado", tone: "onhold" },
  handoff: { label: "Com humano", tone: "onhold" },
  opted_out: { label: "Recusou", tone: "closed" },
  canceled: { label: "Cancelado", tone: "draft" },
  completed: { label: "Concluído", tone: "draft" },
};

/** Situação do atendimento em português; valor desconhecido vira "Outra situação". */
export function enrollmentStatusDisplay(status: string | null | undefined): {
  label: string;
  tone: SdrTone;
} {
  return STATUS[status ?? ""] ?? { label: "Outra situação", tone: "draft" };
}

/** Rótulo do filtro (plural, para os botões). */
export const FILTER_LABELS: Record<EnrollmentFilter, string> = {
  active: "Em conversa",
  paused: "Pausados",
  handoff: "Com humano",
  opted_out: "Recusaram",
};

export function parseEnrollmentFilter(value: unknown): EnrollmentFilter | undefined {
  return typeof value === "string" && (ENROLLMENT_FILTERS as readonly string[]).includes(value)
    ? (value as EnrollmentFilter)
    : undefined;
}

const STAGE: Record<string, string> = {
  awaiting_reply: "Aguardando resposta",
  discovery: "Descoberta",
  qualified: "Qualificado",
  material_sent: "Material enviado",
  meeting_link_sent: "Link de agenda enviado",
  meeting_booked: "Reunião marcada",
  handoff: "Com humano",
  opted_out: "Recusou",
  closed: "Encerrado",
};

/** Etapa comercial em português; vazia ou desconhecida vira "—". */
export function commercialStageLabel(stage: string | null | undefined): string {
  return STAGE[stage ?? ""] ?? "—";
}

/** Nome exibido do contato; sem nome legível (ou sem acesso) mostra o telefone. */
export function enrollmentDisplayName(
  person: { first_name?: string | null; last_name?: string | null } | null | undefined,
  phone: string | null | undefined,
): string {
  const name = [person?.first_name, person?.last_name]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");
  if (name) return name;
  return phone?.trim() || "Contato sem nome";
}

/** Fila da Supervisão: rascunhos a revisar, falhas a resolver e o resto em andamento. */
export function supervisionCounts(jobs: ReadonlyArray<{ status: string | null }>): {
  toReview: number;
  failed: number;
  processing: number;
} {
  let toReview = 0;
  let failed = 0;
  for (const j of jobs) {
    if (j.status === "drafted") toReview++;
    else if (j.status === "failed") failed++;
  }
  return { toReview, failed, processing: jobs.length - toReview - failed };
}

/* ----- Resultados ----- */

export type SdrResultTotals = {
  started: number;
  replied: number;
  qualified: number;
  meetingProposed: number;
  meetingConfirmed: number;
};

export type FunnelStep = {
  key: keyof SdrResultTotals;
  label: string;
  hint: string;
  value: number;
  /** Percentual sobre as conversas iniciadas (0–100, inteiro); null sem conversas. */
  pct: number | null;
  /** Percentual para exibir: "—" sem conversas e "<1%" quando há casos mas arredonda a zero. */
  pctLabel: string;
};

const FUNNEL: ReadonlyArray<{ key: keyof SdrResultTotals; label: string; hint: string }> = [
  { key: "started", label: "Conversas iniciadas", hint: "Atendimentos criados no período" },
  { key: "replied", label: "Responderam", hint: "O cliente enviou ao menos uma mensagem" },
  {
    key: "qualified",
    label: "Qualificados",
    hint: "Qualificação concluída como qualificado ou agendado",
  },
  {
    key: "meetingProposed",
    label: "Reunião proposta",
    hint: "Horário oferecido, link enviado ou reunião marcada",
  },
  { key: "meetingConfirmed", label: "Reunião confirmada", hint: "Evento confirmado na agenda" },
];

/** Etapas do funil com percentual sobre as conversas iniciadas. */
export function buildSdrFunnel(t: SdrResultTotals): FunnelStep[] {
  return FUNNEL.map((s) => {
    const value = t[s.key];
    const pct = t.started > 0 ? Math.round((value / t.started) * 100) : null;
    const pctLabel = pct == null ? "—" : pct === 0 && value > 0 ? "<1%" : `${pct}%`;
    return { ...s, value, pct, pctLabel };
  });
}

const MEETING_STATUS: Record<string, { label: string; tone: SdrTone }> = {
  confirmed: { label: "Confirmada", tone: "open" },
  rescheduled: { label: "Remarcada", tone: "onhold" },
  pending: { label: "Pendente", tone: "onhold" },
  reserved: { label: "Reservada", tone: "onhold" },
  canceled: { label: "Cancelada", tone: "closed" },
  failed: { label: "Falhou", tone: "closed" },
  link_sent: { label: "Link enviado", tone: "onhold" },
  pending_sync: { label: "Aguardando Google", tone: "onhold" },
  sync_failed: { label: "Falha no Google", tone: "closed" },
};

/** Situação da reunião em português; valor desconhecido vira "Outra situação". */
export function meetingStatusDisplay(status: string | null | undefined): {
  label: string;
  tone: SdrTone;
} {
  return MEETING_STATUS[status ?? ""] ?? { label: "Outra situação", tone: "draft" };
}

const DECISION: Record<string, string> = {
  pending: "Pendente",
  qualified: "Qualificado",
  disqualified: "Desqualificado",
  nurture: "Nutrição",
  scheduled: "Agendado",
};

export function qualificationDecisionLabel(decision: string | null | undefined): string {
  return DECISION[decision ?? ""] ?? "Outra decisão";
}

/** Data e hora da reunião no fuso dela (padrão São Paulo), ex.: "22/10/2026 15:00". */
export function formatMeetingTime(
  iso: string | null | undefined,
  timeZone?: string | null,
): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const opts: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timeZone || "America/Sao_Paulo",
  };
  try {
    return d.toLocaleString("pt-BR", opts).replace(",", "");
  } catch {
    return d.toLocaleString("pt-BR", { ...opts, timeZone: "America/Sao_Paulo" }).replace(",", "");
  }
}
