// Classify Vapi `endedReason` strings to decide whether a finished call attempt
// should block further retries for that lead (real conversation happened) or
// be re-enqueued (no-answer, voicemail, error, silence, etc).
//
// Conservative default: when we cannot classify the reason, we assume a real
// conversation happened (do NOT call the lead again).

const CONVERSATION_HINTS = [
  "customer-ended-call",
  "assistant-ended-call",
  "assistant-said-end-call-phrase",
  "assistant-forwarded-call",
  "exceeded-max-duration",
];

const RETRIABLE_HINTS = [
  "no-answer",
  "did-not-answer",
  "customer-busy",
  "busy",
  "silence-timed-out",
  "silence",
  "voicemail",
  "twilio-failed",
  "twilio-connection",
  "failed-to-connect",
  "pipeline-error",
  "assistant-error",
  "vehicle-call-error",
  "provider-error",
  "vonage-",
  "phone-call-provider",
  "unknown-error",
  "error",
  "failed",
  "canceled",
  "cancelled",
];

export function isRetriableEndedReason(reason: string | null | undefined): boolean {
  if (!reason) return true; // sem motivo conhecido → permite re-tentar
  const r = String(reason).toLowerCase();
  if (CONVERSATION_HINTS.some((h) => r.includes(h))) return false;
  if (RETRIABLE_HINTS.some((h) => r.includes(h))) return true;
  return false; // motivo desconhecido → bloqueia (não liga de novo)
}
