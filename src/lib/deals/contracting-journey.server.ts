import type { SupabaseClient } from "@supabase/supabase-js";
import { assertSalesRecord } from "@/lib/access-control/sales-core.server";
import { getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import type { JourneyData } from "./contracting-journey";
async function mayRead(client: SupabaseClient, resource: string, sales: boolean) {
  const { error } = await (client.rpc as any)(
    sales ? "sales_area_authorize" : "work_area_authorize",
    sales ? { r: resource, a: "view", t: null, i: null } : { r: resource, a: "view", i: null },
  );
  if (!error) return true;
  if (error.code === "42501") return false;
  throw new Error(error.message);
}
/** Optional areas gated before queries; caller RLS still controls rows and protected fields. */
export async function loadDealContractingJourney(
  client: SupabaseClient,
  userId: string,
  dealId: string,
): Promise<JourneyData> {
  await assertSalesRecord(client, "deals", dealId, "view");
  const ws = await getActiveWorkspaceId(client, userId);
  const [quotes, proposals, drafts, contracts] = await Promise.all([
    mayRead(client, "techsales.quotes", true),
    mayRead(client, "techsales.proposals", true),
    mayRead(client, "techcontracts.contract_drafts", false),
    mayRead(client, "techcontracts.contracts", false),
  ]);
  const read = async (table: string, columns: string, allowed: boolean) => {
    if (!allowed) return [];
    let query = (client.from as any)(table)
      .select(columns)
      .eq("workspace_id", ws)
      .eq("deal_id", dealId);
    if (table === "contracts") query = query.eq("role", "provider");
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(101);
    if (error) throw new Error(error.message);
    return data ?? [];
  };
  const [q, p, d, c] = await Promise.all([
    read("quotes", "id,title,number,status,total,currency,created_at", quotes),
    read(
      "proposals",
      "id,title,status,quote_id,version,locked,decided_at,total_amount,currency,legal_entity_id,created_at",
      proposals,
    ),
    read(
      "contract_drafts",
      "id,title,status,proposal_id,legal_entity_id,revision,client_decided_at,client_note,missing_template,prepared_terms,created_at,updated_at",
      drafts,
    ),
    read(
      "contracts",
      "id,title,number,status,proposal_id,quote_id,document_kind,starts_at,ends_at,created_at",
      contracts,
    ),
  ]);
  const contractRows = c.slice(0, 100) as { id: string }[];
  const legal = new Map<string, boolean>();
  if (contractRows.length) {
    const { data: approvals, error } = await (client.from as any)("contract_approvals")
      .select("contract_id,status,superseded_at")
      .eq("workspace_id", ws)
      .eq("stage", "legal")
      .in(
        "contract_id",
        contractRows.map((x) => x.id),
      );
    if (error && error.code !== "42501") throw new Error(error.message);
    for (const a of (approvals ?? []) as {
      contract_id: string;
      status: string;
      superseded_at: string | null;
    }[])
      if (!a.superseded_at)
        legal.set(a.contract_id, (legal.get(a.contract_id) ?? true) && a.status === "approved");
  }
  return {
    quotes: q.slice(0, 100),
    proposals: p.slice(0, 100),
    drafts: d.slice(0, 100),
    contracts: contractRows.map((x) => ({ ...x, legal_approved: legal.get(x.id) ?? false })) as any,
    access: { quotes, proposals, drafts, contracts },
    truncated: [q, p, d, c].some((x) => x.length > 100),
  };
}
