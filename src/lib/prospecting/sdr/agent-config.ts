// Configuração POR AGENTE (puro, sem rede): ferramentas, catálogo, materiais,
// canais, guardrails e fontes de conhecimento. O workspace define apenas o
// liga/desliga global e os limites técnicos — nunca sobrescreve estes campos.
import { z } from "zod";
import type { SdrMaterial, SdrOffer } from "./policy";

export const SDR_TOOLS = ["qualify", "material", "schedule", "handoff"] as const;
export type SdrTool = (typeof SDR_TOOLS)[number];

export const SDR_CHANNELS = ["whatsapp"] as const;

export const GuardrailsSchema = z.object({
  /** Perguntas por mensagem (a política já limita a 1–2). */
  max_questions: z.number().int().min(1).max(2).default(1),
  /** Falar de preço é proibido por padrão. */
  no_pricing: z.boolean().default(true),
  /** Exige confirmação humana antes de criar oportunidade. */
  require_human_for_opportunity: z.boolean().default(false),
  extra_rules: z.string().trim().max(2000).default(""),
});
export type Guardrails = z.infer<typeof GuardrailsSchema>;

export const KbSourceSchema = z.object({
  title: z.string().trim().min(1).max(120),
  url: z.string().trim().max(500).default(""),
  note: z.string().trim().max(500).default(""),
});

export const AgentConfigSchema = z.object({
  assigned_to: z.string().uuid().nullable().default(null),
  offer_keys: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  material_ids: z.array(z.string().uuid()).max(100).default([]),
  allowed_tools: z.array(z.enum(SDR_TOOLS)).default([...SDR_TOOLS]),
  channels: z.array(z.enum(SDR_CHANNELS)).min(1).default(["whatsapp"]),
  guardrails: GuardrailsSchema.default({}),
  kb_sources: z.array(KbSourceSchema).max(30).default([]),
  booking_page_id: z.string().uuid().nullable().default(null),
  questionnaire_id: z.string().uuid().nullable().default(null),
});
export type AgentConfig = z.infer<typeof AgentConfigSchema>;

/**
 * Validação campo a campo: um campo inválido volta ao padrão sem apagar os
 * demais (um valor ruim não pode "resetar" o catálogo/ferramentas do agente).
 */
export function parseAgentConfig(raw: unknown): AgentConfig {
  const whole = AgentConfigSchema.safeParse(raw ?? {});
  if (whole.success) return whole.data;
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const defaults = AgentConfigSchema.parse({});
  const shape = AgentConfigSchema.shape;
  const out = { ...defaults } as Record<string, unknown>;
  for (const k of Object.keys(shape) as (keyof typeof shape)[]) {
    const r = shape[k].safeParse(src[k]);
    if (r.success) out[k] = r.data;
  }
  return out as AgentConfig;
}

export function hasTool(cfg: AgentConfig, tool: SdrTool): boolean {
  return cfg.allowed_tools.includes(tool);
}

/** Catálogo e materiais deste agente (listas vazias = herdar tudo que está ativo). */
export function scopeKnowledge<O extends Pick<SdrOffer, "offer_key">, M extends Pick<SdrMaterial, "id">>(
  cfg: AgentConfig,
  knowledge: { offers: O[]; materials: M[] },
): { offers: O[]; materials: M[] } {
  const offers = cfg.offer_keys.length
    ? knowledge.offers.filter((o) => cfg.offer_keys.includes(o.offer_key))
    : knowledge.offers;
  const materials = !hasTool(cfg, "material")
    ? []
    : cfg.material_ids.length
      ? knowledge.materials.filter((m) => cfg.material_ids.includes(m.id))
      : knowledge.materials;
  return { offers, materials };
}

/** Trecho do prompt com ferramentas, guardrails e fontes deste agente. */
export function agentConfigPromptSection(cfg: AgentConfig): string {
  const g = cfg.guardrails;
  const lines = [
    "CONFIGURAÇÃO DESTE AGENTE (vale só para ele):",
    `- Ferramentas liberadas: ${cfg.allowed_tools.join(", ") || "nenhuma"}.`,
    hasTool(cfg, "material") ? "" : "- Não ofereça materiais: a ferramenta está desligada.",
    hasTool(cfg, "schedule")
      ? ""
      : "- Não ofereça agendamento: encaminhe para uma pessoa (intent=handoff).",
    hasTool(cfg, "qualify") ? "" : "- Não preencha o questionário de qualificação (answers vazio).",
    hasTool(cfg, "handoff")
      ? ""
      : "- Passagem automática para humano desligada: conclua a conversa com educação.",
    `- No máximo ${g.max_questions} pergunta(s) por mensagem.`,
    g.no_pricing ? "- Nunca cite valores, descontos ou condições comerciais." : "",
    g.extra_rules ? `- Regras adicionais: ${g.extra_rules}` : "",
    cfg.kb_sources.length
      ? `FONTES DE CONHECIMENTO DESTE AGENTE:\n${cfg.kb_sources
          .map((s) => `- ${s.title}${s.url ? ` (${s.url})` : ""}${s.note ? `: ${s.note}` : ""}`)
          .join("\n")}`
      : "",
  ];
  return lines.filter(Boolean).join("\n");
}

/** Linha do banco → configuração validada. */
export function configFromRow(row: Record<string, unknown>): AgentConfig {
  return parseAgentConfig({
    assigned_to: row["assigned_to"] ?? null,
    offer_keys: row["offer_keys"] ?? [],
    material_ids: row["material_ids"] ?? [],
    allowed_tools: Array.isArray(row["allowed_tools"])
      ? (row["allowed_tools"] as string[]).filter((t) =>
          (SDR_TOOLS as readonly string[]).includes(t),
        )
      : undefined,
    channels: Array.isArray(row["channels"])
      ? (row["channels"] as string[]).filter((c) =>
          (SDR_CHANNELS as readonly string[]).includes(c),
        ).length
        ? (row["channels"] as string[]).filter((c) =>
            (SDR_CHANNELS as readonly string[]).includes(c),
          )
        : undefined
      : undefined,
    guardrails: row["guardrails"] ?? {},
    kb_sources: row["kb_sources"] ?? [],
    booking_page_id: row["booking_page_id"] ?? null,
    questionnaire_id: row["questionnaire_id"] ?? null,
  });
}
