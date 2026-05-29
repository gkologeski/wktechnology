import { test, expect, hasE2ECredentials } from "./helpers/auth";

test.skip(
  !hasE2ECredentials,
  "Defina E2E_USER_EMAIL/E2E_USER_PASSWORD para rodar testes autenticados.",
);

async function seedTask(supa: any, userId: string, workspaceId: string, suffix: string) {
  const { data, error } = await supa
    .from("activities")
    .insert({
      owner_id: userId,
      workspace_id: workspaceId,
      type: "task",
      subject: `E2E Task ${suffix}`,
      body: "tarefa de teste automatizado",
      task_status: "NOT_STARTED",
      task_priority: "MEDIUM",
      due_date: new Date(Date.now() + 86_400_000).toISOString(),
    })
    .select("id, subject")
    .single();
  if (error) throw new Error(error.message);
  return data!;
}

test("Tasks — listagem mostra tarefa seed e busca filtra pelo assunto", async ({
  authedPage: page,
  supa,
  userId,
  workspaceId,
}) => {
  const ts = Date.now();
  const t = await seedTask(supa, userId, workspaceId, String(ts));
  try {
    await page.goto("/tasks");
    await page
      .locator('input[placeholder*="Buscar" i], input[placeholder*="Pesquisar" i]')
      .first()
      .fill(String(ts));
    await expect(page.getByText(t.subject).first()).toBeVisible({ timeout: 15_000 });
  } finally {
    await supa.from("activities").delete().eq("id", t.id);
  }
});

test("Tasks — tela de detalhes carrega sem erro", async ({
  authedPage: page,
  supa,
  userId,
  workspaceId,
}) => {
  const t = await seedTask(supa, userId, workspaceId, `det-${Date.now()}`);
  try {
    await page.goto(`/tasks/${t.id}`);
    await expect(page.getByText(t.subject).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Couldn't load|something went wrong/i)).not.toBeVisible();
  } finally {
    await supa.from("activities").delete().eq("id", t.id);
  }
});

test("Tasks — toggle completed via Supabase persiste e listagem filtra completed", async ({
  authedPage: page,
  supa,
  userId,
  workspaceId,
}) => {
  const ts = Date.now();
  const t = await seedTask(supa, userId, workspaceId, String(ts));
  try {
    await supa.from("activities").update({ completed: true, task_status: "COMPLETED" }).eq("id", t.id);
    const { data } = await supa
      .from("activities")
      .select("completed, task_status")
      .eq("id", t.id)
      .single();
    expect(data?.completed).toBe(true);
    expect(data?.task_status).toBe("COMPLETED");

    // A view "Completed" deve listar o item
    await page.goto("/tasks");
    // Tenta clicar na aba "Completed" se existir
    const completedTab = page.getByRole("tab", { name: /completed/i }).or(
      page.getByRole("button", { name: /^completed$/i }),
    );
    if (await completedTab.first().isVisible().catch(() => false)) {
      await completedTab.first().click();
    }
    await page
      .locator('input[placeholder*="Buscar" i], input[placeholder*="Pesquisar" i]')
      .first()
      .fill(String(ts));
    await expect(page.getByText(t.subject).first()).toBeVisible({ timeout: 15_000 });
  } finally {
    await supa.from("activities").delete().eq("id", t.id);
  }
});
