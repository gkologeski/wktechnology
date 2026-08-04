// Server functions para importar MODELOS de contrato a partir de .docx/.pdf.
// Diferente da importação de contratos firmados: aqui o objetivo é obter o corpo
// do documento em HTML e substituir os trechos variáveis por tokens ({{...}}).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { assertAnyPermission } from "@/lib/access-control/enforce.server";
import { CONTRACT_TEMPLATE_TOKENS } from "@/lib/contracts/template-tokens";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const CREATE = [
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

const ImportedTemplateSchema = z.object({
  name: z.string().optional().nullable(),
  role: z.enum(["provider", "client"]).optional().nullable(),
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

async function callAi(userContent: Array<Record<string, unknown>>): Promise<ImportedTemplate> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY ausente");

  const resp = await fetch(AI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    if (resp.status === 429)
      throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
    if (resp.status === 402) throw new Error("Créditos de IA esgotados no workspace.");
    throw new Error(`Falha na conversão (${resp.status}): ${body.slice(0, 200)}`);
  }

  const payload = await resp.json();
  const raw = payload?.choices?.[0]?.message?.content ?? "{}";
  let parsed: unknown;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    throw new Error("A IA não retornou JSON válido.");
  }
  const result = ImportedTemplateSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("A IA retornou um formato inesperado. Tente novamente.");
  }
  if (!result.data.body_html || result.data.body_html.trim().length < 40) {
    throw new Error("Não foi possível extrair o corpo do documento.");
  }
  return result.data;
}

export const parseContractTemplatePdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        filename: z.string().min(1).max(255),
        base64: z.string().min(20).max(30_000_000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, CREATE);

    return callAi([
      {
        type: "text",
        text: `Converta o contrato "${data.filename}" em um modelo reutilizável conforme as regras.`,
      },
      {
        type: "file",
        file: { filename: data.filename, file_data: `data:application/pdf;base64,${data.base64}` },
      },
    ]);
  });

export const parseContractTemplateHtml = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        filename: z.string().min(1).max(255),
        html: z.string().min(40).max(400_000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, CREATE);

    return callAi([
      {
        type: "text",
        text: `Converta o contrato "${data.filename}" em um modelo reutilizável conforme as regras. Conteúdo em HTML:\n\n${data.html}`,
      },
    ]);
  });
