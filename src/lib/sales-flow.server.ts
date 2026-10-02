// Conversões comerciais: Cotação -> Proposta -> Contrato.
// Sempre com o cliente autenticado do usuário (RLS aplicada).
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { assertAnyPermission } from "@/lib/access-control/enforce.server";
import type { DealLineItemRow } from "@/lib/contracts/contract-create.server";
import { describeBilling } from "@/lib/catalog/billing-model";
import {
  SERVICE_LINE_PROPOSAL_SECTIONS,
  isServiceLine,
  serviceLineLabel,
} from "@/lib/sales/service-line";

const QUOTE_ITEM_COLUMNS =
  "id, name, description, quantity, unit_price, discount_pct, discount_amount, discount_type, tax_rate, unit, billing_model, percent, percent_base_amount, cadence, job_profile_id, seniority, service_catalog_id, contracting_preset_id, position";

type QuoteRow = {
  id: string;
  number: string | null;
  title: string | null;
  deal_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  currency: string | null;
  total: number | null;
  terms: string | null;
  notes: string | null;
  valid_until: string | null;
  service_line: string | null;
  assigned_to: string | null;
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(v: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v);
}

async function loadQuote(supabase: SupabaseClient, quoteId: string) {
  const { data: quote, error } = await supabase
    .from("quotes")
    .select(
      "id, number, title, deal_id, contact_id, company_id, currency, total, terms, notes, valid_until, service_line, assigned_to",
    )
    .eq("id", quoteId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!quote) throw new Error("Cotação não encontrada");
  const { data: items, error: iErr } = await supabase
    .from("quote_line_items")
    .select(QUOTE_ITEM_COLUMNS)
    .eq("quote_id", quoteId)
    .order("position");
  if (iErr) throw new Error(iErr.message);
  return {
    quote: quote as unknown as QuoteRow,
    items: (items ?? []) as unknown as DealLineItemRow[],
  };
}

function proposalBodyFromQuote(quote: QuoteRow, items: DealLineItemRow[]): string {
  const currency = quote.currency ?? "BRL";
  const fmt = (v: number) => money(v, currency);
  const rows = items
    .map(
      (li) =>
        `<tr><td>${esc(li.name ?? "Item")}</td><td>${esc(describeBilling(li, fmt))}</td></tr>`,
    )
    .join("");
  const line = isServiceLine(quote.service_line) ? quote.service_line : null;
  const sections = line
    ? SERVICE_LINE_PROPOSAL_SECTIONS[line].map((t) => `<h2>${esc(t)}</h2><p></p>`).join("")
    : "<h2>Escopo</h2><p></p>";
  return [
    `<h1>${esc(quote.title || `Proposta — cotação ${quote.number ?? ""}`)}</h1>`,
    line ? `<p><strong>Linha de serviço:</strong> ${esc(serviceLineLabel(line) ?? "")}</p>` : "",
    `<h2>Itens e condições comerciais</h2><table><thead><tr><th>Item</th><th>Cobrança</th></tr></thead><tbody>${rows}</tbody></table>`,
    `<p><strong>Total:</strong> ${esc(fmt(Number(quote.total ?? 0)))}</p>`,
    sections,
    quote.terms ? `<h2>Termos</h2><p>${esc(quote.terms)}</p>` : "",
  ].join("");
}

export async function proposalFromQuote(supabase: SupabaseClient, userId: string, quoteId: string) {
  const workspaceId = await resolveActiveWorkspace(userId);
  const { quote, items } = await loadQuote(supabase, quoteId);

  const { data: existing } = await supabase
    .from("proposals")
    .select("id")
    .eq("quote_id", quoteId)
    .limit(1)
    .maybeSingle();
  if (existing) return { id: (existing as { id: string }).id, reused: true };

  const { data: prop, error } = await supabase
    .from("proposals")
    .insert({
      owner_id: userId,
      workspace_id: workspaceId,
      title: quote.title || `Proposta — ${quote.number ?? "cotação"}`,
      body: proposalBodyFromQuote(quote, items),
      deal_id: quote.deal_id,
      contact_id: quote.contact_id,
      company_id: quote.company_id,
      total_amount: quote.total != null ? Number(quote.total) : null,
      currency: quote.currency ?? "BRL",
      expires_at: quote.valid_until,
      assigned_to: quote.assigned_to,
      quote_id: quote.id,
      variables: {},
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: (prop as { id: string }).id, reused: false };
}

type ProposalOrigin = {
  id: string;
  title: string;
  deal_id: string | null;
  company_id: string | null;
  total_amount: number | null;
  currency: string | null;
  quote_id: string | null;
  assigned_to: string | null;
};

export async function contractFromSales(
  supabase: SupabaseClient,
  userId: string,
  input: { proposalId?: string; quoteId?: string },
) {
  const workspaceId = await resolveActiveWorkspace(userId);
  await assertAnyPermission(supabase, userId, workspaceId, ["techcontracts.contracts.create.own"]);

  let proposal: ProposalOrigin | null = null;
  if (input.proposalId) {
    const { data, error } = await supabase
      .from("proposals")
      .select("id, title, deal_id, company_id, total_amount, currency, quote_id, assigned_to")
      .eq("id", input.proposalId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Proposta não encontrada");
    proposal = data as unknown as ProposalOrigin;
  }
  const quoteId = input.quoteId ?? proposal?.quote_id ?? null;
  const loaded = quoteId ? await loadQuote(supabase, quoteId) : null;

  // Evita duplicar contrato para a mesma origem.
  const origin = proposal
    ? supabase.from("contracts").select("id, number, title").eq("proposal_id", proposal.id)
    : supabase
        .from("contracts")
        .select("id, number, title")
        .eq("quote_id", quoteId as string);
  const { data: dup } = await origin.limit(1).maybeSingle();
  if (dup) return { contract: dup as { id: string }, reused: true, servicesCreated: 0 };

  const quote = loaded?.quote;
  const { createContractShared } = await import("@/lib/contracts/contract-create.server");
  const result = await createContractShared(supabase, {
    workspaceId,
    userId,
    kind: "provider",
    fields: {
      title: proposal?.title
        ? `Contrato — ${proposal.title}`
        : `Contrato — ${quote?.title || quote?.number || "cotação"}`,
      counterparty_company_id: proposal?.company_id ?? quote?.company_id ?? null,
      total_value:
        proposal?.total_amount != null
          ? Number(proposal.total_amount)
          : quote?.total != null
            ? Number(quote.total)
            : null,
      currency: proposal?.currency ?? quote?.currency ?? null,
      assigned_to: proposal?.assigned_to ?? quote?.assigned_to ?? null,
      service_type: serviceLineLabel(quote?.service_line) ?? null,
      proposal_id: proposal?.id ?? null,
      quote_id: quoteId,
    },
    dealId: proposal?.deal_id ?? quote?.deal_id ?? null,
    items: loaded ? loaded.items : null,
  });
  return { contract: result.contract, reused: false, servicesCreated: result.servicesCreated };
}
