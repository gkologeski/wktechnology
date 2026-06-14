import { test, expect, hasE2ECredentials } from "./helpers/auth";

test.skip(
  !hasE2ECredentials,
  "Defina E2E_USER_EMAIL/E2E_USER_PASSWORD para rodar testes autenticados.",
);

/**
 * Smoke de navegação: cada rota principal autenticada deve carregar sem
 * crash (sem error boundary visível e sem erros de console críticos).
 */
const ROUTES: Array<{ path: string; expect: RegExp }> = [
  { path: "/dashboard", expect: /dashboard|painel|visão geral/i },
  { path: "/leads", expect: /leads/i },
  { path: "/companies", expect: /empresas|companies/i },
  { path: "/contacts", expect: /contatos|contacts/i },
  { path: "/deals", expect: /neg[óo]cios|deals/i },
  { path: "/tasks", expect: /tarefas|tasks/i },
  { path: "/tickets", expect: /tickets|chamados/i },
  { path: "/analytics", expect: /analytics|análise/i },
  { path: "/settings", expect: /configura|settings/i },
];

for (const r of ROUTES) {
  test(`Nav smoke — ${r.path} carrega sem error boundary`, async ({ authedPage: page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    const resp = await page.goto(r.path, { waitUntil: "domcontentloaded" });
    expect(resp?.status() ?? 200, `HTTP ${resp?.status()} em ${r.path}`).toBeLessThan(500);

    // Não deve mostrar error boundary
    await expect(
      page.getByText(/Couldn't load|something went wrong|erro inesperado/i),
    ).not.toBeVisible();

    // Algo da página renderizou
    await expect(page.locator("body")).toContainText(r.expect, { timeout: 15_000 });

    // Erros de console graves (ignora warnings de extension, hot reload, etc.)
    const critical = consoleErrors.filter(
      (e) => !/Download the React DevTools|extension|favicon|sourcemap|404 \(Not Found\)/i.test(e),
    );
    expect(critical, `console errors em ${r.path}:\n${critical.join("\n")}`).toEqual([]);
  });
}
