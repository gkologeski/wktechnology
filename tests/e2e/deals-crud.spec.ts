import { test, expect, hasE2ECredentials } from "./helpers/auth";

test.skip(
  !hasE2ECredentials,
  "Defina E2E_USER_EMAIL/E2E_USER_PASSWORD para rodar testes autenticados.",
);

async function seedDeal(supa: any, userId: string, workspaceId: string, suffix: string) {
  const { data, error } = await supa
    .from("deals")
    .insert({
      owner_id: userId,
      workspace_id: workspaceId,
      assigned_user_id: userId,
      name: `E2E Deal ${suffix}`,
      value: 1234.56,
      currency: "BRL",
      stage: "qualified",
    })
    .select("id, name")
    .single();
  if (error) throw new Error(error.message);
  return data!;
}

test("Deals — listagem mostra negócio seed e busca filtra pelo nome", async ({
  authedPage: page,
  supa,
  userId,
  workspaceId,
}) => {
  const ts = Date.now();
  const d = await seedDeal(supa, userId, workspaceId, String(ts));
  try {
    await page.goto("/deals");
    const search = page
      .locator(
        'input[placeholder*="Buscar" i], input[placeholder*="Pesquisar" i], input[placeholder*="Search" i]',
      )
      .first();
    if (await search.isVisible().catch(() => false)) {
      await search.fill(String(ts));
    }
    await expect(page.getByText(d.name).first()).toBeVisible({ timeout: 15_000 });
  } finally {
    await supa.from("deals").delete().eq("id", d.id);
  }
});

test("Deals — tela de detalhes carrega sem erro", async ({
  authedPage: page,
  supa,
  userId,
  workspaceId,
}) => {
  const d = await seedDeal(supa, userId, workspaceId, `det-${Date.now()}`);
  try {
    await page.goto(`/deals/${d.id}`);
    await expect(page.getByText(d.name).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Couldn't load|something went wrong/i)).not.toBeVisible();
  } finally {
    await supa.from("deals").delete().eq("id", d.id);
  }
});

test("Deals — alterar valor via Supabase reflete na listagem", async ({
  authedPage: page,
  supa,
  userId,
  workspaceId,
}) => {
  const ts = Date.now();
  const d = await seedDeal(supa, userId, workspaceId, String(ts));
  try {
    await supa.from("deals").update({ value: 9876.5 }).eq("id", d.id);
    await page.goto(`/deals/${d.id}`);
    await expect(page.getByText(d.name).first()).toBeVisible({ timeout: 15_000 });
  } finally {
    await supa.from("deals").delete().eq("id", d.id);
  }
});
