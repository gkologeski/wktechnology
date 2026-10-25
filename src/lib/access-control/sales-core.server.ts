import type { SupabaseClient } from "@supabase/supabase-js";
import type { SalesAction, SalesTable } from "./sales-resources";
import { workRpc } from "./work-core.server";
import { PermissionDeniedError } from "./enforce.server";
export async function assertSalesArea(
  client: SupabaseClient,
  resource: string,
  action: SalesAction,
) {
  await workRpc(client, "sales_area_authorize", { r: resource, a: action, t: null, i: null });
}
export async function assertSalesRecord(
  client: SupabaseClient,
  table: SalesTable,
  id: string,
  action: SalesAction,
) {
  if ((await workRpc(client, "sales_record_access", { t: table, i: id, a: action })) !== true)
    throw new PermissionDeniedError(["Registro indisponível ou sem permissão para esta ação."]);
}
/** All referenced CRM records must be visible before a privileged side effect. */
export async function assertSalesReferences(
  client: SupabaseClient,
  references: Partial<Record<SalesTable, string | null | undefined>>,
) {
  for (const [table, id] of Object.entries(references))
    if (id) await assertSalesRecord(client, table as SalesTable, id, "view");
}

export async function assertSalesAnyArea(
  client: SupabaseClient,
  resources: string | readonly string[],
  actions: SalesAction | readonly SalesAction[],
) {
  const list = typeof resources === "string" ? [resources] : resources;
  const acts = typeof actions === "string" ? [actions] : actions;
  let last: unknown;
  for (const resource of list)
    for (const action of acts) {
      try {
        await assertSalesArea(client, resource, action);
        return;
      } catch (e) {
        last = e;
      }
    }
  throw last ?? new PermissionDeniedError([]);
}
