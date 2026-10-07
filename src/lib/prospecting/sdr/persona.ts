// Persona/tom do agente: entra no prompt REAL (receptivo, prospecção e teste).
// Versionada em `sdr_agent_versions.persona`; o turno guarda a versão usada.
import { z } from "zod";

export const PersonaSchema = z.object({
  assistant_name: z.string().trim().max(60).default(""),
  description: z.string().trim().max(500).default(""),
  tone: z.enum(["acolhedor", "objetivo", "consultivo"]).default("consultivo"),
  /** 1 = bem informal, 5 = formal. */
  formality: z.number().int().min(1).max(5).default(2),
  /** 1 = neutro, 5 = muito caloroso. */
  warmth: z.number().int().min(1).max(5).default(4),
  /** 1 = detalhado, 5 = bem curto. */
  concision: z.number().int().min(1).max(5).default(4),
  emojis: z.enum(["none", "discreet"]).default("none"),
  good_examples: z.array(z.string().trim().max(400)).max(10).default([]),
  avoid_phrases: z.array(z.string().trim().max(80)).max(30).default([]),
  goal: z.string().trim().max(500).default(""),
  collect: z.string().trim().max(500).default(""),
  handoff_when: z.string().trim().max(500).default(""),
  instructions: z.string().trim().max(4000).default(""),
});
export type Persona = z.infer<typeof PersonaSchema>;

export const DEFAULT_PERSONA: Persona = PersonaSchema.parse({
  good_examples: [
    "Se o orçamento ainda está em análise, podemos começar dimensionando a equipe. Vocês já têm uma data prevista para começar?",
  ],
});

export function parsePersona(raw: unknown): Persona {
  const r = PersonaSchema.safeParse(raw ?? {});
  return r.success ? r.data : DEFAULT_PERSONA;
}

const TONE_TEXT: Record<Persona["tone"], string> = {
  acolhedor: "acolhedor e simpático, faz a pessoa se sentir bem atendida",
  objetivo: "direto e prático, sem rodeios",
  consultivo: "consultivo: entende o contexto e sugere o próximo passo útil",
};

/** Fórmulas de abertura que soam burocráticas quando repetidas a cada turno. */
export const STOCK_OPENERS = [
  "entendi que",
  "entendi",
  "entendo que",
  "entendo",
  "perfeito",
  "ótimo",
  "otimo",
  "certo",
  "compreendo",
  "legal",
  "excelente",
  "maravilha",
  "obrigado pelas informações",
  "obrigado pela informação",
];

export function personaPromptSection(p: Persona): string {
  const lvl = (n: number, a: string, b: string) => (n <= 2 ? a : n >= 4 ? b : "equilibrado");
  return [
    "ESTILO DE CONVERSA (persona configurada):",
    p.assistant_name
      ? `- Seu nome é ${p.assistant_name}. Use só se perguntarem ou na primeira mensagem.`
      : "",
    p.description ? `- Quem você é: ${p.description}` : "",
    `- Tom: ${TONE_TEXT[p.tone]}. Formalidade: ${lvl(p.formality, "informal, de conversa", "formal")}. Calor: ${lvl(p.warmth, "neutro", "caloroso")}. Tamanho: ${lvl(p.concision, "pode detalhar", "curto, 1 a 3 frases")}.`,
    "- Português do Brasil natural, leve e simpático, como uma pessoa experiente conversando no WhatsApp. Nada de gíria forçada nem linguagem infantil.",
    "- NÃO abra a mensagem com fórmulas como 'Entendi', 'Entendi que', 'Perfeito', 'Ótimo', 'Certo', 'Legal' ou 'Obrigado pelas informações', e não repita ou parafraseie o que a pessoa acabou de dizer.",
    "- Também não troque esse vício por outro fixo (como começar sempre com 'Se...' ou 'Então'). Varie naturalmente.",
    "- Parta do que já se sabe na conversa e avance com algo útil. Nunca pergunte um dado que já foi informado no histórico.",
    "- No máximo uma pergunta por mensagem, só quando necessária.",
    "- Emoção adequada ao momento: não comemore problema, recusa ou reclamação; com irritação, reconheça com calma e resolva.",
    p.emojis === "discreet"
      ? "- Emoji: no máximo um, discreto, e só quando combinar."
      : "- Não use emojis.",
    p.goal ? `- Objetivo do atendimento: ${p.goal}` : "",
    p.collect ? `- Informações a coletar: ${p.collect}` : "",
    p.handoff_when ? `- Quando chamar uma pessoa: ${p.handoff_when}` : "",
    p.avoid_phrases.length ? `- Evite estas expressões: ${p.avoid_phrases.join("; ")}.` : "",
    p.good_examples.length
      ? `- Exemplos do jeito certo (inspiração de tom, não copie): ${p.good_examples.map((e) => `"${e}"`).join(" | ")}`
      : "",
    p.instructions ? `- Instruções adicionais: ${p.instructions}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export type ToneIssue = "stock_opener" | "echo" | "too_many_questions" | "avoided_phrase";

/**
 * Sinais objetivos de resposta seca/burocrática. Não substitui a avaliação de
 * tom: serve para corrigir aberturas e registrar no trace.
 */
export function toneIssues(reply: string, lastInbound: string | null, p: Persona): ToneIssue[] {
  const issues: ToneIssue[] = [];
  const r = norm(reply);
  if (STOCK_OPENERS.some((o) => r === norm(o) || r.startsWith(`${norm(o)} `)))
    issues.push("stock_opener");
  if (lastInbound) {
    const inb = new Set(
      norm(lastInbound)
        .split(" ")
        .filter((w) => w.length > 3),
    );
    const firstSentence = norm(reply.split(/[.!?]/)[0] ?? "")
      .split(" ")
      .filter((w) => w.length > 3);
    if (inb.size >= 3 && firstSentence.length) {
      const overlap = firstSentence.filter((w) => inb.has(w)).length / firstSentence.length;
      if (overlap >= 0.6) issues.push("echo");
    }
  }
  if ((reply.match(/\?/g) ?? []).length > 1) issues.push("too_many_questions");
  if (p.avoid_phrases.some((a) => a && r.includes(norm(a)))) issues.push("avoided_phrase");
  return issues;
}

/**
 * Remove a fórmula de abertura quando o restante já é uma mensagem completa
 * ("Entendi que X. Pergunta?" → "Pergunta?"). Sem restante útil, mantém o texto.
 */
export function stripStockOpener(reply: string): string {
  const t = reply.trim();
  const m = t.match(/^([^.!?\n]{0,160}[.!?])\s+(.+)$/s);
  const first = norm(t.split(/[,.!?\n]/)[0] ?? "");
  const isStock = STOCK_OPENERS.some((o) => first === norm(o) || first.startsWith(`${norm(o)} `));
  if (!isStock) return t;
  // "Perfeito! Resto" / "Entendi, resto"
  const short = t.match(/^[^,.!?\n]{1,30}[,!.]\s+(.+)$/s);
  if (short && STOCK_OPENERS.some((o) => norm(t.split(/[,.!?]/)[0]) === norm(o))) {
    const rest = short[1].trim();
    if (rest.length >= 15) return rest.charAt(0).toUpperCase() + rest.slice(1);
  }
  if (m && m[2].trim().length >= 15) {
    const rest = m[2].trim();
    return rest.charAt(0).toUpperCase() + rest.slice(1);
  }
  return t;
}
