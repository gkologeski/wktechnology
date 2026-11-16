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

/** Resumo e avaliação pós-ligação sempre em português do Brasil (RESUMO-PTBR-VOZ). */
export const voiceAnalysisPlan = {
  summaryPlan: {
    messages: [
      {
        role: "system",
        content:
          "Você é um analista comercial. Resuma a ligação em português do Brasil, em 2 a 3 frases objetivas: quem atendeu (pessoa, URA, caixa postal), o que foi conversado e o desfecho. Nunca responda em inglês.",
      },
      {
        role: "user",
        content: "Transcrição:\n\n{{transcript}}\n\nMotivo do encerramento: {{endedReason}}",
      },
    ],
  },
  successEvaluationPlan: {
    rubric: "PassFail",
    messages: [
      {
        role: "system",
        content:
          "Avalie, em português do Brasil, se a ligação atingiu o objetivo do roteiro abaixo. Responda apenas true ou false.\n\n{{systemPrompt}}",
      },
      { role: "user", content: "Transcrição:\n\n{{transcript}}" },
    ],
  },
};
