import { defineConfig, devices } from "@playwright/test";

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
