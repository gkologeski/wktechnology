import { test, expect, hasE2ECredentials } from "./helpers/auth";
import { seedProject, seedFinancialEntry, safeCleanup } from "./helpers/modules-seed";

test.skip(
  !hasE2ECredentials,
  "Defina E2E_USER_EMAIL/E2E_USER_PASSWORD para rodar testes autenticados.",
);

/**
 * Fluxo PSA básico:
 *  1. Cria projeto.
 *  2. Cria marco (milestone) billable de R$ 800, tarefa e 2 time entries (uma billable, outra não).
 *  3. Verifica na UI (`/projects/{id}`) que o projeto carrega.
 *  4. Marca o marco como concluído + gera financial_entry manualmente (paridade com completeMilestone).
 *  5. Valida no banco:
 *      - horas billable somam 4h; não-billable somam 2h.
 *      - marco tem financial_entry_id vinculado.
 */
test("PSA — projeto com marco billable e timesheet aparece na UI e gera lançamento", async ({
  authedPage: page,
  supa,
  userId,
  workspaceId,
}) => {
  const project = await seedProject(supa, userId, workspaceId, {
    planned_hours: 10,
    planned_cost: 300,
  });

  // Milestone billable
  const { data: milestone, error: mErr } = await (supa as any)
    .from("project_milestones")
    .insert({
      workspace_id: workspaceId,
      project_id: project.id,
      name: "Marco E2E",
      status: "pending",
      billable: true,
      bill_amount: 800,
    })
    .select("id")
    .single();
  if (mErr) throw new Error(mErr.message);

  // Task
  const { data: task, error: tErr } = await (supa as any)
    .from("project_tasks")
    .insert({
      workspace_id: workspaceId,
      project_id: project.id,
      milestone_id: milestone!.id,
      title: "Tarefa E2E",
      status: "todo",
    })
    .select("id")
    .single();
  if (tErr) throw new Error(tErr.message);

  const today = new Date().toISOString().slice(0, 10);
  const timeIds: string[] = [];
  for (const entry of [
    { hours: 4, billable: true },
    { hours: 2, billable: false },
  ]) {
    const { data, error } = await (supa as any)
      .from("project_time_entries")
      .insert({
        workspace_id: workspaceId,
        project_id: project.id,
        task_id: task!.id,
        user_id: userId,
        entry_date: today,
        hours: entry.hours,
        billable: entry.billable,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    timeIds.push(data!.id);
  }

  let financialEntryId: string | null = null;

  try {
    // UI: detalhe do projeto carrega sem erro
    await page.goto(`/projects/${project.id}`);
    await expect(page.getByText(project.name).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Couldn't load|something went wrong/i)).not.toBeVisible();

    // Conclui marco + cria financial_entry (paridade com completeMilestone)
    const entry = await seedFinancialEntry(supa, userId, workspaceId, {
      description: `Marco: Marco E2E`,
      amount: 800,
      project_id: project.id,
      origin_type: "manual",
    });
    financialEntryId = entry.id;

    await (supa as any)
      .from("project_milestones")
      .update({
        status: "done",
        completed_at: new Date().toISOString(),
        financial_entry_id: entry.id,
      })
      .eq("id", milestone!.id);

    // Assert DB: totais de horas e vínculo do marco
    const { data: times } = await (supa as any)
      .from("project_time_entries")
      .select("hours, billable")
      .eq("project_id", project.id);
    const billable = (times ?? [])
      .filter((r: any) => r.billable)
      .reduce((s: number, r: any) => s + Number(r.hours), 0);
    const nonBillable = (times ?? [])
      .filter((r: any) => !r.billable)
      .reduce((s: number, r: any) => s + Number(r.hours), 0);
    expect(billable).toBe(4);
    expect(nonBillable).toBe(2);

    const { data: msDone } = await (supa as any)
      .from("project_milestones")
      .select("status, financial_entry_id")
      .eq("id", milestone!.id)
      .single();
    expect(msDone?.status).toBe("done");
    expect(msDone?.financial_entry_id).toBe(entry.id);
  } finally {
    for (const id of timeIds) await safeCleanup(supa, "project_time_entries", id);
    await safeCleanup(supa, "project_tasks", task!.id);
    // limpar FK do milestone antes de apagar o entry
    await (supa as any)
      .from("project_milestones")
      .update({ financial_entry_id: null })
      .eq("id", milestone!.id);
    if (financialEntryId) await safeCleanup(supa, "financial_entries", financialEntryId);
    await safeCleanup(supa, "project_milestones", milestone!.id);
    await safeCleanup(supa, "projects", project.id);
  }
});
