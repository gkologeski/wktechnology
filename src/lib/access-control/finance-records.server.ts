import type { SupabaseClient } from "@supabase/supabase-js";

export async function financeRpc<T>(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const result = await (
    client.rpc as unknown as (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: T; error: { message: string } | null }>
  ).call(client, name, args);
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function assertFinanceEntry(
  client: SupabaseClient,
  id: string,
  action: "view" | "update" | "delete" | "cancel",
) {
  if (
    (await financeRpc(client, "finance_entry_access", { _entry: id, _action: action })) !== true
  ) {
    throw new Error("Lançamento indisponível ou sem permissão para esta ação.");
  }
}
export async function assertFinancePayment(
  client: SupabaseClient,
  entry: string,
  action: "view" | "create" | "delete",
) {
  if (
    (await financeRpc(client, "finance_payment_access", { _entry: entry, _action: action })) !==
    true
  ) {
    throw new Error("Sem permissão para esta operação de baixa.");
  }
}
