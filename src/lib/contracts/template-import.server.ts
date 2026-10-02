// Conversão de contrato em MODELO via IA — server-only.
// A chamada usa streaming (stream: true) e acumula o texto: respostas longas
// não ficam presas em uma resposta buferizada que estoura o tempo da conexão.
import { z } from "zod";
import { aiChatFetch } from "@/lib/ai/provider-resolver.server";
import { CONTRACT_TEMPLATE_TOKENS } from "@/lib/contracts/template-tokens";

export const TEMPLATE_IMPORT_PERMISSIONS = [
  "techcontracts.contract_templates.create.own",
  "techcontracts.contract_templates.create.workspace",
];

const TOKEN_LIST = CONTRACT_TEMPLATE_TOKENS.map((t) => `${t.token} — ${t.group}: ${t.label}`).join(
  "\n",
);

const SYSTEM_PROMPT = `Você converte contratos brasileiros em MODELOS reutilizáveis de contrato.

Sua tarefa:
1. Reproduzir o texto do documento em HTML simples e limpo (use apenas <h1>-<h4>, <p>, <strong>, <em>, <u>, <ul>, <ol>, <li>, <table>, <tr>, <td>, <br>). Nunca use <script>, <style> ou atributos de estilo.
2. Substituir todo dado específico das partes/valores/datas pelo TOKEN correspondente da lista abaixo. Ex.: a razão social do cliente vira {{counterparty.name}}, o CNPJ vira {{counterparty.cnpj}}, o valor mensal vira {{contract.monthly_value}}.
3. Preservar integralmente as cláusulas, numeração e ordem do documento. Não resuma, não reescreva juridicamente, não invente cláusulas.
4. Se um dado variável não tiver token equivalente, mantenha o texto original.

TOKENS DISPONÍVEIS:
${TOKEN_LIST}

Responda APENAS JSON válido, sem markdown, no formato:
{
  "name": "nome sugerido para o modelo",
  "role": "provider" | "client" | null,
  "service_type": "outsourcing" | "desenvolvimento" | "manutencao" | "consultoria" | "licenciamento" | "outros" | null,
  "body_html": "<h1>...</h1><p>...</p>",
  "suggestions": [{ "original": "trecho original substituído", "token": "{{counterparty.name}}" }],
  "warnings": ["ambiguidades relevantes"]
}`;

export const ImportedTemplateSchema = z.object({
  name: z.string().optional().nullable(),
  role: z.enum(["provider", "client"]).optional().nullable().catch(null),
  service_type: z.string().optional().nullable(),
  body_html: z.string().optional().nullable(),
  suggestions: z
    .array(
      z.object({
        original: z.string().optional().nullable(),
        token: z.string().optional().nullable(),
      }),
    )
    .optional()
    .nullable(),
  warnings: z.array(z.string()).optional().nullable(),
});
export type ImportedTemplate = z.infer<typeof ImportedTemplateSchema>;

/** Extrai o texto de um corpo SSE estilo chat-completions (data: {...}). */
export function collectSseText(raw: string): string {
  let out = "";
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t.startsWith("data:")) continue;
    const payload = t.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const j = JSON.parse(payload);
      const piece = j?.choices?.[0]?.delta?.content ?? j?.choices?.[0]?.message?.content;
      if (typeof piece === "string") out += piece;
    } catch {
      // frame incompleto/irrelevante
    }
  }
  return out;
}

/** Remove cercas ```json e isola o objeto JSON. */
export function extractJsonObject(text: string): string {
  const s = text.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/i, "");
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  return a >= 0 && b > a ? s.slice(a, b + 1) : s;
}

export async function convertTemplateWithAi(
  userContent: Array<Record<string, unknown>>,
  ctx: { userId: string; workspaceId: string },
): Promise<ImportedTemplate> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Configuração de IA ausente no servidor.");

  const resp = await aiChatFetch(
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        stream: true,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    },
    { feature: "importacao_modelo", userId: ctx.userId, workspaceId: ctx.workspaceId },
  );

  if (!resp.ok) {
    const body = await resp.text();
    if (resp.status === 429)
      throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
    if (resp.status === 402) throw new Error("Créditos de IA esgotados no workspace.");
    if (resp.status === 403) throw new Error("Uso de IA bloqueado para este workspace.");
    throw new Error(`Falha na conversão (${resp.status}): ${body.slice(0, 200)}`);
  }

  const raw = await resp.text();
  const ct = resp.headers.get("content-type") ?? "";
  let text: string;
  if (ct.includes("event-stream") || raw.trimStart().startsWith("data:")) {
    text = collectSseText(raw);
  } else {
    try {
      text = JSON.parse(raw)?.choices?.[0]?.message?.content ?? "";
    } catch {
      text = raw;
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(text));
  } catch {
    throw new Error("A IA não retornou JSON válido. Tente novamente.");
  }
  const result = ImportedTemplateSchema.safeParse(parsed);
  if (!result.success) throw new Error("A IA retornou um formato inesperado. Tente novamente.");
  if (!result.data.body_html || result.data.body_html.trim().length < 40) {
    throw new Error("Não foi possível extrair o corpo do documento.");
  }
  return result.data;
}
