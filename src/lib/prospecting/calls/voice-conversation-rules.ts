/** Regras fixas de conversa aplicadas a toda ligação da IA de voz (VOZ-PRIMEIRO-NOME). */
export const IDLE_QUESTION = "Você ainda está aí?";
export const IDLE_TIMEOUT_SECONDS = 10;
/** E-mail para candidatos a emprego (VAGA-CURRICULO). */
export const CAREERS_EMAIL = "rh@wktechnology.com.br";

export function firstNameOf(firstName?: string | null, fullName?: string | null): string {
  const f = (firstName ?? "").trim();
  if (f) return f.split(/\s+/)[0];
  return (fullName ?? "").trim().split(/\s+/)[0] ?? "";
}

export const AUTOMATED_PHRASES = {
  ura: [
    '"digite 1"',
    '"tecle"',
    '"para falar com"',
    '"menu"',
    '"aguarde na linha"',
    '"sua ligação é muito importante"',
  ],
  voicemail: [
    '"deixe sua mensagem"',
    '"após o sinal"',
    '"não está disponível"',
    '"caixa postal"',
    '"será encaminhada"',
    '"o número chamado"',
    '"fora da área de cobertura"',
  ],
};

export const VOICE_CONVERSATION_RULES = `

## Regras de conversa (obrigatórias)
- Chame o cliente apenas pelo primeiro nome. Nunca use nome e sobrenome juntos.
- Se o cliente ficar mais de ${IDLE_TIMEOUT_SECONDS} segundos sem responder, pergunte uma única vez: "${IDLE_QUESTION}". Se continuar em silêncio, despeça-se e encerre.

## Pedido de tempo do cliente (VOZ-HUMANO-URA)
- Se o cliente disser "só 1 minuto", "rapidinho", "estou ocupado", "não posso falar agora" ou parecido: resuma a proposta em UMA frase curta, faça UMA pergunta e ofereça retornar em outro horário. Não continue o roteiro completo.

## Atendimento automático × humano (VOZ-HUMANO-URA)
- Só siga o roteiro depois de ouvir uma fala de pessoa (cumprimento, "alô", "quem fala?", resposta à sua pergunta).
- URA / menu automático (ex.: ${AUTOMATED_PHRASES.ura.join(", ")}): NÃO fale com a URA; chame imediatamente a função de encerrar a ligação, sem dizer nada.
- Caixa postal / gravação (ex.: ${AUTOMATED_PHRASES.voicemail.join(", ")}), mesmo que a frase chegue pela metade: isso NÃO é o cliente. Não responda, não deixe recado; encerre imediatamente.
- Na dúvida, pergunte uma única vez "Alô, aqui é da WK Technology, com quem eu falo?". Se vier outra gravação ou menu, encerre.

## Candidatos a emprego (VAGA-CURRICULO)
- Se a pessoa disser que procura emprego, vaga ou quer trabalhar na WK Technology (área de TI): agradeça o interesse em uma frase e oriente a enviar o currículo para ${CAREERS_EMAIL}, soletrando com calma: "rh, arroba, wktechnology, ponto com, ponto br". Não ofereça serviços, não qualifique como cliente e não prometa vaga nem retorno. Depois despeça-se e encerre.`;

export const voiceIdleMessagePlan = {
  idleMessages: [IDLE_QUESTION],
  idleTimeoutSeconds: IDLE_TIMEOUT_SECONDS,
  idleMessageMaxSpokenCount: 1,
};

/** Detecção de caixa postal no provedor: encerra sem deixar recado (VOZ-HUMANO-URA). */
export const voiceVoicemailDetection = { provider: "vapi" as const };

export const VOICE_END_CALL_PHRASES = [
  "tenha um ótimo dia",
  "tenha uma ótima semana",
  "até mais",
  "tchau",
  "até logo",
];

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
