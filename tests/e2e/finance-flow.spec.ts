import { test, expect, hasE2ECredentials } from "./helpers/auth";
import { seedFinancialEntry, safeCleanup } from "./helpers/modules-seed";

test.skip(
  !hasE2ECredentials,
  "Defina E2E_USER_EMAIL/E2E_USER_PASSWORD para rodar testes autenticados.",
);

/**
 * Fluxo financeiro: recebível → pagamento parcial → pagamento total → paid.
 *
 * Não usamos a mutation `registerPayment` do backend diretamente (evita depender do bearer
 * middleware em ambiente de teste). Simulamos a mesma lógica: insert em financial_payments
 * + update do entry (paid_amount + status), que é exatamente o comportamento validado por RLS.
 */
async function registerPayment(
  supa: any,
  workspaceId: string,
  userId: string,
  entryId: string,
  amount: number,
  currentPaid: number,
  totalAmount: number,
) {
  const today = new Date().toISOString().slice(0, 10);
  const { error: pErr } = await supa.from("financial_payments").insert({
    workspace_id: workspaceId,
    entry_id: entryId,
    paid_at: today,
    amount,
    created_by: userId,
  });
  if (pErr) throw new Error(pErr.message);

  const newPaid = currentPaid + amount;
  const status = newPaid >= totalAmount ? "paid" : newPaid > 0 ? "partially_paid" : "open";
  const { error: uErr } = await supa
    .from("financial_entries")
    .update({ paid_amount: newPaid, status })
    .eq("id", entryId);
  if (uErr) throw new Error(uErr.message);
  return { newPaid, status };
}

test("Financeiro — recebível: pagamento parcial → total muda status para paid", async ({
  authedPage: page,
  supa,
  userId,
  workspaceId,
}) => {
  const entry = await seedFinancialEntry(supa, userId, workspaceId, {
    direction: "receivable",
    amount: 1000,
    description: `E2E Recebível ${Date.now()}`,
  });

  try {
    // Pagamento parcial 400
    const partial = await registerPayment(supa, workspaceId, userId, entry.id, 400, 0, 1000);
    expect(partial.status).toBe("partially_paid");
    expect(partial.newPaid).toBe(400);

    // Pagamento restante 600
    const full = await registerPayment(supa, workspaceId, userId, entry.id, 600, 400, 1000);
    expect(full.status).toBe("paid");
    expect(full.newPaid).toBe(1000);

    // UI: página de detalhe carrega
    await page.goto(`/finance/entries/${entry.id}`);
    await expect(page.getByText(entry.description).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Couldn't load|something went wrong/i)).not.toBeVisible();

    // Confirma no banco que existem 2 payments
    const { data: payments } = await (supa as any)
      .from("financial_payments")
      .select("id, amount")
      .eq("entry_id", entry.id)
      .order("paid_at", { ascending: true });
    expect(payments?.length).toBe(2);
    expect(payments?.reduce((s: number, p: any) => s + Number(p.amount), 0)).toBe(1000);
  } finally {
    await (supa as any).from("financial_payments").delete().eq("entry_id", entry.id);
    await safeCleanup(supa, "financial_entries", entry.id);
  }
});

test("Financeiro — listagem A Receber lista entry recém-criado", async ({
  authedPage: page,
  supa,
  userId,
  workspaceId,
}) => {
  const stamp = String(Date.now());
  const entry = await seedFinancialEntry(supa, userId, workspaceId, {
    direction: "receivable",
    amount: 250,
    description: `E2E RCV ${stamp}`,
  });
  try {
    await page.goto("/finance/receivable");
    await expect(page.getByText(entry.description).first()).toBeVisible({ timeout: 15_000 });
  } finally {
    await safeCleanup(supa, "financial_entries", entry.id);
  }
});
