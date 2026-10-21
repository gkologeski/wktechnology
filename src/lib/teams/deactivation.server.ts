// Inventário e transferência de carteira na desativação de um membro.
// Chamado apenas por server functions que já validaram admin do workspace.

export type TransferScope = {
  openDeals: boolean;
  closedDeals: boolean;
  leads: boolean;
  contactsCompanies: boolean;
  pendingActivities: boolean;
  openConversations: boolean;
};

export type DeactivationInventory = {
  deals_open: number;
  deals_closed: number;
  leads_active: number;
  contacts: number;
  companies: number;
  pending_activities: number;
  open_conversations: number;
};

type Q = {
  table: string;
  key: keyof DeactivationInventory;
  cols: string[];
  apply: (q: any) => any;
  scope: keyof TransferScope;
};

const QUERIES: Q[] = [
  { table: "deals", key: "deals_open", cols: ["assigned_to", "assigned_user_id"], apply: (q) => q.is("closed_at", null), scope: "openDeals" },
  { table: "deals", key: "deals_closed", cols: ["assigned_to", "assigned_user_id"], apply: (q) => q.not("closed_at", "is", null), scope: "closedDeals" },
  { table: "leads", key: "leads_active", cols: ["assigned_to", "assigned_user_id"], apply: (q) => q.neq("status", "disqualified"), scope: "leads" },
  { table: "contacts", key: "contacts", cols: ["assigned_to", "assigned_user_id"], apply: (q) => q, scope: "contactsCompanies" },
  { table: "companies", key: "companies", cols: ["assigned_to", "assigned_user_id"], apply: (q) => q, scope: "contactsCompanies" },
  { table: "activities", key: "pending_activities", cols: ["assigned_to"], apply: (q) => q.eq("completed", false), scope: "pendingActivities" },
  { table: "whatsapp_conversations", key: "open_conversations", cols: ["assigned_to"], apply: (q) => q.eq("status", "open"), scope: "openConversations" },
];

function orFilter(cols: string[], userId: string) {
  return cols.map((c) => `${c}.eq.${userId}`).join(",");
}

export async function getDeactivationInventory(
  workspaceId: string,
  memberId: string,
): Promise<DeactivationInventory> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const out = {} as DeactivationInventory;
  for (const q of QUERIES) {
    let query: any = (supabaseAdmin as any)
      .from(q.table)
      .select("id", { head: true, count: "exact" })
      .eq("workspace_id", workspaceId)
      .or(orFilter(q.cols, memberId));
    query = q.apply(query);
    const { count, error } = await query;
    if (error) throw new Error(`${q.table}: ${error.message}`);
    out[q.key] = count ?? 0;
  }
  return out;
}

export async function transferPortfolio(
  workspaceId: string,
  memberId: string,
  targetId: string,
  scope: TransferScope,
): Promise<Record<string, number>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const result: Record<string, number> = {};
  for (const q of QUERIES) {
    if (!scope[q.scope]) continue;
    let total = 0;
    for (const col of q.cols) {
      let query: any = (supabaseAdmin as any)
        .from(q.table)
        .update({ [col]: targetId }, { count: "exact" })
        .eq("workspace_id", workspaceId)
        .eq(col, memberId);
      query = q.apply(query);
      const { count, error } = await query;
      if (error) throw new Error(`${q.table}: ${error.message}`);
      total = Math.max(total, count ?? 0);
    }
    result[q.key] = total;
  }
  return result;
}
