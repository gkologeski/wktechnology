// Helpers server-only da sugestão de vínculos de contratos (prompt + chamada de IA + mapeamento).
import { z } from "zod";
import { normalizeEntityName, type ContractLinkMeta } from "@/lib/contracts/link-suggest";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export const AiSuggestionSchema = z.object({
  pending_id: z.string(),
  target_id: z.string(),
  kind: z.enum(["parent", "amendment"]),
  confidence: z.enum(["high", "medium", "low"]),
  reason: z.string().max(300),
});

export type AiSuggestion = z.infer<typeof AiSuggestionSchema>;

const AiResponseSchema = z.object({
  suggestions: z.array(AiSuggestionSchema).max(200).optional().nullable(),
});

const SYSTEM_PROMPT = `Você é um analista de contratos brasileiros de TI. Sua tarefa é associar contratos entre si.

CONTEXTO
- Contratos de PRESTAÇÃO (role "provider") são contratos-PAI: neles a CONTRATADA é uma das empresas do nosso workspace.
- Contratos de COMPRA (role "client") são contratos-FILHO: neles a CONTRATANTE é uma das empresas do nosso workspace. Cada compra deve ser aninhada sob o contrato de prestação correspondente (mesmo projeto/cliente final).
- ADITIVOS (document_kind "amendment") devem ser vinculados ao contrato principal do MESMO papel e da MESMA contraparte.

REGRAS
- Responda APENAS JSON válido: {"suggestions":[{"pending_id":"...","target_id":"...","kind":"parent"|"amendment","confidence":"high"|"medium"|"low","reason":"..."}]}
- "kind": "amendment" quando o pendente é aditivo; "parent" quando é vínculo prestação ↔ compra.
- Use apenas ids presentes nas listas fornecidas. Nunca invente ids. Nunca associe um contrato a si mesmo.
- Só sugira quando houver evidência real (número citado, contraparte/CNPJ coincidente, mesmo projeto, vigências compatíveis). Se não houver, omita o contrato.
- "reason": uma frase curta em português explicando a evidência.
- No máximo uma sugestão por pending_id.`;

/** Converte uma linha de `contracts` no metadado usado pela análise. */
export function toContractLinkMeta(row: Record<string, unknown>): ContractLinkMeta {
  const meta = (row["metadata"] as Record<string, unknown> | null) ?? null;
  return {
    id: row["id"] as string,
    role: (row["role"] as "provider" | "client") ?? "provider",
    document_kind: (row["document_kind"] as string | null) ?? "main",
    number: (row["number"] as string | null) ?? null,
    self_number: (meta?.["self_contract_number"] as string | null) ?? null,
    title: (row["title"] as string) ?? "",
    company_name: (row["companies"] as { name: string | null } | null)?.name ?? null,
    contracting_name: (meta?.["contracting_name_extracted"] as string | null) ?? null,
    contracting_cnpj: (meta?.["contracting_cnpj_extracted"] as string | null) ?? null,
    counterparty_name: (meta?.["counterparty_name_extracted"] as string | null) ?? null,
    counterparty_cnpj: (meta?.["counterparty_cnpj_extracted"] as string | null) ?? null,
    starts_at: (row["starts_at"] as string | null) ?? null,
    ends_at: (row["ends_at"] as string | null) ?? null,
  };
}

/** Chave da contraparte externa (cliente final ou fornecedor) do contrato. */
export function counterpartyKey(c: ContractLinkMeta): string {
  const cnpj = (c.counterparty_cnpj ?? "").replace(/\D/g, "");
  if (cnpj.length === 14) return `cnpj:${cnpj}`;
  const name = normalizeEntityName(c.counterparty_name ?? c.company_name);
  return name.length >= 4 ? `name:${name}` : "";
}

export async function requestAiLinkSuggestions(prompt: string): Promise<AiSuggestion[]> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY ausente");

  const resp = await fetch(AI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    if (resp.status === 429) {
      throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
    }
    if (resp.status === 402) throw new Error("Créditos de IA esgotados no workspace.");
    throw new Error(`Falha na análise por IA (${resp.status}): ${body.slice(0, 200)}`);
  }

  const payload = await resp.json();
  const raw = payload?.choices?.[0]?.message?.content ?? "{}";
  let parsed: unknown;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    throw new Error("A IA não retornou JSON válido.");
  }
  const result = AiResponseSchema.safeParse(parsed);
  if (!result.success) return [];
  return result.data.suggestions ?? [];
}
