import type { SupabaseClient } from "@supabase/supabase-js";
import { workRpc } from "./work-core.server";
/** Signed OAuth callbacks keep their source workspace, but recheck current
 * active membership and exact action before exchange and before saving tokens. */
export async function assertSalesSourcePermission(
  admin: SupabaseClient,
  userId: string,
  workspaceId: string,
  resource: "techsales.email_accounts" | "system.calendars",
  actions: readonly ("create" | "update")[],
) {
  if (
    !(await workRpc<boolean>(admin, "sales_source_authorize", {
      p_actor: userId,
      p_ws: workspaceId,
      p_resource: resource,
      p_actions: actions,
    }))
  )
    throw new Error("Permissão para conectar a conta foi removida ou o responsável está inativo.");
}
