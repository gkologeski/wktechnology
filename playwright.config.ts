import { resolveE2EEnvironment } from "./scripts/e2e-environment.mjs";
import { defineConfig, devices } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Carrega .env.test.local (não commitado) se existir
for (const file of [".env.test.local", ".env.local"]) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const [, key, rawValue] = m;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

/**
 * E2E tests against the public app URL.
 *
 * Required env vars (set locally before `bun run test:e2e`):
 *   E2E_USER_EMAIL    — login of an Admin/workspace owner test account (or E2E_EMAIL)
 *   E2E_USER_PASSWORD — password (or E2E_PASSWORD)
 *   E2E_BASE_URL      — (optional) override; defaults to the public CRM URL
 *
 * Install browsers once:  bunx playwright install chromium
 */
const authenticated = Boolean(
  (process.env.E2E_USER_EMAIL ?? process.env.E2E_EMAIL) ||
  process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON,
);
if (authenticated) resolveE2EEnvironment(process.env);

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:5175",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    ignoreHTTPSErrors: false,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
          ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } }
          : {}),
      },
    },
  ],
});
