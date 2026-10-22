// Persona/tom do agente: entra no prompt REAL (receptivo, prospecção e teste).
// Versionada em `sdr_agent_versions.persona`; o turno guarda a versão usada.
import { z } from "zod";

export const PersonaSchema = z.object({
  /** prospecting = persuasiva, conduz para reunião; service = só informa. */
  intent: z.enum(["prospecting", "service"]).default("prospecting"),
  assistant_name: z.string().trim().max(60).default(""),
  description: z.string().trim().max(2000).default(""),
  tone: z.enum(["acolhedor", "objetivo", "consultivo"]).default("consultivo"),
  /** 1 = bem informal, 5 = formal. */
  formality: z.number().int().min(1).max(5).default(2),
  /** 1 = neutro, 5 = muito caloroso. */
  warmth: z.number().int().min(1).max(5).default(4),
  /** 1 = detalhado, 5 = bem curto. */
  concision: z.number().int().min(1).max(5).default(4),
  emojis: z.enum(["none", "discreet"]).default("none"),
  good_examples: z.array(z.string().trim().max(1000)).max(10).default([]),
  avoid_phrases: z.array(z.string().trim().max(80)).max(30).default([]),
  goal: z.string().trim().max(2000).default(""),
  collect: z.string().trim().max(2000).default(""),
  handoff_when: z.string().trim().max(2000).default(""),
  instructions: z.string().trim().max(8000).default(""),
});
export type Persona = z.infer<typeof PersonaSchema>;

export const DEFAULT_PERSONA: Persona = PersonaSchema.parse({
  good_examples: [
    "Se o orçamento ainda está em análise, podemos começar dimensionando a equipe. Vocês já têm uma data prevista para começar?",
  ],
});

export function parsePersona(raw: unknown): Persona {
  const r = PersonaSchema.safeParse(raw ?? {});
  if (r.success) return r.data;
  // Validação campo a campo: um campo inválido (ex. acima do limite) volta ao
  // padrão sem apagar os demais campos da persona.
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_PERSONA } as Record<string, unknown>;
  for (const k of Object.keys(PersonaSchema.shape) as (keyof typeof PersonaSchema.shape)[]) {
    const field = PersonaSchema.shape[k].safeParse(src[k]);
    if (field.success) out[k] = field.data;
  }
  return out as Persona;
}

const TONE_LABEL: Record<Persona["tone"], string> = {
  acolhedor: "acolhedor",
  objetivo: "objetivo",
  consultivo: "consultivo",
};

/** Escala 1–5 configurada → rótulo legível (sem política embutida). */
function scale(n: number, low: string, high: string): string {
  return `${n}/5 (1 = ${low}, 5 = ${high})`;
}

/**
 * Configuração publicada da persona, renderizada de forma genérica: cada campo
 * salvo entra como está, rotulado, sem regras de estilo escondidas no código.
 */
export function personaPromptSection(p: Persona): string {
  const block = (title: string, body: string) => (body ? `${title}:\n${body}` : "");
  return [
    "CONFIGURAÇÃO PUBLICADA DA PERSONA:",
    p.assistant_name ? `Nome: ${p.assistant_name}` : "",
    `Intenção configurada: ${p.intent === "service" ? "atendimento" : "prospecção"}`,
    `Tom: ${TONE_LABEL[p.tone]}. Formalidade ${scale(p.formality, "informal", "formal")}. Calor ${scale(p.warmth, "neutro", "caloroso")}. Concisão ${scale(p.concision, "detalhado", "curto")}.`,
    `Emojis: ${p.emojis === "discreet" ? "discretos permitidos" : "não usar"}.`,
    block("Descrição", p.description),
    block("Objetivo", p.goal),
    block("Informações a coletar", p.collect),
    block("Quando transferir para uma pessoa", p.handoff_when),
    block("Instruções", p.instructions),
    p.good_examples.length
      ? `Exemplos de referência (orientam o tom; não são respostas prontas):\n${p.good_examples.map((e) => `- ${e}`).join("\n")}`
      : "",
    p.avoid_phrases.length ? `Expressões a evitar: ${p.avoid_phrases.join("; ")}` : "",
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

export type ToneIssue = "echo" | "too_many_questions" | "avoided_phrase";

/**
 * Telemetria de tom (não reescreve nada): expressões a evitar CONFIGURADAS,
 * limite de perguntas CONFIGURADO e eco da última fala do cliente.
 */
export function toneIssues(
  reply: string,
  lastInbound: string | null,
  p: Persona,
  maxQuestions = 1,
): ToneIssue[] {
  const issues: ToneIssue[] = [];
  const r = norm(reply);
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
  if ((reply.match(/\?/g) ?? []).length > maxQuestions) issues.push("too_many_questions");
  if (
    p.avoid_phrases.some((a) => {
      const n = a ? norm(a) : "";
      return !!n && (r === n || r.startsWith(`${n} `) || r.includes(` ${n} `));
    })
  )
    issues.push("avoided_phrase");
  return issues;
}
