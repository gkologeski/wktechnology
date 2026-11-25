import type { SupabaseClient } from "@supabase/supabase-js";
import { assertSalesAnyArea, assertSalesReferences } from "@/lib/access-control/sales-core.server";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { aiChatFetch } from "@/lib/ai/provider-resolver.server";
import {
  CONTRACTING_MODALITY_META,
  GENERAL_SCOPE_FIELDS,
  MODALITY_FIELD,
  SERVICE_SCOPE_TYPE_META,
  SERVICE_TYPE_FIELDS,
  extractSectionsFromScopeHtml,
  hasAnyScopeInput,
  sanitizeScopeHtml,
  type GeneratedScopeSection,
  type ProposalScopeBrief,
} from "./proposal-scope-forms";

const DEFAULT_MODEL = "google/gemini-2.5-flash";

export type ProposalScopeAiContext = {
  title: string;
  companyName?: string | null;
  providerName?: string | null;
  totalFormatted?: string | null;
  paymentTermsSummary?: string | null;
  items?: ReadonlyArray<{ name: string; billing: string }>;
};

export type ProposalScopeAiResult = {
  html: string;
  sections: GeneratedScopeSection[];
};

export function buildScopePromptPayload(
  brief: ProposalScopeBrief,
  ctx: ProposalScopeAiContext,
): { system: string; user: string } {
  const system = [
    "Você é um arquiteto de soluções e redator técnico comercial sênior da WK Technology.",
    "Sua tarefa é transformar respostas estruturadas e anotações informais de um consultor em um Escopo Técnico de Proposta Comercial claro, completo, profissional e pronto para envio ao cliente em português do Brasil (PT-BR).",
    "REGRAS OBRIGATÓRIAS:",
    "1. NUNCA invente preços, prazos numéricos, SLAs, tecnologias ou promessas que não estejam nos dados fornecidos. Se um ponto importante estiver ausente, escreva de forma discreta '[A definir em alinhamento inicial]' em vez de inventar.",
    "2. Organize a proposta em duas camadas claras: (a) Visão Geral e Objetivo do Projeto, e (b) Detalhamento por Serviço (uma subseção estruturada para cada serviço informado, respeitando sua natureza técnica e modalidade de contratação: preço fechado, por hora ou mensalidade).",
    "3. Inclua subseções objetivas para Responsabilidades (WK e Cliente), Exclusões (Fora de Escopo) e Governança / Critérios de Aceite conforme os dados preenchidos.",
    "4. Não inclua a tabela de preços nem o bloco 'Condições comerciais' (o sistema já gera esses blocos automaticamente).",
    '5. Retorne EXCLUSIVAMENTE um JSON válido no formato: {"html": "...", "sections": [{"title": "...", "content": "..."}]}.',
    "6. No campo 'html', use apenas HTML semântico limpo (<h3>, <h4>, <p>, <ul>, <li>, <strong>), sem <html>, <head>, <body>, <style> ou markdown.",
    "7. No campo 'sections', devolva as mesmas seções em texto limpo (com marcadores '• ' para listas) prontas para diagramação em páginas A4.",
  ].join("\n");

  const lines: string[] = [];
  lines.push("## Contexto da Proposta");
  if (ctx.title) lines.push(`- Título: ${ctx.title}`);
  if (ctx.companyName) lines.push(`- Cliente: ${ctx.companyName}`);
  if (ctx.providerName) lines.push(`- Prestadora: ${ctx.providerName}`);
  if (ctx.totalFormatted) lines.push(`- Investimento total de referência: ${ctx.totalFormatted}`);
  if (ctx.paymentTermsSummary)
    lines.push(`- Condições comerciais resumidas: ${ctx.paymentTermsSummary}`);
  if (ctx.items && ctx.items.length > 0) {
    lines.push("- Itens da cotação/negócio:");
    for (const it of ctx.items) {
      lines.push(`  * ${it.name}${it.billing ? ` (${it.billing})` : ""}`);
    }
  }

  const generalLines: string[] = [];
  for (const field of GENERAL_SCOPE_FIELDS) {
    const val = brief.general[field.key]?.trim();
    if (val) generalLines.push(`- ${field.label}: ${val}`);
  }
  if (generalLines.length > 0) {
    lines.push("\n## Dados Gerais da Proposta (informados pelo usuário)");
    lines.push(...generalLines);
  }

  lines.push("\n## Serviços e Respostas Específicas");
  brief.services.forEach((svc, idx) => {
    const typeMeta = SERVICE_SCOPE_TYPE_META[svc.serviceType];
    const modMeta = CONTRACTING_MODALITY_META[svc.modality];
    lines.push(
      `\n### Serviço ${idx + 1}: ${svc.name || typeMeta.label} | Tipo: ${typeMeta.label} | Modalidade: ${modMeta.label}`,
    );
    if (svc.billing) lines.push(`- Cobrança na cotação: ${svc.billing}`);
    const fields = [...SERVICE_TYPE_FIELDS[svc.serviceType], MODALITY_FIELD[svc.modality]];
    for (const f of fields) {
      const val = svc.answers[f.key]?.trim();
      if (val) lines.push(`- ${f.label}: ${val}`);
    }
    if (svc.freeNotes.trim()) {
      lines.push(`- Notas livres do consultor (com suas palavras): ${svc.freeNotes.trim()}`);
    }
  });

  return { system, user: lines.join("\n") };
}

export function parseAiScopeResponse(rawContent: string): ProposalScopeAiResult {
  const trimmed = rawContent
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(trimmed) as {
      html?: unknown;
      sections?: unknown;
    };
    const html = typeof parsed.html === "string" ? sanitizeScopeHtml(parsed.html) : "";
    const rawSections = Array.isArray(parsed.sections)
      ? parsed.sections
          .filter(
            (s): s is { title: string; content: string } =>
              !!s &&
              typeof s === "object" &&
              typeof (s as { title?: unknown }).title === "string" &&
              typeof (s as { content?: unknown }).content === "string",
          )
          .map((s) => ({ title: s.title.trim(), content: s.content.trim() }))
          .filter((s) => s.title || s.content)
      : [];
    const sections = rawSections.length > 0 ? rawSections : extractSectionsFromScopeHtml(html);
    if (html) return { html, sections };
  } catch {
    // Fallback: modelo retornou HTML direto sem JSON.
  }

  const fallbackHtml = sanitizeScopeHtml(rawContent);
  if (!fallbackHtml) throw new Error("A IA não retornou conteúdo para o escopo.");
  return {
    html: fallbackHtml,
    sections: extractSectionsFromScopeHtml(fallbackHtml),
  };
}

export async function generateProposalScopeServer(params: {
  supabase: SupabaseClient;
  userId: string;
  proposalId?: string;
  quoteId?: string;
  dealId?: string;
  brief: ProposalScopeBrief;
  context: ProposalScopeAiContext;
}): Promise<ProposalScopeAiResult> {
  await assertSalesAnyArea(params.supabase, "techsales.proposals", ["create", "update"]);
  await assertSalesReferences(params.supabase, {
    proposals: params.proposalId,
    quotes: params.quoteId,
    deals: params.dealId,
  });
  const workspaceId = await resolveActiveWorkspace(params.userId);

  if (!hasAnyScopeInput(params.brief)) {
    throw new Error("Preencha ao menos um campo ou nota do escopo antes de gerar com IA.");
  }

  const { system, user } = buildScopePromptPayload(params.brief, params.context);
  const res = await aiChatFetch(
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.35,
        response_format: { type: "json_object" },
      }),
    },
    {
      workspaceId,
      userId: params.userId,
      feature: "redacao",
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Falha ao gerar escopo com IA (${res.status}): ${detail.slice(0, 180)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content ?? "";
  return parseAiScopeResponse(content);
}
