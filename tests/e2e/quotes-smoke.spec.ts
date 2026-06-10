// Smoke E2E para o módulo de Cotações: garante que a página de templates
// e a listagem de produtos abrem sem error boundary para um Admin.
import { test, expect, hasE2ECredentials } from "./helpers/auth";

test.skip(
  !hasE2ECredentials,
  "Defina E2E_USER_EMAIL/E2E_USER_PASSWORD para rodar testes autenticados.",
);

test("Cotações — settings carregam sem error boundary", async ({ authedPage: page }) => {
  for (const path of ["/settings/quotes", "/settings/quote-templates", "/settings/products"]) {
    const resp = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(resp?.status() ?? 200, `HTTP ${resp?.status()} em ${path}`).toBeLessThan(500);
    await expect(
      page.getByText(/Couldn't load|something went wrong|erro inesperado/i),
    ).not.toBeVisible();
  }
});
