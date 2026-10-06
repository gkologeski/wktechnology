// Regras puras do SDR de IA (sem banco, sem rede) — testáveis isoladamente.
// O servidor aplica estas regras antes de qualquer envio ou escrita no CRM.

export type SdrOffer = {
  id: string;
  offer_key: string;
  parent_key: string | null;
  name: string;
  status: "active" | "inactive";
  approved_at: string | null;
  summary: string;
  fit_signals: string[];
  discovery_questions: string[];
  commercial_notes: string;
  pricing_policy: string;
};

export type SdrMaterial = {
  id: string;
  title: string;
  approved: boolean;
  active: boolean;
  url: string | null;
  offer_ids: string[];
};

export type ConversationMessage = {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  created_at: string;
};

export const SDR_INTENTS = [
  "continue",
  "send_material",
  "schedule_meeting",
  "handoff",
  "opt_out",
] as const;
export type SdrIntent = (typeof SDR_INTENTS)[number];

export const COMMERCIAL_STAGES = [
  "awaiting_reply",
  "discovery",
  "qualified",
  "material_sent",
  "meeting_link_sent",
  "meeting_booked",
  "handoff",
  "opted_out",
  "closed",
] as const;
export type CommercialStage = (typeof COMMERCIAL_STAGES)[number];

/** Nomes que nunca podem ser oferecidos (não são serviços da empresa). */
export const FORBIDDEN_OFFER_NAMES = ["wk sob medida"];

const DEFAULT_OPT_OUT = [
  "pare",
  "parar",
  "sair",
  "cancelar",
  "descadastrar",
  "não quero",
  "nao quero",
  "não tenho interesse",
  "nao tenho interesse",
  "sem interesse",
  "não me mande",
  "nao me mande",
  "remova meu número",
  "remova meu numero",
  "stop",
];

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Recusa/opt-out explícito: encerra a prospecção (não é handoff comercial). */
export function detectOptOut(text: string, extra: string[] = []): boolean {
  const t = ` ${norm(text).replace(/[^\p{L}\p{N} ]/gu, " ")} `;
  return [...DEFAULT_OPT_OUT, ...extra]
    .map((p) => norm(p))
    .filter(Boolean)
    .some((p) => t.includes(` ${p} `) || t.trim() === p);
}

/** Ofertas que o agente pode usar: ativas e aprovadas. */
export function selectableOffers<T extends Pick<SdrOffer, "status" | "approved_at" | "name">>(
  offers: T[],
): T[] {
  return offers.filter(
    (o) =>
      o.status === "active" &&
      !!o.approved_at &&
      !FORBIDDEN_OFFER_NAMES.includes(norm(o.name)),
  );
}

/** Materiais aprovados e ativos, opcionalmente ligados às ofertas escolhidas. */
export function selectableMaterials(materials: SdrMaterial[], offerIds?: string[]): SdrMaterial[] {
  return materials.filter(
    (m) =>
      m.approved &&
      m.active &&
      !!m.url &&
      (!offerIds?.length || m.offer_ids.some((id) => offerIds.includes(id))),
  );
}

/** Hora local (0-23) num fuso. */
export function localHour(date: Date, timeZone: string): number {
  const h = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone }).format(
    date,
  );
  return Number(h) % 24;
}

/** Fora do horário de envio. start/end em horas locais; janela pode cruzar a meia-noite. */
export function isQuietHours(date: Date, timeZone: string, start: number, end: number): boolean {
  if (start === end) return false;
  const h = localHour(date, timeZone);
  return start > end ? h >= start || h < end : h >= start && h < end;
}

/** Chave idempotente isolada por workspace e identidade do provedor. */
export function turnIdemKey(parts: {
  workspaceId: string;
  providerPhoneId: string | null | undefined;
  waMessageId: string;
}): string {
  return `wa:${parts.workspaceId}:${parts.providerPhoneId ?? "default"}:${parts.waMessageId}`;
}

export function followUpIdemKey(enrollmentId: string, count: number): string {
  return `fu:${enrollmentId}:${count}`;
}

export type SendGuardInput = {
  job: { status: string; lease_token: string | null; conversation_version: number | null };
  leaseToken: string;
  conversation: { ai_owner: string | null; ai_version: number };
  enrollment: { status: string };
};

/** Rechecagem antes de enviar: descarta trabalho obsoleto (humano assumiu, versão mudou). */
export function sendGuard(i: SendGuardInput): { ok: true } | { ok: false; reason: string } {
  if (i.job.status !== "running" || i.job.lease_token !== i.leaseToken)
    return { ok: false, reason: "lease_lost" };
  if (i.conversation.ai_owner !== "ai") return { ok: false, reason: "owner_not_ai" };
  if (i.job.conversation_version !== i.conversation.ai_version)
    return { ok: false, reason: "stale_version" };
  if (i.enrollment.status !== "active") return { ok: false, reason: "enrollment_inactive" };
  return { ok: true };
}

export type AgentOutput = {
  reply: string;
  intent: SdrIntent;
  offer_keys: string[];
  material_ids: string[];
  qualification: { field: string; value: string; message_id: string; excerpt: string }[];
  score: number;
  handoff_reason: string;
};

export type ValidatedOutput = AgentOutput & { warnings: string[] };

const PRICE_RE = /R\$\s?\d|\d+[.,]?\d*\s?(reais|mil)\b/i;

/**
 * Valida a saída do modelo contra o que o servidor autoriza.
 * Nunca confia em ids vindos do modelo: filtra pelas listas permitidas.
 */
export function validateAgentOutput(
  raw: unknown,
  ctx: {
    offers: Pick<SdrOffer, "offer_key" | "name">[];
    materials: Pick<SdrMaterial, "id">[];
    inbound: ConversationMessage[];
  },
): ValidatedOutput | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "Saída inválida" };
  const r = raw as Record<string, unknown>;
  const warnings: string[] = [];
  const intent = SDR_INTENTS.includes(r.intent as SdrIntent) ? (r.intent as SdrIntent) : null;
  if (!intent) return { error: "Intenção inválida" };
  const reply = typeof r.reply === "string" ? r.reply.trim() : "";
  if (!reply && intent !== "opt_out" && intent !== "handoff") return { error: "Resposta vazia" };
  const nReply = norm(reply);
  if (FORBIDDEN_OFFER_NAMES.some((f) => nReply.includes(f)))
    return { error: "Resposta cita oferta inexistente" };
  if (PRICE_RE.test(reply)) warnings.push("A resposta menciona valores; revise antes de enviar.");

  const allowedOffers = new Set(ctx.offers.map((o) => o.offer_key));
  const offer_keys = (Array.isArray(r.offer_keys) ? r.offer_keys : [])
    .filter((k): k is string => typeof k === "string")
    .filter((k) => {
      const ok = allowedOffers.has(k);
      if (!ok) warnings.push(`Oferta descartada: ${k}`);
      return ok;
    });

  const allowedMaterials = new Set(ctx.materials.map((m) => m.id));
  const material_ids = (Array.isArray(r.material_ids) ? r.material_ids : [])
    .filter((k): k is string => typeof k === "string")
    .filter((k) => allowedMaterials.has(k));

  const inboundById = new Map(ctx.inbound.map((m) => [m.id, m]));
  const qualification = (Array.isArray(r.qualification) ? r.qualification : [])
    .map((q) => q as Record<string, unknown>)
    .filter((q) => {
      const msg = inboundById.get(String(q.message_id ?? ""));
      const excerpt = String(q.excerpt ?? "").trim();
      const ok =
        !!msg &&
        msg.direction === "inbound" &&
        excerpt.length >= 2 &&
        norm(msg.body).includes(norm(excerpt)) &&
        typeof q.field === "string" &&
        typeof q.value === "string";
      if (!ok && q.field) warnings.push(`Evidência sem trecho válido: ${String(q.field)}`);
      return ok;
    })
    .map((q) => ({
      field: String(q.field).slice(0, 80),
      value: String(q.value).slice(0, 500),
      message_id: String(q.message_id),
      excerpt: String(q.excerpt).slice(0, 500),
    }));

  const score = Math.max(0, Math.min(100, Math.round(Number(r.score) || 0)));
  return {
    reply,
    intent,
    offer_keys,
    material_ids,
    qualification,
    score,
    handoff_reason: typeof r.handoff_reason === "string" ? r.handoff_reason.slice(0, 300) : "",
    warnings,
  };
}

/** Oportunidade só com critério: pontuação mínima, oferta identificada e evidência. */
export function shouldCreateOpportunity(o: {
  score: number;
  minScore: number;
  offerKeys: string[];
  evidenceCount: number;
  intent: SdrIntent;
}): boolean {
  if (o.intent === "opt_out") return false;
  return o.score >= o.minScore && o.offerKeys.length > 0 && o.evidenceCount > 0;
}

/** Estado comercial após a decisão do agente (independe do dono da conversa). */
export function nextStage(current: CommercialStage, intent: SdrIntent, qualified: boolean): CommercialStage {
  if (intent === "opt_out") return "opted_out";
  if (intent === "handoff") return "handoff";
  if (intent === "schedule_meeting") return "meeting_link_sent";
  if (intent === "send_material") return "material_sent";
  if (qualified) return "qualified";
  return current === "awaiting_reply" ? "discovery" : current;
}

/** Motivos que encerram follow-ups pendentes. */
export const FOLLOW_UP_CANCEL_REASONS = ["replied", "opt_out", "meeting", "handoff", "human"] as const;

/** Próximo follow-up: só quando aguardando resposta e dentro do limite. */
export function nextFollowUpAt(o: {
  now: Date;
  hours: number;
  count: number;
  max: number;
  stage: CommercialStage;
}): Date | null {
  if (o.count >= o.max) return null;
  if (["opted_out", "handoff", "meeting_booked", "closed"].includes(o.stage)) return null;
  return new Date(o.now.getTime() + Math.max(1, o.hours) * 3600_000);
}

/** Status da reunião a partir da reserva e do retorno do Google. */
export function meetingStatus(b: {
  status: string | null;
  gcal_event_id: string | null;
  calendar_sync_error: string | null;
} | null): "none" | "confirmed" | "sync_failed" | "pending_sync" | "canceled" {
  if (!b) return "none";
  if (b.status === "canceled") return "canceled";
  if (b.gcal_event_id) return "confirmed";
  if (b.calendar_sync_error) return "sync_failed";
  return "pending_sync";
}
