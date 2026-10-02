// Dados do documento da proposta (página, link público e PDF).
// O chamador escolhe o cliente: o do usuário (RLS) na ficha interna, ou o
// administrativo após validar o token público.
import type { SupabaseClient } from "@supabase/supabase-js";
import { describeBilling } from "@/lib/catalog/billing-model";
import {
  DEAL_LINE_ITEM_COLUMNS,
  type DealLineItemRow,
} from "@/lib/contracts/contract-create.server";
import type { ProposalDocumentData } from "./proposal-document-types";

const PROPOSAL_COLUMNS =
  "id, title, body, status, locked, version, total_amount, currency, expires_at, sent_at, decided_at, created_at, public_token, owner_id, company_id, contact_id, deal_id, quote_id";

type ItemRow = DealLineItemRow & {
  service?: { name: string | null } | null;
  preset?: { name: string | null } | null;
};

async function items(sb: SupabaseClient, quoteId: string | null, dealId: string | null) {
  const pick = async (table: "quote_line_items" | "deal_line_items", col: string, id: string) => {
    const { data } = await sb
      .from(table)
      .select(DEAL_LINE_ITEM_COLUMNS)
      .eq(col, id)
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

  const currency = p.currency ?? "BRL";
  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v);
  const [rows, company, contact, agent] = await Promise.all([
    items(sb, p.quote_id, p.deal_id),
    p.company_id ? sb.from("companies").select("name").eq("id", p.company_id).maybeSingle() : null,
    p.contact_id
      ? sb
          .from("contacts")
          .select("first_name, last_name, email")
          .eq("id", p.contact_id)
          .maybeSingle()
      : null,
    sb.from("profiles").select("full_name").eq("id", p.owner_id).maybeSingle(),
  ]);
  const c = contact?.data as {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;

  return {
    proposal: {
      id: p.id,
      title: p.title,
      body: p.body ?? "",
      status: p.status,
      locked: !!p.locked,
      version: p.version,
      total_amount: p.total_amount != null ? Number(p.total_amount) : null,
      currency,
      expires_at: p.expires_at,
      sent_at: p.sent_at,
      decided_at: p.decided_at,
      created_at: p.created_at,
      public_token: p.public_token,
      deal_id: p.deal_id,
      quote_id: p.quote_id,
    },
    items: rows.map((li) => ({
      id: li.id,
      name:
        [...new Set([li.service?.name, li.preset?.name ?? li.name].filter(Boolean))].join(" — ") ||
        li.name ||
        "Item",
      billing: describeBilling(li, fmt),
    })),
    company: (company?.data as { name: string } | null)?.name ?? null,
    contact: c ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || null : null,
    contactEmail: c?.email ?? null,
    agent: (agent.data as { full_name: string | null } | null)?.full_name ?? null,
  };
}
