// Dados do documento da proposta (página, link público e PDF).
// O chamador escolhe o cliente: o do usuário (RLS) na ficha interna, ou o
// administrativo após validar o token público.
import { workRpc } from "@/lib/access-control/work-core.server";
import type { AcceptedProposalSource } from "@/lib/contracts/accepted-proposal.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describeBilling } from "@/lib/catalog/billing-model";
import {
  DEAL_LINE_ITEM_COLUMNS,
  type DealLineItemRow,
} from "@/lib/contracts/contract-create.server";
import { buildProposalVisualContext } from "./proposal-assets.server";
import { tryParseVisualDesign } from "./visual-design";
import { renderVisualDesignPagesHtml } from "./visual-renderer";
import type { ProposalDocumentData } from "./proposal-document-types";

const PROPOSAL_COLUMNS =
  "id, workspace_id, title, body, design_json, status, locked, version, total_amount, currency, expires_at, sent_at, decided_at, created_at, owner_id, company_id, contact_id, deal_id, quote_id, legal_entity_id, payment_method, installments_count, validity_days, payment_terms";

type ItemRow = DealLineItemRow & {
  service?: { name: string | null } | null;
  preset?: { name: string | null } | null;
};

async function items(
  sb: SupabaseClient,
  quoteId: string | null,
  dealId: string | null,
  workspaceId: string,
) {
  const pick = async (table: "quote_line_items" | "deal_line_items", col: string, id: string) => {
    const { data } = await sb
      .from(table)
      .select(DEAL_LINE_ITEM_COLUMNS)
      .eq(col, id)
      .eq("workspace_id", workspaceId)
      .order("position");
    return (data ?? []) as unknown as ItemRow[];
  };
  let rows: ItemRow[] = [];
  if (quoteId) rows = await pick("quote_line_items", "quote_id", quoteId);
  if (!rows.length && dealId) rows = await pick("deal_line_items", "deal_id", dealId);
  return rows;
}

export async function loadProposalDocument(
  sb: SupabaseClient,
  by: { id: string } | { token: string },
): Promise<ProposalDocumentData> {
  let q = sb.from("proposals").select(PROPOSAL_COLUMNS);
  q = "id" in by ? q.eq("id", by.id) : q.eq("public_token", by.token);
  const { data: p, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  if (!p) throw new Error("Proposta não encontrada");
  if (
    "token" in by &&
    (!["sent", "accepted", "rejected"].includes(p.status) || !p.locked || !p.sent_at)
  )
    throw new Error("Proposta ainda não disponível.");

  const preserved = p.locked
    ? await workRpc<AcceptedProposalSource | null>(sb, "proposal_document_snapshot", {
        p_id: p.id,
        p_version: p.version,
      })
    : null;
  const content = preserved?.proposal ?? p;
  const currency = content.currency ?? "BRL";
  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v);
  const [rows, company, contact, agent] = await Promise.all([
    preserved ? (preserved.items as ItemRow[]) : items(sb, p.quote_id, p.deal_id, p.workspace_id),
    preserved
      ? { data: preserved.company }
      : p.company_id
        ? sb
            .from("companies")
            .select("name, cnpj, custom_fields")
            .eq("id", p.company_id)
            .eq("workspace_id", p.workspace_id)
            .maybeSingle()
        : null,
    preserved
      ? { data: preserved.contact }
      : p.contact_id
        ? sb
            .from("contacts")
            .select("first_name, last_name, email")
            .eq("id", p.contact_id)
            .eq("workspace_id", p.workspace_id)
            .maybeSingle()
        : null,
    preserved
      ? { data: { full_name: preserved.agent } }
      : sb.from("profiles").select("full_name").eq("id", p.owner_id).maybeSingle(),
  ]);
  const c = contact?.data as {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
  const companyData = company?.data as {
    name?: string | null;
    cnpj?: string | null;
    custom_fields?: Record<string, unknown> | null;
  } | null;
  const mappedItems = rows.map((li) => ({
    id: li.id,
    name:
      [...new Set([li.service?.name, li.preset?.name ?? li.name].filter(Boolean))].join(" — ") ||
      li.name ||
      "Item",
    billing: describeBilling(li, fmt),
  }));
  const companyName = companyData?.name ?? null;
  const contactName = c ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || null : null;
  const agentName = (agent.data as { full_name: string | null } | null)?.full_name ?? null;

  const rawDesign =
    (preserved?.proposal as { design_json?: unknown } | undefined)?.design_json ??
    (p as { design_json?: unknown }).design_json ??
    null;
  const parsedDesign = tryParseVisualDesign(rawDesign);
  let visualHtml: string | null = null;
  let visualOrientation: "portrait" | "landscape" | null = null;
  if (parsedDesign) {
    let dealName: string | null = null;
    if (content.deal_id) {
      const { data: dealRow } = await sb
        .from("deals")
        .select("name")
        .eq("id", content.deal_id)
        .eq("workspace_id", p.workspace_id)
        .maybeSingle();
      dealName = (dealRow as { name?: string } | null)?.name ?? null;
    }
    const visualCtx = await buildProposalVisualContext(
      sb,
      {
        workspaceId: p.workspace_id,
        title: content.title,
        currency,
        totalAmount: content.total_amount != null ? Number(content.total_amount) : null,
        createdAt: p.created_at,
        expiresAt: p.expires_at,
        validityDays: p.validity_days ?? null,
        paymentMethod: p.payment_method ?? null,
        installmentsCount: p.installments_count ?? null,
        paymentTerms: p.payment_terms ?? null,
        companyName,
        companyLegalName:
          (companyData?.custom_fields?.["razao_social"] as string | undefined) ?? companyName,
        companyCnpj: companyData?.cnpj ?? null,
        contactName,
        contactEmail: c?.email ?? null,
        dealName,
        agentName,
        legalEntityId: p.legal_entity_id ?? null,
        items: mappedItems,
      },
      parsedDesign,
    );
    visualHtml = renderVisualDesignPagesHtml(parsedDesign, visualCtx);
    visualOrientation = parsedDesign.orientation;
  }

  return {
    proposal: {
      id: p.id,
      title: content.title,
      body: content.body ?? "",
      status: p.status,
      locked: !!p.locked,
      version: content.version,
      total_amount: content.total_amount != null ? Number(content.total_amount) : null,
      currency,
      expires_at: p.expires_at,
      sent_at: p.sent_at,
      decided_at: p.decided_at,
      created_at: p.created_at,
      public_token: "token" in by ? by.token : null,
      deal_id: content.deal_id,
      quote_id: content.quote_id,
    },
    items: mappedItems,
    company: companyName,
    contact: contactName,
    contactEmail: c?.email ?? null,
    agent: agentName,
    visualHtml,
    visualOrientation,
  };
}
