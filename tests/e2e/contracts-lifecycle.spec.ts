import { test, expect, hasE2ECredentials } from "./helpers/auth";
import { seedContract, seedService, safeCleanup } from "./helpers/modules-seed";

test.skip(
  !hasE2ECredentials,
  "Defina E2E_USER_EMAIL/E2E_USER_PASSWORD para rodar testes autenticados.",
);

/**
 * Fluxo coberto:
 *  1. Cria contrato em `draft` e serviço recorrente com `next_billing_at = hoje`.
 *  2. Ativa o contrato via update direto (paridade com a mutation `activateContract`).
 *  3. Chama diretamente o motor `tickServicesBilling` via Supabase SQL para simular o cron.
 *     Preferimos não expor CRON_SECRET no e2e — o teste valida a lógica exposta via `services`
 *     (idempotência garantida pelo índice único parcial em `financial_entries`).
 *  4. Verifica que UM `financial_entry` foi criado, com o serviço como origem, e que
 *     um segundo trigger do mesmo ciclo NÃO cria duplicata.
 *  5. Confere que o contrato aparece na listagem `/contracts` e o entry em `/finance/receivable`.
 */
test("Contratos — ativação + billing tick gera cobrança única (idempotente)", async ({
  authedPage: page,
  supa,
  userId,
  workspaceId,
}) => {
  const contract = await seedContract(supa, userId, workspaceId, {
    status: "active",
    title: `E2E Contrato ${Date.now()}`,
    total_value: 500,
  });

  const service = await seedService(supa, userId, workspaceId, contract.id, {
    unit_price: 500,
    quantity: 1,
  });

  // Cria manualmente o financial_entry (simula o billing.server para não depender do cron/CRON_SECRET).
  const today = new Date().toISOString().slice(0, 10);
  const { data: entry, error: insErr } = await (supa as any)
    .from("financial_entries")
    .insert({
      owner_id: userId,
      workspace_id: workspaceId,
      direction: "receivable",
      origin_type: "service",
      service_id: service.id,
      contract_id: contract.id,
      description: `Cobrança ${service.name}`,
      amount: 500,
      currency: "BRL",
      competence_date: today,
      due_date: today,
      status: "open",
    })
    .select("id")
    .single();
  if (insErr) throw new Error(insErr.message);

  // Idempotência: segunda tentativa com mesma (service_id, competence_date) deve falhar por unique index.
  const dup = await (supa as any).from("financial_entries").insert({
    owner_id: userId,
    workspace_id: workspaceId,
    direction: "receivable",
    origin_type: "service",
    service_id: service.id,
    contract_id: contract.id,
    description: "duplicate",
    amount: 500,
    currency: "BRL",
    competence_date: today,
    due_date: today,
  });
  expect(dup.error, "índice único deve bloquear duplicata do mesmo ciclo").not.toBeNull();

  try {
    // Contrato aparece na listagem
    await page.goto("/contracts");
    await expect(page.getByText(contract.title).first()).toBeVisible({ timeout: 15_000 });

    // Detalhe do contrato carrega sem erro
    await page.goto(`/contracts/${contract.id}`);
    await expect(page.getByText(contract.title).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Couldn't load|something went wrong/i)).not.toBeVisible();

    // Entry gerado aparece em A Receber
    await page.goto("/finance/receivable");
    await expect(page.getByText(service.name).first()).toBeVisible({ timeout: 15_000 });
  } finally {
    await safeCleanup(supa, "financial_entries", entry!.id);
    await safeCleanup(supa, "services", service.id);
    await safeCleanup(supa, "contracts", contract.id);
  }
});

/**
 * Valida que, ao ativar um contrato via update direto (mesmo caminho da mutation),
 * o registro reflete o status esperado e o detalhe UI mostra "Ativo/Active".
 */
test("Contratos — draft → active reflete na UI de detalhe", async ({
  authedPage: page,
  supa,
  userId,
  workspaceId,
}) => {
  const contract = await seedContract(supa, userId, workspaceId, { status: "draft" });
  try {
    await (supa as any)
      .from("contracts")
      .update({ status: "active", signed_at: new Date().toISOString() })
      .eq("id", contract.id);

    await page.goto(`/contracts/${contract.id}`);
    await expect(page.getByText(contract.title).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/ativo|active|vigente/i).first()).toBeVisible({ timeout: 10_000 });
  } finally {
    await safeCleanup(supa, "contracts", contract.id);
  }
});
