// Browser acceptance on a dedicated loopback app and real local GoTrue sessions.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
const out = resolve(".verification/hiring-stage7");
const c = JSON.parse(readFileSync(process.env.STAGE7_STATUS_FILE, "utf8"));
const creds = JSON.parse(readFileSync(out + "/credentials.private.json", "utf8"));
const state = JSON.parse(readFileSync(out + "/state.private.json", "utf8"));
if (c.API_URL !== "http://127.0.0.1:54521" || creds.apiURL !== c.API_URL)
  throw Error("Local isolated endpoint required");
const base = "http://127.0.0.1:5197",
  shots = out + "/screenshots";
mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.STAGE7_CHROMIUM ??
    "/Users/gkologeski/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell",
});
const results = [];
try {
  const account = creds.accounts.operator;
  const client = createClient(c.API_URL, c.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const login = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (login.error) throw Error("Local login failed");
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  await context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    return ["127.0.0.1", "localhost"].includes(u.hostname) ? route.continue() : route.abort();
  });
  await context.addInitScript(
    ({ session }) => {
      localStorage.setItem("sb-127-auth-token", JSON.stringify(session));
    },
    { session: login.data.session },
  );
  const page = await context.newPage();
  for (const [label, path] of [
    ["person", "/people/" + state.person + "?tab=allocations"],
    ["job", "/jobs/" + state.ids.job],
    ["contracts", "/contracts"],
    ["project", "/projects/" + state.project],
    ["finance", "/finance"],
    ["reconciliation", "/projects/settings/imports/reconciliation?tab=review"],
  ]) {
    const errors = [];
    const listener = (e) => errors.push(String(e.message).slice(0, 250));
    page.on("pageerror", listener);
    try {
      const response = await page.goto(base + path, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.waitForFunction(
        () => {
          const t = document.body.innerText.trim();
          return t.length > 100 && t !== "Carregando...";
        },
        { timeout: 45000 },
      );
      await page.waitForTimeout(1500);
      const text = await page.locator("body").innerText();
      if (label === "person") {
        await page.getByRole("tab", { name: "Alocações", exact: true }).click();
        await page.getByRole("button", { name: "Renovação, substituição e encerramento" }).click();
        await page.getByRole("heading", { name: "Ciclo de vida do vínculo" }).waitFor();
        await page.waitForTimeout(1500);
        const alerts = await page.getByRole("dialog").getByRole("alert").allTextContents();
        if (alerts.length) throw Error("Lifecycle dialog: " + alerts.join(" "));
      }
      const result = {
        label,
        path,
        status: response?.status(),
        url: page.url(),
        title: await page.title(),
        text: text.slice(0, 700),
        errors,
        passed: response?.ok() && !/\/login/.test(page.url()) && !errors.length,
      };
      results.push(result);
      await page.screenshot({ path: shots + "/" + label + ".png" });
      console.log(label + ": " + (result.passed ? "loaded" : "failed"));
    } catch (e) {
      results.push({ label, path, passed: false, error: e.message });
    } finally {
      page.off("pageerror", listener);
    }
  }
} finally {
  await browser.close();
  writeFileSync(
    out + "/ui-results.json",
    JSON.stringify(
      { results, complete: results.length === 6 && results.every((r) => r.passed) },
      null,
      2,
    ),
  );
}
if (results.length !== 6 || results.some((r) => !r.passed)) process.exitCode = 3;
