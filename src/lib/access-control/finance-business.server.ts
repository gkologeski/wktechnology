import type { SupabaseClient } from "@supabase/supabase-js";
import { financeRpc } from "./finance-records.server";
export async function authorizeFinanceBusiness(
  client: SupabaseClient,
  resource: string,
  action = "view",
  id?: string,
) {
  const workspace = await financeRpc<string>(client, "finance_business_authorize", {
    _resource: resource,
    _action: action,
    _id: id ?? null,
  });
  if (
    typeof workspace !== "string" ||
    !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(workspace)
  )
    throw new Error("Não foi possível autorizar a ação financeira.");
  return workspace;
}
