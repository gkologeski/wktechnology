import { test, expect } from "@playwright/test";

test("login público carrega sem autenticação", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: /entrar no crm/i })).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.getByRole("button", { name: /^entrar$/i })).toBeVisible();
});