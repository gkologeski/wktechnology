// Server-only helper para liquidar um pagamento de saída (AP) — chamado pelo webhook público.
// Marca bank_payments como paid, cria financial_payments no lançamento AP vinculado
// e concilia com a transação de débito correspondente do extrato.
export async function settleBankPaymentAdmin(supabase: any, paymentId: string, paidAtIso: string) {
  const { data: p, error } = await supabase
    .from("bank_payments")
    .select(
      "id, workspace_id, connection_id, financial_entry_id, amount, type, status, external_id",
    )
    .eq("id", paymentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!p) throw new Error("Pagamento não encontrado");
  if (p.status === "paid") return { ok: true, already: true };
  if (!["approved", "processing"].includes(p.status)) {
    throw new Error(`Pagamento em status ${p.status}`);
  }

  const paidDate = paidAtIso.slice(0, 10);
  let financialPaymentId: string | null = null;

  if (p.financial_entry_id) {
    const { data: linkedAccount } = await supabase
      .from("financial_bank_accounts")
      .select("id")
      .eq("workspace_id", p.workspace_id)
      .eq("bank_connection_id", p.connection_id)
      .maybeSingle();

    const { data: pay, error: pErr } = await supabase
      .from("financial_payments")
      .insert({
        workspace_id: p.workspace_id,
        entry_id: p.financial_entry_id,
        bank_account_id: linkedAccount?.id ?? null,
        paid_at: paidDate,
        amount: p.amount,
        method: p.type,
        reference: p.external_id ?? p.id,
        notes: `Pagamento AP — ${p.type.toUpperCase()}`,
      })
      .select("id")
      .single();
    if (pErr) throw new Error(pErr.message);
    financialPaymentId = pay.id;

    const { data: entry } = await supabase
      .from("financial_entries")
      .select("amount, paid_amount")
      .eq("id", p.financial_entry_id)
      .maybeSingle();
    if (entry) {
      const newPaid = Number(entry.paid_amount) + Number(p.amount);
      const newStatus = newPaid + 0.001 >= Number(entry.amount) ? "paid" : "partially_paid";
      await supabase
        .from("financial_entries")
        .update({ paid_amount: newPaid, status: newStatus })
        .eq("id", p.financial_entry_id);
    }
  }

  await supabase
    .from("bank_payments")
    .update({ status: "paid", paid_at: paidAtIso, failure_reason: null })
    .eq("id", paymentId);

  if (financialPaymentId && p.external_id) {
    await supabase
      .from("bank_statement_transactions")
      .update({ reconciliation_status: "matched", matched_payment_id: financialPaymentId })
      .eq("workspace_id", p.workspace_id)
      .eq("connection_id", p.connection_id)
      .eq("external_id", p.external_id);
  }

  return { ok: true, payment_id: financialPaymentId };
}

export async function failBankPaymentAdmin(supabase: any, paymentId: string, reason: string) {
  await supabase
    .from("bank_payments")
    .update({ status: "failed", failure_reason: reason })
    .eq("id", paymentId)
    .in("status", ["approved", "processing"]);
}
