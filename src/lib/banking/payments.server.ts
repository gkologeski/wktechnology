import { financeRpc } from "@/lib/access-control/finance-records.server";
// Service-only callers. Database lock makes concurrent callback/cron delivery idempotent.
export async function settleBankPaymentAdmin(
  supabase: any,
  paymentId: string,
  paidAtIso: string,
  actorId?: string,
  externalId?: string,
) {
  return financeRpc(supabase, "banking_apply_event", {
    _kind: "payment",
    _id: paymentId,
    _status: "paid",
    _paid_at: paidAtIso,
    _actor: actorId ?? null,
    _external: externalId ?? null,
  });
}
export async function failBankPaymentAdmin(supabase: any, paymentId: string, reason: string) {
  return financeRpc(supabase, "banking_apply_event", {
    _kind: "payment",
    _id: paymentId,
    _status: "failed",
    _reason: reason,
  });
}
