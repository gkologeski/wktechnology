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
