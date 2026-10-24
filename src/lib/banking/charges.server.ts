import { financeRpc } from "@/lib/access-control/finance-records.server";
export async function settleChargePaymentAdmin(supabase: any, chargeId: string, paidAtIso: string) {
  return financeRpc(supabase, "banking_apply_event", {
    _kind: "charge",
    _id: chargeId,
    _status: "paid",
    _paid_at: paidAtIso,
  });
}
