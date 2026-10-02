// Rascunho da proposta para o assistente: dados de identificação, itens de
// linha (da cotação ou do negócio) e serviços do catálogo usados para sugerir
// o modelo de proposta. Usa o cliente do usuário (RLS aplicada). Não grava.
import type { SupabaseClient } from "@supabase/supabase-js";
import { describeBilling } from "@/lib/catalog/billing-model";
import {
  DEAL_LINE_ITEM_COLUMNS,
  type DealLineItemRow,
} from "@/lib/contracts/contract-create.server";

import type {
  ProposalDraftItem,
  ProposalDraftResult,
  ProposalDraftSource,
} from "./proposal-draft-types";

const QUOTE_ITEM_COLUMNS = DEAL_LINE_ITEM_COLUMNS + ", position";

function money(v: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v);
}

type ItemRow = DealLineItemRow & {
  service?: { name: string | null } | null;
  preset?: { name: string | null } | null;
};

function toItems(rows: ItemRow[], currency: string): ProposalDraftItem[] {
  const fmt = (v: number) => money(v, currency);
  return rows.map((li) => {
    const label = [...new Set([li.service?.name, li.preset?.name ?? li.name].filter(Boolean))].join(
      " — ",
    );
    return {
      id: li.id,
      name: label || li.name || "Item",
      billing: describeBilling(li, fmt),
      service_catalog_id: li.service_catalog_id,
    };
  });
}

async function loadItems(
  supabase: SupabaseClient,
  quoteId: string | null,
  dealId: string | null,
  currency: string,
) {
  if (quoteId) {
    const { data, error } = await supabase
      .from("quote_line_items")
      .select(QUOTE_ITEM_COLUMNS)
      .eq("quote_id", quoteId)
      .order("position");
    if (error) throw new Error(error.message);
    if ((data ?? []).length > 0)
      return { items: toItems(data as unknown as ItemRow[], currency), origin: "quote" as const };
  }
  if (dealId) {
    const { data, error } = await supabase
      .from("deal_line_items")
      .select(DEAL_LINE_ITEM_COLUMNS)
      .eq("deal_id", dealId)
      .order("position");
    if (error) throw new Error(error.message);
    return { items: toItems(data as unknown as ItemRow[], currency), origin: "deal" as const };
  }
  return { items: [], origin: null };
}

async function names(
  supabase: SupabaseClient,
  ids: { company: string | null; contact: string | null; deal: string | null },
) {
  const [c, p, d] = await Promise.all([
    ids.company
      ? supabase.from("companies").select("name").eq("id", ids.company).maybeSingle()
      : null,
    ids.contact
      ? supabase
          .from("contacts")
          .select("first_name, last_name")
          .eq("id", ids.contact)
          .maybeSingle()
      : null,
    ids.deal ? supabase.from("deals").select("name").eq("id", ids.deal).maybeSingle() : null,
  ]);
  const contact = p?.data as { first_name: string | null; last_name: string | null } | null;
  return {
    company_name: (c?.data as { name: string } | null)?.name ?? null,
    contact_name: contact
      ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || null
      : null,
    deal_name: (d?.data as { name: string } | null)?.name ?? null,
  };
}

export async function buildProposalDraft(
  supabase: SupabaseClient,
  src: ProposalDraftSource,
): Promise<ProposalDraftResult> {
  if (src.quoteId) {
    const { data: existing } = await supabase
      .from("proposals")
      .select("id")
      .eq("quote_id", src.quoteId)
      .limit(1)
      .maybeSingle();
    if (existing) return { reused: true, existingId: (existing as { id: string }).id };
    const { data: q, error } = await supabase
      .from("quotes")
      .select(
        "id, number, title, deal_id, contact_id, company_id, currency, total, valid_until, assigned_to",
      )
      .eq("id", src.quoteId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!q) throw new Error("Cotação não encontrada");
    const currency = q.currency ?? "BRL";
    const { items, origin } = await loadItems(supabase, q.id, q.deal_id, currency);
    return {
      reused: false,
      draft: {
        title: q.title || `Proposta — ${q.number ?? "cotação"}`,
        body: "",
        total_amount: q.total != null ? Number(q.total) : null,
        currency,
        expires_at: q.valid_until,
        assigned_to: q.assigned_to,
        company_id: q.company_id,
        contact_id: q.contact_id,
        deal_id: q.deal_id,
        quote_id: q.id,
        quote_number: q.number,
        proposal_template_id: null,
        items,
        items_origin: origin,
        ...(await names(supabase, {
          company: q.company_id,
          contact: q.contact_id,
          deal: q.deal_id,
        })),
      },
    };
  }

  if (src.proposalId) {
    const { data: p, error } = await supabase
      .from("proposals")
      .select(
        "id, title, body, total_amount, currency, expires_at, assigned_to, locked, company_id, contact_id, deal_id, quote_id, proposal_template_id",
      )
      .eq("id", src.proposalId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!p) throw new Error("Proposta não encontrada");
    if (p.locked) throw new Error("Proposta travada: não pode ser editada.");
    const currency = p.currency ?? "BRL";
    const { items, origin } = await loadItems(supabase, p.quote_id, p.deal_id, currency);
    return {
      reused: false,
      draft: {
        title: p.title,
        body: p.body ?? "",
        total_amount: p.total_amount != null ? Number(p.total_amount) : null,
        currency,
        expires_at: p.expires_at,
        assigned_to: p.assigned_to,
        company_id: p.company_id,
        contact_id: p.contact_id,
        deal_id: p.deal_id,
        quote_id: p.quote_id,
        quote_number: null,
        proposal_template_id: p.proposal_template_id,
        items,
        items_origin: origin,
        ...(await names(supabase, {
          company: p.company_id,
          contact: p.contact_id,
          deal: p.deal_id,
        })),
      },
    };
  }

  if (!src.dealId) throw new Error("Informe a cotação, o negócio ou a proposta.");
  const { data: deal, error } = await supabase
    .from("deals")
    .select("id, name, value, currency, assigned_to, company_id, primary_contact_id")
    .eq("id", src.dealId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!deal) throw new Error("Negócio não encontrado");
  const currency = deal.currency ?? "BRL";
  const { items, origin } = await loadItems(supabase, null, deal.id, currency);
  return {
    reused: false,
    draft: {
      title: `Proposta — ${deal.name}`,
      body: "",
      total_amount: deal.value != null ? Number(deal.value) : null,
      currency,
      expires_at: null,
      assigned_to: deal.assigned_to,
      company_id: deal.company_id,
      contact_id: deal.primary_contact_id,
      deal_id: deal.id,
      quote_id: null,
      quote_number: null,
      proposal_template_id: null,
      items,
      items_origin: origin,
      ...(await names(supabase, {
        company: deal.company_id,
        contact: deal.primary_contact_id,
        deal: deal.id,
      })),
    },
  };
}
