import type { SupabaseClient } from "@supabase/supabase-js";
import { financeRpc } from "@/lib/access-control/finance-records.server";

export type BankingAction =
  | "view"
  | "connect"
  | "sync"
  | "reconcile"
  | "create_payment"
  | "approve"
  | "execute"
  | "cancel_payment"
  | "create_charge"
  | "cancel_charge"
  | "simulate";

/** Resolve only from caller identity; no tenant/actor supplied by browser. */
export async function bankingContext(
  caller: SupabaseClient<any>,
  action: BankingAction,
  privileged = false,
) {
  const workspaceId = await financeRpc<string>(caller, "banking_authorize", { _action: action });
  if (
    typeof workspaceId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workspaceId)
  )
    throw new Error("Operação bancária não autorizada.");
  if (!privileged) return { supabase: caller as any, workspaceId };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Every privileged query must still bind workspaceId / an already-resolved parent.
  return { supabase: supabaseAdmin as any, workspaceId };
}

export async function validateBankEntry(
  caller: SupabaseClient<any>,
  workspaceId: string,
  id: string | null | undefined,
  direction: "payable" | "receivable",
  amount: number,
) {
  if (!id) return;
  const { data, error } = await caller
    .from("financial_entries")
    .select("id,direction,amount,paid_amount,status")
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .maybeSingle();
  if (
    error ||
    !data ||
    data.direction !== direction ||
    ["paid", "cancelled"].includes(data.status) ||
    Number(data.amount) - Number(data.paid_amount) < amount
  )
    throw new Error("Lançamento indisponível ou saldo insuficiente.");
}
