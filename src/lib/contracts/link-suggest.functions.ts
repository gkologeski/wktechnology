// Sugestão de vínculos entre contratos: camada determinística (números citados,
// CNPJs próprios do workspace, contraparte de aditivos) + camada de IA para o resto.
// Nunca grava nada: apenas devolve propostas para revisão humana.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { assertAnyPermission } from "@/lib/access-control/enforce.server";
import {
  dedupeSuggestions,
  isOwnParty,
  isValidSuggestion,
  normalizeEntityName,
  type ContractLinkMeta,
  type LinkConfidence,
  type LinkSuggestion,
} from "@/lib/contracts/link-suggest";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type SuggestedLinkRow = LinkSuggestion & {
  pending: { number: string | null; title: string; role: string; document_kind: string };
  target: { number: string | null; title: string; role: string };
};

export type SuggestLinksResult = {
  suggestions: SuggestedLinkRow[];
  analyzed: number;
  unresolved: number;
  ai_used: boolean;
  notes: string[];
};

const AiSuggestionSchema = z.object({
  pending_id: z.string(),
  target_id: z.string(),
  kind: z.enum(["parent", "amendment"]),
  confidence: z.enum(["high", "medium", "low"]),
  reason: z.string().max(300),
});

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

function toMeta(row: Record<string, unknown>): ContractLinkMeta {
  const meta = (row["metadata"] as Record<string, unknown> | null) ?? null;
  return {
    id: row["id"] as string,
    role: (row["role"] as "provider" | "client") ?? "provider",
    document_kind: (row["document_kind"] as string | null) ?? "main",
    number: (row["number"] as string | null) ?? null,
    self_number: (meta?.["self_contract_number"] as string | null) ?? null,
    title: (row["title"] as string) ?? "",
    company_name:
      ((row["companies"] as { name: string | null } | null)?.name as string | null) ?? null,
    contracting_name: (meta?.["contracting_name_extracted"] as string | null) ?? null,
    contracting_cnpj: (meta?.["contracting_cnpj_extracted"] as string | null) ?? null,
    counterparty_name: (meta?.["counterparty_name_extracted"] as string | null) ?? null,
    counterparty_cnpj: (meta?.["counterparty_cnpj_extracted"] as string | null) ?? null,
    starts_at: (row["starts_at"] as string | null) ?? null,
    ends_at: (row["ends_at"] as string | null) ?? null,
  };
}

/** Contraparte "externa" do contrato (o cliente final ou o fornecedor). */
function counterpartyKey(c: ContractLinkMeta): string {
  const cnpj = (c.counterparty_cnpj ?? "").replace(/\D/g, "");
  if (cnpj.length === 14) return `cnpj:${cnpj}`;
  const name = normalizeEntityName(c.counterparty_name ?? c.company_name);
  return name.length >= 4 ? `name:${name}` : "";
}

async function callAi(prompt: string): Promise<{ items: z.infer<typeof AiSuggestionSchema>[] }> {
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
    if (resp.status === 429)
      throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
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
  if (!result.success) return { items: [] };
  return { items: result.data.suggestions ?? [] };
}

export const suggestContractLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ role: z.enum(["provider", "client", "amendment", "all"]).optional() })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<SuggestLinksResult> => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techcontracts.contracts.update.own",
      "techcontracts.contracts.update.workspace",
    ]);

    const { computePendingLinks } = await import("@/lib/contracts/pending-link");
    const { loadOwnLegalEntities, resolveReferencedContract } =
      await import("@/lib/contracts/import-link.server");

    const { data: rows, error } = await supabase
      .from("contracts")
      .select(
        "id, role, number, title, status, starts_at, ends_at, parent_contract_id, document_kind, amendment_of_id, metadata, companies:counterparty_company_id(name)",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;

    const all = (rows ?? []) as unknown as Parameters<typeof computePendingLinks>[0];
    const pendingRows = computePendingLinks(all, { role: data.role ?? "all" });
    const metaById = new Map<string, ContractLinkMeta>();
    for (const r of rows ?? []) {
      const m = toMeta(r as Record<string, unknown>);
      metaById.set(m.id, m);
    }

    const own = await loadOwnLegalEntities(supabase, workspaceId);
    const notes: string[] = [];
    if (own.length === 0) {
      notes.push(
        "Nenhuma empresa (CNPJ) cadastrada no workspace: a IA não pode confirmar quem é a nossa parte.",
      );
    }

    const pendingIds = new Set(pendingRows.map((p) => p.id));
    const allMetas = Array.from(metaById.values());
    const mains = allMetas.filter((c) => c.document_kind !== "amendment");
    const providers = mains.filter((c) => c.role === "provider");
    const clients = mains.filter((c) => c.role === "client");
    const parentedClientIds = new Set(
      (rows ?? [])
        .map((r) => (r as Record<string, unknown>)["parent_contract_id"] as string | null)
        .filter((v): v is string => Boolean(v)),
    );

    const ruleSuggestions: LinkSuggestion[] = [];

    for (const p of pendingRows) {
      const pending = metaById.get(p.id);
      if (!pending) continue;

      // 1) Aditivo → contrato principal do mesmo papel e mesma contraparte.
      if (pending.document_kind === "amendment") {
        const key = counterpartyKey(pending);
        if (!key) continue;
        const matches = mains.filter(
          (c) => c.role === pending.role && counterpartyKey(c) === key && c.id !== pending.id,
        );
        if (matches.length === 1) {
          ruleSuggestions.push({
            pending_id: pending.id,
            target_id: matches[0].id,
            kind: "amendment",
            confidence: "high",
            reason: `Aditivo da mesma contraparte do contrato ${matches[0].number ?? matches[0].title}.`,
            source: "rule",
          });
        }
        continue;
      }

      // 2) Compra → prestação pelo número citado no documento.
      if (pending.role === "client") {
        const hit = resolveReferencedContract(
          p.referenced_numbers,
          providers.map((c) => ({ id: c.id, number: c.number, selfNumber: c.self_number })),
        );
        if (hit && hit.id !== pending.id) {
          const isOurs = isOwnParty(own, pending.contracting_cnpj, pending.contracting_name);
          ruleSuggestions.push({
            pending_id: pending.id,
            target_id: hit.id,
            kind: "parent",
            confidence: isOurs || own.length === 0 ? "high" : "medium",
            reason: `Documento cita o contrato ${hit.matchedNumber}${
              isOurs ? " e a CONTRATANTE é uma empresa do workspace" : ""
            }.`,
            source: "rule",
          });
        }
        continue;
      }

      // 3) Prestação → compra que cita o número deste contrato.
      const child = clients.find((c) => {
        if (c.id === pending.id || parentedClientIds.has(c.id)) return false;
        const refs = (() => {
          const source = all.find((r) => r.id === c.id);
          const list = source?.metadata?.["referenced_contract_numbers"];
          return Array.isArray(list) ? (list as string[]) : [];
        })();
        if (!refs.length) return false;
        const hit = resolveReferencedContract(refs, [
          { id: pending.id, number: pending.number, selfNumber: pending.self_number },
        ]);
        return Boolean(hit);
      });
      if (child) {
        ruleSuggestions.push({
          pending_id: pending.id,
          target_id: child.id,
          kind: "parent",
          confidence: "high",
          reason: `O contrato de compra ${child.number ?? child.title} cita o número deste contrato.`,
          source: "rule",
        });
      }
    }

    const resolvedByRule = new Set(ruleSuggestions.map((s) => s.pending_id));
    const remaining = pendingRows.filter((p) => !resolvedByRule.has(p.id));

    let aiSuggestions: LinkSuggestion[] = [];
    let aiUsed = false;

    if (remaining.length > 0) {
      const describe = (c: ContractLinkMeta) => ({
        id: c.id,
        numero: c.number,
        titulo: c.title,
        papel: c.role,
        tipo_documento: c.document_kind,
        contratante: c.contracting_name,
        contratante_cnpj: c.contracting_cnpj,
        contratada_ou_contraparte: c.counterparty_name ?? c.company_name,
        contraparte_cnpj: c.counterparty_cnpj,
        vigencia: { inicio: c.starts_at, fim: c.ends_at },
        nossa_parte_e_contratante: isOwnParty(own, c.contracting_cnpj, c.contracting_name),
        nossa_parte_e_contratada: isOwnParty(own, c.counterparty_cnpj, c.counterparty_name),
      });

      const pendingPayload = remaining
        .map((p) => metaById.get(p.id))
        .filter((c): c is ContractLinkMeta => Boolean(c))
        .map((c) => ({
          ...describe(c),
          motivo_pendencia: pendingRows.find((p) => p.id === c.id)?.reason ?? null,
        }));

      const candidatePayload = allMetas
        .filter((c) => !pendingIds.has(c.id) || c.document_kind !== "amendment")
        .slice(0, 250)
        .map(describe);

      const prompt = [
        `Empresas (CNPJs) do nosso workspace: ${
          own.length
            ? own.map((e) => `${e.name}${e.cnpjDigits ? ` (${e.cnpjDigits})` : ""}`).join("; ")
            : "não informadas"
        }`,
        "",
        "CONTRATOS PENDENTES DE VÍNCULO:",
        JSON.stringify(pendingPayload),
        "",
        "CONTRATOS CANDIDATOS:",
        JSON.stringify(candidatePayload),
      ].join("\n");

      const { items } = await callAi(prompt);
      aiUsed = true;
      aiSuggestions = items
        .filter((s) => remaining.some((p) => p.id === s.pending_id))
        .filter((s) => isValidSuggestion(s, metaById.get(s.pending_id), metaById.get(s.target_id)))
        .map((s) => ({
          pending_id: s.pending_id,
          target_id: s.target_id,
          kind: s.kind,
          confidence: s.confidence as LinkConfidence,
          reason: s.reason,
          source: "ai" as const,
        }));
    }

    const merged = dedupeSuggestions([...ruleSuggestions, ...aiSuggestions]).filter((s) =>
      isValidSuggestion(s, metaById.get(s.pending_id), metaById.get(s.target_id)),
    );

    const suggestions: SuggestedLinkRow[] = merged.map((s) => {
      const pending = metaById.get(s.pending_id) as ContractLinkMeta;
      const target = metaById.get(s.target_id) as ContractLinkMeta;
      return {
        ...s,
        pending: {
          number: pending.number,
          title: pending.title,
          role: pending.role,
          document_kind: pending.document_kind,
        },
        target: { number: target.number, title: target.title, role: target.role },
      };
    });

    return {
      suggestions,
      analyzed: pendingRows.length,
      unresolved: pendingRows.length - suggestions.length,
      ai_used: aiUsed,
      notes,
    };
  });
