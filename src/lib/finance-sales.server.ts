// Vendas importadas do Conta Azul — leitura no servidor com o cliente do
// usuário (RLS de finance_sales) depois de checar a permissão no banco.
import type { SupabaseClient } from "@supabase/supabase-js";

export type SalesFilter = {
  search?: string;
  status?: string | null;
  from?: string | null;
  to?: string | null;
  page: number;
};

export const SALES_PAGE_SIZE = 50;

/** Exige `techfinance.sales.view.workspace` com membro ativo e sem bloqueio. */
export async function assertSalesView(
  client: SupabaseClient,
  workspaceId: string,
  userId: string,
): Promise<void> {
  const { data, error } = await client.rpc("finance_sales_access", {
    p_ws: workspaceId,
    p_user: userId,
  });
  if (error || data !== true) throw new Error("Sem permissão para consultar as vendas.");
}

type Query = ReturnType<ReturnType<SupabaseClient["from"]>["select"]>;

function applyFilters<Q extends Query>(
  q: Q,
  workspaceId: string,
  f: SalesFilter,
  withStatus: boolean,
): Q {
  let out = q.eq("workspace_id", workspaceId) as Q;
  const term = f.search?.trim().replace(/[%_,()]/g, " ");
  if (term) out = out.ilike("customer_name", `%${term}%`) as Q;
  if (f.from) out = out.gte("sale_date", f.from) as Q;
  if (f.to) out = out.lte("sale_date", f.to) as Q;
  if (withStatus && f.status) out = out.eq("status_label", f.status) as Q;
  return out;
}

export async function listSales(client: SupabaseClient, workspaceId: string, f: SalesFilter) {
  const from = f.page * SALES_PAGE_SIZE;
  const rowsQ = applyFilters(
    client
      .from("finance_sales")
      .select(
        "id, number, sale_date, status_label, items_kind, total, customer_name, company_id, contact_id",
        { count: "exact" },
      ),
    workspaceId,
    f,
    true,
  )
    .order("sale_date", { ascending: false, nullsFirst: false })
    .order("number", { ascending: false })
    .range(from, from + SALES_PAGE_SIZE - 1);
  // Resumo do período (sem o filtro de situação, para mostrar a distribuição).
  const sumQ = applyFilters(
    client.from("finance_sales").select("total, status_label"),
    workspaceId,
    f,
    false,
  ).limit(20000);
  const [rows, sums] = await Promise.all([rowsQ, sumQ]);
  if (rows.error) throw new Error(rows.error.message);
  if (sums.error) throw new Error(sums.error.message);
  const byStatus: Record<string, { count: number; total: number }> = {};
  let total = 0;
  for (const r of (sums.data ?? []) as Array<{
    total: number | string;
    status_label: string | null;
  }>) {
    const k = r.status_label ?? "Sem situação";
    const v = Number(r.total) || 0;
    byStatus[k] = { count: (byStatus[k]?.count ?? 0) + 1, total: (byStatus[k]?.total ?? 0) + v };
    total += v;
  }
  return {
    rows: (rows.data ?? []) as Array<{
      id: string;
      number: number | null;
      sale_date: string | null;
      status_label: string | null;
      items_kind: string | null;
      total: number | string;
      customer_name: string | null;
      company_id: string | null;
      contact_id: string | null;
    }>,
    count: rows.count ?? 0,
    summary: { count: (sums.data ?? []).length, total: Math.round(total * 100) / 100, byStatus },
  };
}
