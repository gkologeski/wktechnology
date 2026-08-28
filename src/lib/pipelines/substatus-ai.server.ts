// Sugestão de substatus por etapa via Lovable AI Gateway (Responses API).
// Server-only: a chave nunca sai do handler. A resposta é apenas uma
// proposta — quem grava é o gestor, depois de revisar na interface.
import { z } from "zod";

const AI_URL = "https://ai.gateway.lovable.dev/v1/responses";

export const SubstatusSuggestionSchema = z.object({
  name: z.string().min(1).max(60),
  description: z.string().max(160).nullable(),
  is_default: z.boolean(),
  exists: z.boolean(),
});

export const SubstatusAiResultSchema = z.object({
  substatuses: z.array(SubstatusSuggestionSchema).max(12),
  rationale: z.string().nullable(),
});

export type SubstatusSuggestion = z.infer<typeof SubstatusSuggestionSchema>;
export type SubstatusAiResult = z.infer<typeof SubstatusAiResultSchema>;

const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["substatuses", "rationale"],
  properties: {
    substatuses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "description", "is_default", "exists"],
        properties: {
          name: { type: "string" },
          description: { type: ["string", "null"] },
          is_default: { type: "boolean" },
          exists: { type: "boolean" },
        },
      },
    },
    rationale: { type: ["string", "null"] },
  },
} as const;

const SYSTEM_PROMPT = `Você é especialista em processos comerciais e configura CRMs em português do Brasil.
Receberá uma etapa de pipeline e os substatus já cadastrados nela.
Responda com a lista COMPLETA e ORDENADA de substatus recomendados para a etapa,
do início ao fim do processo interno dessa etapa.
Regras:
- Rótulos curtos (até 4 palavras), em português do Brasil, no padrão de CRM.
- Reaproveite os substatus existentes quando fizerem sentido, mantendo o nome exato e marcando "exists": true.
- Novos substatus recebem "exists": false.
- A ordem do array é a ordem sugerida.
- Exatamente um item com "is_default": true (o primeiro estado natural da etapa).
- Máximo de 8 itens. Sem duplicidade. Sem numeração no nome.`;

export type SubstatusAiContext = {
  pipelineName: string;
  pipelineEntity: string;
  stageLabel: string;
  stageValue: string;
  stageType?: string | null;
  existing: string[];
};

function buildPrompt(ctx: SubstatusAiContext): string {
  const tipo =
    ctx.stageType === "won"
      ? "etapa de ganho"
      : ctx.stageType === "lost"
        ? "etapa de perda"
        : "etapa aberta";
  return [
    `Pipeline: ${ctx.pipelineName} (entidade: ${ctx.pipelineEntity})`,
    `Etapa: ${ctx.stageLabel} (identificador: ${ctx.stageValue}, ${tipo})`,
    ctx.existing.length > 0
      ? `Substatus já cadastrados, na ordem atual: ${ctx.existing.join(" | ")}`
      : "Nenhum substatus cadastrado ainda.",
    "Responda em json com a lista ordenada de substatus recomendados.",
  ].join("\n");
}

/** Lê o SSE da Responses API e devolve o texto final acumulado. */
async function readStreamedText(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("A IA não retornou conteúdo.");
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let completedText = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(payload) as Record<string, unknown>;
      } catch {
        continue;
      }
      const type = event["type"] as string | undefined;
      if (type === "response.output_text.delta" && typeof event["delta"] === "string") {
        text += event["delta"];
      } else if (type === "response.completed") {
        const response = event["response"] as { output_text?: unknown } | undefined;
        if (typeof response?.output_text === "string") completedText = response.output_text;
      } else if (type === "error") {
        const err = event["error"] as { message?: string } | undefined;
        throw new Error(err?.message ?? "Falha na geração por IA.");
      }
    }
  }

  return (text || completedText).trim();
}

export async function requestSubstatusSuggestions(
  ctx: SubstatusAiContext,
): Promise<SubstatusAiResult> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("A IA não está configurada neste ambiente (LOVABLE_API_KEY ausente).");

  const res = await fetch(AI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-5.6-sol",
      instructions: SYSTEM_PROMPT,
      input: buildPrompt(ctx),
      stream: true,
      store: false,
      reasoning: { effort: "low", summary: "auto" },
      text: {
        format: {
          type: "json_schema",
          name: "substatus_suggestions",
          strict: true,
          schema: JSON_SCHEMA,
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("Limite de uso da IA atingido. Tente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados no workspace.");
    if (res.status === 403) throw new Error("A IA está bloqueada por política do workspace.");
    throw new Error(`Falha na sugestão por IA (${res.status}): ${body.slice(0, 200)}`);
  }

  const raw = await readStreamedText(res);
  if (!raw) throw new Error("A IA não retornou sugestões. Tente novamente.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("A IA não retornou JSON válido.");
  }
  const result = SubstatusAiResultSchema.safeParse(parsed);
  if (!result.success) throw new Error("A resposta da IA veio em formato inesperado.");

  // Um único padrão e sem duplicidade de nomes.
  const seen = new Set<string>();
  let defaultUsed = false;
  const substatuses: SubstatusSuggestion[] = [];
  for (const s of result.data.substatuses) {
    const name = s.name.trim();
    const dedupe = name.toLowerCase();
    if (!name || seen.has(dedupe)) continue;
    seen.add(dedupe);
    const is_default = s.is_default && !defaultUsed;
    if (is_default) defaultUsed = true;
    substatuses.push({
      name,
      description: s.description?.trim() ? s.description.trim() : null,
      is_default,
      exists: s.exists,
    });
  }
  if (substatuses.length === 0) throw new Error("A IA não retornou sugestões utilizáveis.");
  if (!defaultUsed && substatuses[0]) substatuses[0].is_default = true;

  return { substatuses, rationale: result.data.rationale };
}
