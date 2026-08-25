// Server-only helper para liquidar uma cobrança (chamado pelo webhook público).
// Recebe um cliente Supabase (tipicamente supabaseAdmin — RLS bypass) e o workspace_id
// derivado da própria cobrança, para evitar depender do contexto de auth.
export async function settleChargePaymentAdmin(supabase: any, chargeId: string, paidAtIso: string) {
  const { data: charge, error } = await supabase
    .from("bank_charges")
    .select(
      "id, workspace_id, connection_id, financial_entry_id, amount, type, status, external_id",
    )
    .eq("id", chargeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!charge) throw new Error("Cobrança não encontrada");
  if (charge.status === "paid") return { ok: true, already: true };
  if (charge.status !== "pending") throw new Error(`Cobrança em status ${charge.status}`);

  const paidDate = paidAtIso.slice(0, 10);

  let paymentId: string | null = null;
  if (charge.financial_entry_id) {
    const { data: linkedAccount } = await supabase
      .from("financial_bank_accounts")
      .select("id")
      .eq("workspace_id", charge.workspace_id)
      .eq("bank_connection_id", charge.connection_id)
      .maybeSingle();

    const { data: pay, error: pErr } = await supabase
      .from("financial_payments")
      .insert({
        workspace_id: charge.workspace_id,
        entry_id: charge.financial_entry_id,
        bank_account_id: linkedAccount?.id ?? null,
        paid_at: paidDate,
        amount: charge.amount,
        method: charge.type,
        reference: charge.external_id ?? charge.id,
        notes: `Liquidação webhook — ${charge.type.toUpperCase()}`,
      })
      .select("id")
      .single();
    if (pErr) throw new Error(pErr.message);
    paymentId = pay.id;

    const { data: entry } = await supabase
      .from("financial_entries")
      .select("amount, paid_amount")
      .eq("id", charge.financial_entry_id)
      .maybeSingle();
    if (entry) {
      const newPaid = Number(entry.paid_amount) + Number(charge.amount);
      const newStatus = newPaid + 0.001 >= Number(entry.amount) ? "paid" : "partially_paid";
      await supabase
        .from("financial_entries")
        .update({ paid_amount: newPaid, status: newStatus })
        .eq("id", charge.financial_entry_id);
    }
  }

  await supabase
    .from("bank_charges")
    .update({ status: "paid", paid_at: paidAtIso })
    .eq("id", chargeId);

  if (paymentId && charge.external_id) {
    await supabase
      .from("bank_statement_transactions")
      .update({ reconciliation_status: "matched", matched_payment_id: paymentId })
      .eq("workspace_id", charge.workspace_id)
      .eq("connection_id", charge.connection_id)
      .eq("external_id", charge.external_id);
  }

  return { ok: true, payment_id: paymentId };
}
