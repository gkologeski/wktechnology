import { test, expect, hasE2ECredentials } from "./helpers/auth";

/**
 * Diálogos de confirmação:
 *  1. AlertDialog de exclusão em massa de leads (/leads)
 *  2. AlertDialog de exclusão na tela de detalhe do lead
 *  3. ConfirmCountDialog de exclusão em massa de empresas (/companies)
 *     — exige digitar o número para liberar o botão.
 */
test.skip(
  !hasE2ECredentials,
  "Defina E2E_USER_EMAIL/E2E_USER_PASSWORD ou E2E_EMAIL/E2E_PASSWORD para rodar os testes autenticados.",
);

async function seedLead(supa: any, userId: string, workspaceId: string, suffix: string) {
  const { data, error } = await supa
    .from("leads")
    .insert({
      owner_id: userId,
      workspace_id: workspaceId,
      assigned_user_id: userId,
      first_name: `Bulk${suffix}`,
      last_name: "Del",
      email: `bulk+${suffix}@example.com`,
      status: "new",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data!.id as string;
}

test("AlertDialog de exclusão na tela de detalhes do lead", async ({
  authedPage: page,
  supa,
  userId,
  workspaceId,
}) => {
  const id = await seedLead(supa, userId, workspaceId, `det-${Date.now()}`);
  await page.goto(`/leads/${id}`);

  // Botão lixeira no header
  await page.locator('button:has(svg.lucide-trash-2)').first().click();
  const dlg = page.getByRole("alertdialog");
  await expect(dlg.getByText(/excluir lead/i)).toBeVisible();

  // Cancelar primeiro
  await dlg.getByRole("button", { name: /cancelar/i }).click();
  await expect(dlg).not.toBeVisible();

  // Reabre e confirma
  await page.locator('button:has(svg.lucide-trash-2)').first().click();
  await page.getByRole("alertdialog").getByRole("button", { name: /^excluir$/i }).click();

  await page.waitForURL(/\/leads$/);
  const { data } = await supa.from("leads").select("id").eq("id", id).maybeSingle();
  expect(data).toBeNull();
});

test("AlertDialog de exclusão em massa de leads (/leads)", async ({
  authedPage: page,
  supa,
  userId,
  workspaceId,
}) => {
  const ts = Date.now();
  const ids = [
    await seedLead(supa, userId, workspaceId, `b1-${ts}`),
    await seedLead(supa, userId, workspaceId, `b2-${ts}`),
  ];

  await page.goto("/leads");
  // Filtra para garantir que aparecem
  await page.locator('input[placeholder*="Pesquisar" i], input[placeholder*="Buscar" i], input[placeholder*="Search" i]').first().fill(String(ts));
  await page.waitForTimeout(500);

  // Seleciona as duas primeiras linhas via checkbox
  const checkboxes = page.locator('table tbody input[type="checkbox"], table tbody [role="checkbox"]');
  await checkboxes.nth(0).click();
  await checkboxes.nth(1).click();

  await expect(page.getByText(/selecionado\(s\)/i)).toBeVisible();
  await page.getByRole("button", { name: /^excluir$/i }).click();

  const dlg = page.getByRole("alertdialog");
  await expect(dlg).toBeVisible();
  await dlg.getByRole("button", { name: /excluir/i }).click();

  await expect(page.getByText(/excluído\(s\)/i)).toBeVisible({ timeout: 10_000 });

  for (const id of ids) {
    const { data } = await supa.from("leads").select("id").eq("id", id).maybeSingle();
    expect(data).toBeNull();
  }
});

test("ConfirmCountDialog — exige digitar a quantidade (companies)", async ({
  authedPage: page,
  supa,
  userId,
  workspaceId,
}) => {
  const ts = Date.now();
  const names = [`E2E Bulk Co A ${ts}`, `E2E Bulk Co B ${ts}`];
  const inserted = await supa
    .from("companies")
    .insert(names.map((name) => ({ owner_id: userId, workspace_id: workspaceId, assigned_user_id: userId, name })))
    .select("id");
  const ids = (inserted.data ?? []).map((r: any) => r.id);
  expect(ids.length).toBe(2);

  await page.goto("/companies");
  await page.locator('input[placeholder*="Pesquisar" i], input[placeholder*="Buscar" i], input[placeholder*="Search" i]').first().fill(String(ts));
  await page.waitForTimeout(500);

  const rowCbs = page.locator('table tbody input[type="checkbox"], table tbody [role="checkbox"]');
  await rowCbs.nth(0).click();
  await rowCbs.nth(1).click();

  await page.getByRole("button", { name: /^excluir$/i }).click();

  const dlg = page.getByRole("dialog");
  await expect(dlg.getByText(/confirmar exclusão/i)).toBeVisible();

  const confirmBtn = dlg.getByRole("button", { name: /excluir 2/i });
  // Inicialmente desabilitado
  await expect(confirmBtn).toBeDisabled();

  // Número errado mantém desabilitado
  await dlg.locator("#confirm-count").fill("9");
  await expect(confirmBtn).toBeDisabled();

  // Número correto habilita
  await dlg.locator("#confirm-count").fill("2");
  await expect(confirmBtn).toBeEnabled();
  await confirmBtn.click();

  await expect(dlg).not.toBeVisible({ timeout: 10_000 });

  for (const id of ids) {
    const { data } = await supa.from("companies").select("id").eq("id", id).maybeSingle();
    expect(data).toBeNull();
  }
});
