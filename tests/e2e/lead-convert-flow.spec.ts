import { test, expect, hasE2ECredentials } from "./helpers/auth";

/**
 * Fluxo completo: cria Lead → abre tela de detalhes → Converter (AlertDialog)
 *   → valida que Empresa, Contato e Negócio foram criados
 *   → exclui o lead na tela de detalhes (AlertDialog)
 *   → cleanup dos registros derivados via supabase.
 */
test.skip(
  !hasE2ECredentials,
  "Defina E2E_USER_EMAIL/E2E_USER_PASSWORD ou E2E_EMAIL/E2E_PASSWORD para rodar os testes autenticados.",
);

test("Lead → Empresa → Contato → Negócio (tela de detalhes + diálogos)", async ({
  authedPage: page,
  supa,
  userId,
  workspaceId,
}) => {
  const ts = Date.now();
  const firstName = `E2E${ts}`;
  const lastName = "Tester";
  const companyName = `E2E Co ${ts}`;
  const email = `e2e+${ts}@example.com`;

  // ─── Seed: cria lead via Supabase (mais rápido/estável que preencher form) ───
  const { data: lead, error: leadErr } = await supa
    .from("leads")
    .insert({
      owner_id: userId,
      workspace_id: workspaceId,
      assigned_user_id: userId,
      first_name: firstName,
      last_name: lastName,
      email,
      company_name: companyName,
      status: "new",
    })
    .select("id")
    .single();
  expect(leadErr, leadErr?.message).toBeNull();
  const leadId = lead!.id as string;

  // ─── Abre tela de detalhes do lead ───
  await page.goto(`/leads/${leadId}`);
  await expect(page.getByRole("heading", { name: `${firstName} ${lastName}` })).toBeVisible();

  // ─── Diálogo de conversão ───
  await page
    .getByRole("button", { name: /converter/i })
    .first()
    .click();
  const convertDialog = page.getByRole("alertdialog");
  await expect(convertDialog.getByText(/converter lead/i)).toBeVisible();
  await expect(convertDialog.getByText(/qualificado/i)).toBeVisible();
  await convertDialog.getByRole("button", { name: /^converter$/i }).click();

  // Toast de sucesso
  await expect(page.getByText(/lead convertido/i)).toBeVisible({ timeout: 15_000 });

  // ─── Valida criação no banco ───
  const { data: company } = await supa
    .from("companies")
    .select("id, name")
    .ilike("name", companyName)
    .eq("owner_id", userId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  expect(company?.id, "empresa não foi criada").toBeTruthy();
  const companyId = company!.id as string;

  const { data: contact } = await supa
    .from("contacts")
    .select("id, first_name, company_id")
    .eq("email", email)
    .eq("owner_id", userId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  expect(contact?.id, "contato não foi criado").toBeTruthy();
  expect(contact!.company_id).toBe(companyId);

  const { data: deal } = await supa
    .from("deals")
    .select("id, name, stage, company_id, primary_contact_id")
    .eq("primary_contact_id", contact!.id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  expect(deal?.id, "negócio não foi criado").toBeTruthy();
  expect(deal!.stage).toBe("qualified");
  expect(deal!.company_id).toBe(companyId);

  // ─── Valida que as telas de listagem mostram os registros criados ───
  await page.goto("/companies");
  await expect(page.getByText(companyName)).toBeVisible({ timeout: 15_000 });

  await page.goto("/contacts");
  await expect(page.getByText(email)).toBeVisible({ timeout: 15_000 });

  await page.goto("/deals");
  await expect(page.getByText(deal!.name as string)).toBeVisible({ timeout: 15_000 });

  // ─── Cleanup: deleta deal, contact, company, lead ───
  await supa.from("deals").delete().eq("id", deal!.id);
  await supa.from("contacts").delete().eq("id", contact!.id);
  await supa.from("companies").delete().eq("id", companyId);
  await supa.from("leads").delete().eq("id", leadId);
});
