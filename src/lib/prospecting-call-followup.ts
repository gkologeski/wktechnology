// Regra pura do WhatsApp após a ligação do agente de voz.
// "answered" = houve conversa; "missed" = não atendeu, ocupado ou caixa postal.
export type FollowupKind = "answered" | "missed" | null;

const MISSED_HINTS = [
  "no-answer",
  "busy",
  "voicemail",
  "did-not-answer",
  "customer-did-not-answer",
];

export function chooseFollowup(
  status: string | null | undefined,
  endedReason: string | null | undefined,
): FollowupKind {
  const s = String(status ?? "").toLowerCase();
  const r = String(endedReason ?? "").toLowerCase();
  if (s === "no_answer" || s === "busy" || MISSED_HINTS.some((h) => r.includes(h))) return "missed";
  if (s === "completed") return "answered";
  // Falha técnica (erro do provedor, número inválido) não gera mensagem ao cliente.
  return null;
}

/** Texto livre só dentro da janela de 24 h; fora dela, sempre o modelo aprovado. */
export function followupUsesTemplate(
  kind: Exclude<FollowupKind, null>,
  windowOpen: boolean,
  hasAnsweredText: boolean,
): boolean {
  if (kind === "missed") return true;
  return !(windowOpen && hasAnsweredText);
}
