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
 * E2E tests against the published preview URL.
 *
 * Required env vars (set locally before `bun run test:e2e`):
 *   E2E_USER_EMAIL    — login of an Admin/workspace owner test account
 *   E2E_USER_PASSWORD — password
 *   E2E_BASE_URL      — (optional) override; defaults to the project preview URL
 *
 * Install browsers once:  bunx playwright install chromium
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL:
      process.env.E2E_BASE_URL ??
      "https://id-preview--68dcfa85-b6da-4030-a825-b896ca621e0c.lovable.app",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
