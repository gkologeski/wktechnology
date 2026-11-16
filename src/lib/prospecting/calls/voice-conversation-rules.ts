/** Regras fixas de conversa aplicadas a toda ligação da IA de voz (VOZ-PRIMEIRO-NOME). */
export const IDLE_QUESTION = "Você ainda está aí?";
export const IDLE_TIMEOUT_SECONDS = 10;

export function firstNameOf(firstName?: string | null, fullName?: string | null): string {
  const f = (firstName ?? "").trim();
  if (f) return f.split(/\s+/)[0];
  return (fullName ?? "").trim().split(/\s+/)[0] ?? "";
}

export const VOICE_CONVERSATION_RULES = `

## Regras de conversa (obrigatórias)
- Chame o cliente apenas pelo primeiro nome. Nunca use nome e sobrenome juntos.
- Se o cliente ficar mais de ${IDLE_TIMEOUT_SECONDS} segundos sem responder, pergunte: "${IDLE_QUESTION}"`;

export const voiceIdleMessagePlan = {
  idleMessages: [IDLE_QUESTION],
  idleTimeoutSeconds: IDLE_TIMEOUT_SECONDS,
  idleMessageMaxSpokenCount: 2,
};
