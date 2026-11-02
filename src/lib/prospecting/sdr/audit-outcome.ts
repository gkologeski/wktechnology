// Auditoria automática das mensagens do Agente SDR (sem supervisão manual).
// Toda mensagem passa pelas regras antes de sair; se cair numa regra, a IA
// refaz a mensagem. O que não tiver conserto nunca vira rascunho: resposta ao
// cliente passa para um humano na Inbox, retomada é descartada ou reagendada.
// Módulo puro: só decide; quem grava é o worker.

/** Novas gerações permitidas por mensagem (conteúdo e repetição). */
export const AUDIT_MAX_REGENERATIONS = 3;

/** Motivos de envio que a IA tenta resolver escrevendo de novo. */
export const REGENERATE_ON_SEND: ReadonlySet<string> = new Set([
  "repetition_detected",
  "followup_repetition",
]);

/** Trabalho obsoleto: outra coisa já mudou a conversa; nada a fazer. */
const OBSOLETE: ReadonlySet<string> = new Set([
  "owner_not_ai",
  "stale_version",
  "enrollment_inactive",
  "lease_lost",
  "job_state_changed",
  "conversation_missing",
]);

export type UnsendableAction =
  /** Descarta sem enviar (nenhuma pessoa precisa agir). */
  | "discard"
  /** Resposta que o cliente aguarda: a conversa passa para um humano na Inbox. */
  | "handoff"
  /** Retomada fora do horário: volta para a fila no próximo horário permitido. */
  | "reschedule"
  /** Envio incerto (pode ter saído): fica como falha para reconciliar, nunca reenvia às cegas. */
  | "keep_failed";

export function unsendableAction(
  kind: "reply" | "follow_up",
  reason: string,
  category?: string | null,
): UnsendableAction {
  if (category === "reconcile" || reason.startsWith("uncertain_after_send")) return "keep_failed";
  if (OBSOLETE.has(reason)) return "discard";
  if (kind === "follow_up") return reason === "followup_hours" ? "reschedule" : "discard";
  return "handoff";
}

const LABELS: Record<string, string> = {
  price: "a resposta citava valores e o agente não pode informar preços",
  material_claim: "a resposta dizia ter enviado um material que não foi anexado",
  booking_claim: "a resposta confirmava uma reunião que a agenda não confirmou",
  questions: "a resposta passava do limite de perguntas",
  repetition_detected: "a resposta repetia a última mensagem enviada",
  followup_repetition: "a retomada repetia uma mensagem já enviada",
  window_closed: "a janela de 24 h do WhatsApp está fechada",
  not_allowlisted: "o número está fora da lista do piloto",
  circuit_open: "a proteção técnica do agente está acionada",
  conversation_rate_anomaly: "ritmo anormal de respostas nesta conversa",
  provider_failed: "o WhatsApp recusou o envio",
  permission_revoked: "o agente perdeu acesso a este registro",
  invalid_origin: "não há mensagem do cliente válida para responder",
  quota_check_failed: "não foi possível verificar a cota de retomadas",
  followup_quota: "a cota diária de retomadas foi atingida",
  followup_hours: "fora do horário de prospecção",
  followup_max_reached: "o máximo de retomadas deste contato foi atingido",
};

export function auditReasonLabel(reason: string): string {
  if (LABELS[reason]) return LABELS[reason];
  if (reason.startsWith("channel_")) return "o número de WhatsApp do agente está indisponível";
  return "a mensagem não passou na auditoria automática";
}

/** Motivo gravado na passagem para humano (aparece na tarefa e na conversa). */
export function auditHandoffReason(reasons: ReadonlyArray<string>): string {
  const uniq = [...new Set(reasons)];
  return `Auditoria automática: ${uniq.map(auditReasonLabel).join("; ")}. Responda o cliente pela Inbox.`;
}

export type AuditRecord = {
  /** Novas gerações feitas pela IA nesta mensagem. */
  regenerations: number;
  /** Regras em que a mensagem caiu (controles e envio). */
  reasons: string[];
  outcome: "sent" | "handoff" | "discarded" | "rescheduled" | "failed";
};

/** Só registra quando a auditoria agiu (refez, desviou ou descartou). */
export function auditRecord(a: AuditRecord): AuditRecord | null {
  if (a.outcome === "sent" && a.regenerations === 0) return null;
  return { ...a, reasons: [...new Set(a.reasons)] };
}
