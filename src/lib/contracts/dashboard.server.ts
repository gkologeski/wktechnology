import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContractDashboardData, ContractDashboardItem } from "./dashboard.types";

type ContractRow = {
  id: string;
  number: string | null;
  title: string;
  status: string;
  total_value: number | null;
  ends_at: string | null;
  auto_renew: boolean | null;
  created_at: string;
};

const ACTIVE = new Set(["active", "renewing"]);
const AWAITING = new Set(["in_review", "in_negotiation", "awaiting_signature"]);

function item(row: ContractRow): ContractDashboardItem {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    status: row.status,
    totalValue: Number(row.total_value ?? 0),
    endsAt: row.ends_at,
    autoRenew: Boolean(row.auto_renew),
  };
}

export async function loadContractDashboard(
  supabase: SupabaseClient,
): Promise<ContractDashboardData> {
  const { data, error } = await supabase
    .from("contracts")
    .select("id, number, title, status, total_value, ends_at, auto_renew, created_at")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw new Error(`Não foi possível carregar os contratos: ${error.message}`);

  const rows = (data ?? []) as ContractRow[];
  const now = new Date();
  const inThirtyDays = new Date(now);
  inThirtyDays.setDate(inThirtyDays.getDate() + 30);
  const statusMap = new Map<string, number>();
  for (const row of rows) statusMap.set(row.status, (statusMap.get(row.status) ?? 0) + 1);

  const active = rows.filter((row) => ACTIVE.has(row.status));
  const expiring = active
    .filter((row) => {
      if (!row.ends_at) return false;
      const end = new Date(row.ends_at);
      return end >= now && end <= inThirtyDays;
    })
    .sort((a, b) => String(a.ends_at).localeCompare(String(b.ends_at)));
  const attention = rows
    .filter((row) => {
      if (AWAITING.has(row.status)) return true;
      return ACTIVE.has(row.status) && Boolean(row.ends_at) && new Date(String(row.ends_at)) < now;
    })
    .sort((a, b) =>
      String(a.ends_at ?? a.created_at).localeCompare(String(b.ends_at ?? b.created_at)),
    );

  return {
    activeCount: active.length,
    activeValue: active.reduce((sum, row) => sum + Number(row.total_value ?? 0), 0),
    awaitingCount: rows.filter((row) => AWAITING.has(row.status)).length,
    expiringCount: expiring.length,
    statusCounts: Array.from(statusMap, ([status, count]) => ({ status, count })).sort(
      (a, b) => b.count - a.count,
    ),
    expiring: expiring.slice(0, 8).map(item),
    attention: attention.slice(0, 8).map(item),
    recent: rows.slice(0, 8).map(item),
  };
}
