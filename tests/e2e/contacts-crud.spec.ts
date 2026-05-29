import { test, expect, hasE2ECredentials } from "./helpers/auth";

test.skip(
  !hasE2ECredentials,
  "Defina E2E_USER_EMAIL/E2E_USER_PASSWORD para rodar testes autenticados.",
);

async function seedContact(supa: any, userId: string, workspaceId: string, suffix: string) {
  const { data, error } = await supa
    .from("contacts")
    .insert({
      owner_id: userId,
      workspace_id: workspaceId,
      first_name: `E2E${suffix}`,
      last_name: "Contact",
      email: `e2e-contact+${suffix}@example.com`,
      phone: "+5511999990000",
    })
    .select("id, email, first_name")
    .single();
  if (error) throw new Error(error.message);
  return data!;
}

test("Contacts — listagem mostra contato seed e busca filtra por email", async ({
  authedPage: page,
  supa,
  userId,
  workspaceId,
}) => {
  const ts = Date.now();
  const c = await seedContact(supa, userId, workspaceId, String(ts));

  try {
    await page.goto("/contacts");
    await page
      .locator('input[placeholder*="Buscar" i], input[placeholder*="Pesquisar" i]')
      .first()
      .fill(String(ts));
    await expect(page.getByText(c.email)).toBeVisible({ timeout: 15_000 });
  } finally {
    await supa.from("contacts").delete().eq("id", c.id);
  }
});

test("Contacts — tela de detalhes carrega sem erro", async ({
  authedPage: page,
  supa,
  userId,
  workspaceId,
}) => {
  const c = await seedContact(supa, userId, workspaceId, `det-${Date.now()}`);
  try {
    await page.goto(`/contacts/${c.id}`);
    // Heading com nome do contato ou "Voltar" indica que a página renderizou.
    await expect(page.getByText(/E2E.*Contact/i).first()).toBeVisible({ timeout: 15_000 });
    // Não pode estar mostrando erro genérico
    await expect(page.getByText(/Couldn't load|something went wrong/i)).not.toBeVisible();
  } finally {
    await supa.from("contacts").delete().eq("id", c.id);
  }
});

test("Contacts — bulk delete via UI (confirm nativo) remove registros", async ({
  authedPage: page,
  supa,
  userId,
  workspaceId,
}) => {
  const ts = Date.now();
  const a = await seedContact(supa, userId, workspaceId, `ba-${ts}`);
  const b = await seedContact(supa, userId, workspaceId, `bb-${ts}`);
  const ids = [a.id, b.id];

  try {
    await page.goto("/contacts");
    await page
      .locator('input[placeholder*="Buscar" i], input[placeholder*="Pesquisar" i]')
      .first()
      .fill(String(ts));
    await page.waitForTimeout(600);

    const cbs = page.locator('table tbody input[type="checkbox"], table tbody [role="checkbox"]');
    await cbs.nth(0).click();
    await cbs.nth(1).click();

    // Contacts usa confirm() nativo — aceitar automaticamente
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: /^excluir$/i }).click();
    await page.waitForTimeout(1500);

    for (const id of ids) {
      const { data } = await supa.from("contacts").select("id").eq("id", id).maybeSingle();
      expect(data, `contato ${id} ainda existe`).toBeNull();
    }
  } finally {
    // cleanup defensivo
    await supa.from("contacts").delete().in("id", ids);
  }
});
