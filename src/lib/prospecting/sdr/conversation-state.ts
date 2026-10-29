// Estado EXPLÍCITO da conversa do Agente SDR (puro, sem rede).
// Substitui a leitura do estado pela redação de mensagens anteriores
// ("conhece quem responde pela área de TI", "Obrigada pelo retorno!"...).
// A IA SUGERE a situação de forma estruturada; o servidor valida contra o
// histórico real e grava pelo commit atômico (sdr_commit_turn, mesmo tenant,
// lease e versão). Nada aqui decide texto: só estado e efeitos permitidos.
import { validateEmailAddress } from "@/lib/email-address";
import { toWhatsAppE164 } from "@/lib/phone/whatsapp-e164";
import type { ConversationMessage } from "./policy";

export const SUPPRESS_REASONS = [
  "none",
  "auto_responder",
  "addressed_to_other",
  "closed_no_reply_needed",
] as const;
export type SuppressReason = (typeof SUPPRESS_REASONS)[number];

export const CONVERSATION_STAGES = [
  "active",
  "asked_referral",
  "awaiting_referral",
  "closed",
] as const;
export type ConversationStage = (typeof CONVERSATION_STAGES)[number];

export const CLOSE_REASONS = [
  "none",
  "no_demand",
  "declined",
  "not_target",
  "left_company",
  "private_number",
  "wrong_contact",
  "referral_received",
  "referral_declined",
  "other",
] as const;
export type CloseReason = (typeof CLOSE_REASONS)[number];

export const SHARED_CONTACT = ["none", "referral", "own_corporate"] as const;
export type SharedContact = (typeof SHARED_CONTACT)[number];

/** Classificação estruturada emitida pela IA (sugestão; o servidor valida). */
export type Situation = {
  suppress_reply: SuppressReason;
  conversation: ConversationStage;
  close_reason: CloseReason;
  meeting_declined: boolean;
  decision_maker_confirmed: boolean;
  confirmed_name: string | null;
  contact_source_question: boolean;
  shared_contact: SharedContact;
  /** Nome da pessoa indicada, como o próprio cliente escreveu (senão null). */
  referral_name: string | null;
  evidence_message_id: string | null;
};

export const DEFAULT_SITUATION: Situation = {
  suppress_reply: "none",
  conversation: "active",
  close_reason: "none",
  meeting_declined: false,
  decision_maker_confirmed: false,
  confirmed_name: null,
  contact_source_question: false,
  shared_contact: "none",
  referral_name: null,
  evidence_message_id: null,
};

/** Trecho do schema estrito de saída da IA. */
export const SITUATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: Object.keys(DEFAULT_SITUATION),
  properties: {
    suppress_reply: { type: "string", enum: [...SUPPRESS_REASONS] },
    conversation: { type: "string", enum: [...CONVERSATION_STAGES] },
    close_reason: { type: "string", enum: [...CLOSE_REASONS] },
    meeting_declined: { type: "boolean" },
    decision_maker_confirmed: { type: "boolean" },
    confirmed_name: { type: ["string", "null"] },
    contact_source_question: { type: "boolean" },
    shared_contact: { type: "string", enum: [...SHARED_CONTACT] },
    referral_name: { type: ["string", "null"] },
    evidence_message_id: { type: ["string", "null"] },
  },
} as const;

const oneOf = <T extends string>(list: readonly T[], v: unknown, d: T): T =>
  list.includes(v as T) ? (v as T) : d;

/** Leitura tolerante: campo ausente/inválido volta ao padrão. */
export function parseSituation(raw: unknown): Situation {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const name = typeof r.confirmed_name === "string" ? r.confirmed_name.trim().slice(0, 60) : "";
  const refName = typeof r.referral_name === "string" ? r.referral_name.trim().slice(0, 80) : "";
  const ev = typeof r.evidence_message_id === "string" ? r.evidence_message_id.trim() : "";
  return {
    suppress_reply: oneOf(SUPPRESS_REASONS, r.suppress_reply, "none"),
    conversation: oneOf(CONVERSATION_STAGES, r.conversation, "active"),
    close_reason: oneOf(CLOSE_REASONS, r.close_reason, "none"),
    meeting_declined: r.meeting_declined === true,
    decision_maker_confirmed: r.decision_maker_confirmed === true,
    confirmed_name: name || null,
    contact_source_question: r.contact_source_question === true,
    shared_contact: oneOf(SHARED_CONTACT, r.shared_contact, "none"),
    referral_name: refName || null,
    evidence_message_id: ev || null,
  };
}

/** Item gravado; `job_id` = turno cuja mensagem precisa ter sido enviada. */
type Stamp = { at: string; job_id: string | null };
export type ConversationState = {
  referral_asked?: Stamp | null;
  awaiting_referral?: Stamp | null;
  closed?: (Stamp & { reason: CloseReason }) | null;
  meeting_declined?: (Stamp & { message_id: string }) | null;
  decision_maker_confirmed?: (Stamp & { message_id: string }) | null;
  confirmed_name?: (Stamp & { name: string; message_id: string }) | null;
  contact_source_asked?: (Stamp & { message_id: string }) | null;
  /** O cliente indicou outra pessoa (fato do cliente; dados escritos por ele). */
  referral_received?:
    | (Stamp & {
        name: string | null;
        email: string | null;
        phone: string | null;
        message_id: string;
      })
    | null;
};

export function parseState(raw: unknown): ConversationState {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as ConversationState) : {};
}

/** Itens que dependem de uma mensagem nossa só valem se o turno foi enviado. */
const REPLY_DEPENDENT = ["referral_asked", "awaiting_referral", "closed"] as const;

export function stateJobIds(state: ConversationState): string[] {
  const ids = new Set<string>();
  for (const k of REPLY_DEPENDENT) {
    const v = state[k];
    if (v?.job_id) ids.add(v.job_id);
  }
  return [...ids];
}

/**
 * Estado efetivo: descarta itens dependentes de envio cujo turno não saiu, e
 * acrescenta o encerramento comprovado pelo próprio atendimento (status/motivo
 * já gravados no banco) — sem backfill e sem ler redação de mensagens.
 */
export function effectiveState(
  state: ConversationState,
  sentJobIds: Set<string>,
  enrollment?: { status?: string | null; cancel_reason?: string | null },
): ConversationState {
  const out: ConversationState = { ...state };
  for (const k of REPLY_DEPENDENT) {
    const v = out[k];
    if (v?.job_id && !sentJobIds.has(v.job_id)) out[k] = null;
  }
  const raw = String(enrollment?.cancel_reason ?? "");
  // Motivos antigos gravados antes do estado explícito (fato do atendimento).
  const legacy: Record<string, CloseReason> = {
    not_this_person: "not_target",
    out_of_icp: "other",
    post_close: "other",
  };
  const reason = legacy[raw] ?? raw;
  if (!out.closed && (CLOSE_REASONS as readonly string[]).includes(reason) && reason !== "none")
    out.closed = { at: "", job_id: null, reason: reason as CloseReason };
  if (!out.contact_source_asked && raw === "asked_contact_source")
    out.contact_source_asked = { at: "", job_id: null, message_id: "" };
  return out;
}

const norm = (s: string) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Texto do estado para o prompt (fatos registrados, não instruções). */
export function statePromptLines(s: ConversationState): string[] {
  const lines: string[] = [];
  if (s.closed)
    lines.push(`- Conversa encerrada anteriormente (motivo registrado: ${s.closed.reason}).`);
  if (s.referral_asked)
    lines.push("- Já foi perguntado a esta pessoa pelo contato do responsável.");
  if (s.awaiting_referral)
    lines.push("- Esta pessoa disse que vai enviar o contato do responsável.");
  if (s.confirmed_name) lines.push(`- Nome confirmado pelo cliente: ${s.confirmed_name.name}.`);
  if (s.decision_maker_confirmed)
    lines.push("- O cliente já confirmou que é responsável pela área/decisão.");
  if (s.meeting_declined) lines.push("- O cliente recusou reunião nesta conversa.");
  if (s.contact_source_asked) lines.push("- O cliente já perguntou de onde veio o contato.");
  if (s.referral_received) {
    const r = s.referral_received;
    const who = [r.name, r.email, r.phone].filter(Boolean).join(", ") || "sem dados";
    lines.push(
      `- Esta pessoa já indicou outro responsável (${who}); não volte a qualificá-la sobre o assunto, trate apenas do que ela própria trouxer.`,
    );
  }
  return lines.length ? lines : ["- Nenhum estado registrado."];
}

/** Telefone legível numa mensagem (dado, não decisão). */
export type SharedPhone = { name: string | null; phoneE164: string };
/** Nome antigo mantido para quem só lida com telefone. */
export type Referral = SharedPhone;

/** Indicação validada: ao menos nome, e-mail ou telefone escrito pelo cliente. */
export type ReferralInfo = {
  name: string | null;
  phoneE164: string | null;
  email: string | null;
  messageId: string | null;
};

const HONORIFIC = /^(?:(?:sr|sra|srta|dr|dra|eng|prof|profa)\.?\s+)+/iu;

/** Remove tratamento ("Sr.", "Dra.") do nome escrito pelo cliente. */
export function cleanPersonName(name: string | null | undefined): string | null {
  const v = String(name ?? "")
    .replace(HONORIFIC, "")
    .replace(/\s+/g, " ")
    .trim();
  return v.length >= 2 ? v.slice(0, 80) : null;
}

const NAME_BEFORE =
  /(?:com (?:o|a)?\s*|e (?:o|a)\s+|^|\s)((?:(?:Sr|Sra|Srta|Dr|Dra)\.?\s+)?[A-ZÀ-Ú][\p{L}]+(?: [A-ZÀ-Ú][\p{L}]+){0,3})\s*$/u;

/**
 * E-mail escrito na mensagem (dado, não decisão). Só aceita endereço válido
 * pelo validador do sistema; o nome é o que vem imediatamente antes, se houver.
 */
export function parseSharedEmail(text: string): { name: string | null; email: string } | null {
  const raw = String(text ?? "");
  const re = /[^\s@<>()[\]"',;:]+@[^\s@<>()[\]"',;:]+\.[^\s@<>()[\]"',;:.]{2,}/gu;
  for (const m of raw.matchAll(re)) {
    const candidate = m[0].replace(/[.!?]+$/, "");
    const v = validateEmailAddress(candidate);
    if (!v.ok) continue;
    const before = raw
      .slice(0, m.index)
      .split(/\n/)
      .pop()!
      .replace(/[:\-–,(]+\s*$/, "")
      .trimEnd();
    const nm = before.match(NAME_BEFORE);
    return { name: cleanPersonName(nm?.[1]), email: v.value };
  }
  return null;
}

/** Telefone brasileiro em texto ou cartão de contato (dado, não decisão). */
export function parseSharedPhone(text: string): SharedPhone | null {
  const raw = String(text ?? "");
  const card = raw.match(/Contato compartilhado\s*\n\s*([^:\n]+):\s*([+\d][\d\s().-]{7,})/);
  if (card) {
    const phone = toWhatsAppE164(card[2]);
    if (phone) return { name: card[1].trim() || null, phoneE164: phone };
  }
  const m = raw.match(/(\+?\d[\d\s().-]{8,}\d)/);
  if (!m) return null;
  const phone = toWhatsAppE164(m[1]);
  if (!phone) return null;
  const before = raw.slice(0, m.index).replace(/[:\-–,]+\s*$/, "");
  const nm = before.match(
    /(?:com (?:o|a)?\s*|e (?:o|a)\s+|^)\s*([A-ZÀ-Ú][\p{L}]+(?: [A-ZÀ-Ú][\p{L}]+){0,3})\s*$/u,
  );
  return { name: nm?.[1]?.trim() ?? null, phoneE164: phone };
}

/** Mensagens do cliente desde a nossa última mensagem (o turno atual). */
export function currentInbound(history: ConversationMessage[]): ConversationMessage[] {
  let i = history.length - 1;
  while (i >= 0 && history[i]!.direction === "inbound") i--;
  const trailing = history.slice(i + 1).filter((m) => m.direction === "inbound");
  if (trailing.length) return trailing;
  // Relógios fora de ordem (envio registrado depois da resposta): usa a última do cliente.
  const last = [...history].reverse().find((m) => m.direction === "inbound");
  return last ? [last] : [];
}

export type StateDecision = {
  /** Patch a gravar no commit (merge). */
  patch: ConversationState;
  /** Encerramento a aplicar após o envio (sem retomadas, IA pausada). */
  close: CloseReason | null;
  /** Retomadas automáticas canceladas, sem encerrar. */
  stopFollowUps: boolean;
  /** Motivo gravado em `cancel_reason` ao suspender retomadas (sem encerrar). */
  stopReason: "asked_contact_source" | null;
  suppress: Exclude<SuppressReason, "none"> | null;
  referral: ReferralInfo | null;
  corporatePhone: string | null;
  warnings: string[];
};

/**
 * Valida a situação sugerida pela IA contra o histórico real e o estado
 * gravado. Fatos do cliente exigem mensagem do cliente desta conversa como
 * evidência; nome só se aparecer escrito pelo cliente; telefone só se for
 * legível no texto/cartão. Sem prova, o item é descartado com aviso.
 */
export function decideState(p: {
  situation: Situation;
  history: ConversationMessage[];
  state: ConversationState;
  jobId: string | null;
  jobKind: "reply" | "follow_up";
  reply: string;
  now: Date;
}): StateDecision {
  const s = p.situation;
  const at = p.now.toISOString();
  const warnings: string[] = [];
  const patch: ConversationState = {};
  const inbound = p.history.filter((m) => m.direction === "inbound");
  const current = currentInbound(p.history);
  const evidence = s.evidence_message_id
    ? (inbound.find((m) => m.id === s.evidence_message_id) ?? null)
    : null;
  const needsEvidence =
    s.meeting_declined || s.decision_maker_confirmed || s.contact_source_question;
  if (needsEvidence && !evidence)
    warnings.push("Situação sem mensagem do cliente como evidência: fatos não registrados.");

  // Supressão: só nas situações permitidas e nunca em retomada automática.
  let suppress: StateDecision["suppress"] = null;
  if (s.suppress_reply !== "none") {
    const valid =
      p.jobKind === "reply" &&
      current.length > 0 &&
      (s.suppress_reply !== "closed_no_reply_needed" || !!p.state.closed);
    if (valid) suppress = s.suppress_reply;
    else warnings.push(`Supressão "${s.suppress_reply}" inválida neste contexto: ignorada.`);
  }

  if (evidence && s.meeting_declined && !p.state.meeting_declined)
    patch.meeting_declined = { at, job_id: p.jobId, message_id: evidence.id };
  if (evidence && s.decision_maker_confirmed && !p.state.decision_maker_confirmed)
    patch.decision_maker_confirmed = { at, job_id: p.jobId, message_id: evidence.id };
  if (evidence && s.contact_source_question)
    patch.contact_source_asked = { at, job_id: p.jobId, message_id: evidence.id };

  if (s.confirmed_name) {
    const n = norm(s.confirmed_name);
    const src = inbound.find((m) => n.length >= 2 && ` ${norm(m.body)} `.includes(` ${n} `));
    if (src && p.state.confirmed_name?.name !== s.confirmed_name)
      patch.confirmed_name = { at, job_id: p.jobId, name: s.confirmed_name, message_id: src.id };
    else if (!src) warnings.push("Nome sugerido não aparece em mensagem do cliente: ignorado.");
  }

  // Contato compartilhado: só vale o que o cliente escreveu no turno atual.
  let referral: ReferralInfo | null = null;
  let corporatePhone: string | null = null;
  if (s.shared_contact === "own_corporate" && p.jobKind === "reply") {
    const parsed = current.map((m) => parseSharedPhone(m.body)).find(Boolean) ?? null;
    if (!parsed) warnings.push("Contato compartilhado sem número legível: nada registrado.");
    else corporatePhone = parsed.phoneE164;
  } else if (s.shared_contact === "referral" && p.jobKind === "reply") {
    const phoneHit = current.map((m) => ({ m, v: parseSharedPhone(m.body) })).find((x) => x.v);
    const mailHit = current.map((m) => ({ m, v: parseSharedEmail(m.body) })).find((x) => x.v);
    let nameHit: { m: ConversationMessage; name: string } | null = null;
    if (s.referral_name) {
      const n = norm(s.referral_name);
      const src = current.find((m) => n.length >= 2 && ` ${norm(m.body)} `.includes(` ${n} `));
      const clean = cleanPersonName(s.referral_name);
      if (src && clean) nameHit = { m: src, name: clean };
      else warnings.push("Nome do indicado não aparece na mensagem do cliente: ignorado.");
    }
    const name = nameHit?.name ?? phoneHit?.v?.name ?? mailHit?.v?.name ?? null;
    const email = mailHit?.v?.email ?? null;
    const phone = phoneHit?.v?.phoneE164 ?? null;
    if (name || email || phone) {
      const messageId = (phoneHit?.m ?? mailHit?.m ?? nameHit?.m)!.id;
      referral = { name, email, phoneE164: phone, messageId };
      const prev = p.state.referral_received;
      const same = !!prev && prev.name === name && prev.email === email && prev.phone === phone;
      if (!same)
        patch.referral_received = {
          at,
          job_id: p.jobId,
          name,
          email,
          phone,
          message_id: messageId,
        };
    } else {
      warnings.push(
        "Indicação sem nome, e-mail ou telefone escrito pelo cliente: nada registrado.",
      );
    }
  }

  let close: CloseReason | null = null;
  if (s.conversation === "closed") {
    let reason: CloseReason = s.close_reason === "none" ? "other" : s.close_reason;
    if (reason === "referral_received" && !referral) {
      warnings.push(
        "Encerramento por indicação sem nome, e-mail ou telefone registrado: conversa segue aberta.",
      );
      reason = "none";
    }
    if (reason !== "none") {
      close = reason;
      patch.closed = { at, job_id: p.jobId, reason };
    }
  } else if (s.conversation === "asked_referral" && !p.state.referral_asked) {
    patch.referral_asked = { at, job_id: p.jobId };
  } else if (s.conversation === "awaiting_referral") {
    patch.awaiting_referral = { at, job_id: p.jobId };
  } else if (s.conversation === "active" && p.state.closed && !suppress && p.reply.trim()) {
    // Cliente trouxe algo legítimo após o encerramento e a IA voltou a atender.
    patch.closed = null;
  }

  return {
    patch,
    close,
    // Contato de origem perguntado ou indicação recebida: quem escreveu não
    // recebe mais retomadas automáticas (a conversa segue para o que ele trouxer).
    stopFollowUps: !!patch.contact_source_asked || !!referral || !!p.state.referral_received,
    stopReason: patch.contact_source_asked ? "asked_contact_source" : null,
    suppress,
    referral,
    corporatePhone,
    warnings,
  };
}
