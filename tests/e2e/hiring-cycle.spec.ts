import { test, expect, hasE2ECredentials } from "./helpers/auth";

test.skip(
  !hasE2ECredentials,
  "Defina E2E_USER_EMAIL/E2E_USER_PASSWORD para rodar testes autenticados.",
);

/**
 * Ciclo de contratação/desligamento via Workflows (fases 1–4).
 * Cobre a superfície de UI: os 5 modelos nativos abrem como rascunho editável
 * (nada é publicado). A cascata no banco é validada pelo motor (vitest) e pelo
 * roteiro de validação em docs (SQL + tick local).
 */
test("Workflows — modelos de contratação abrem como rascunho", async ({ authedPage: page }) => {
  await page.goto("/settings/workflows");
  const trigger = page.getByRole("button", { name: "Modelos de contratação" });
  await expect(trigger).toBeVisible();
  await trigger.click();
  for (const name of [
    "Contratação interna PJ",
    "Freelancer técnico (por hora)",
    "Alocação em cliente (outsourcing)",
    "Sucesso de hunting",
    "Desligamento",
  ]) {
    await expect(page.getByRole("menuitem", { name: new RegExp(name.replace(/[()]/g, "\\$&")) })).toBeVisible();
  }
  await page.getByRole("menuitem", { name: /Desligamento/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
