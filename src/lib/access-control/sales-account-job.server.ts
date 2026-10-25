import type { SupabaseClient } from "@supabase/supabase-js";
import { workRpc } from "./work-core.server";
export async function assertSalesAccountJob(
  admin: SupabaseClient,
  table: "email_accounts" | "calendar_accounts",
  id: string,
) {
  if (!(await workRpc<boolean>(admin, "sales_account_job_authorize", { p_table: table, p_id: id })))
    throw new Error(
      "Sincronização suspensa: proprietário inativo ou sem permissão atual para sincronizar a conta.",
    );
}
