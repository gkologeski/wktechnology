// Disposable UI for authenticated acceptance. Explicit loopback-only credentials.
import { prepareLockedApp } from "./locked-app.mjs";
import { readFileSync, mkdirSync, symlinkSync, existsSync, openSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
process.umask(0o077);
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const c = JSON.parse(readFileSync(process.env.STAGE7_STATUS_FILE, "utf8"));
if (c.API_URL !== "http://127.0.0.1:54521")
  throw Error("Explicit isolated local endpoint required");
const root = resolve(repo, ".verification/hiring-stage7"),
  app = resolve(repo, "../outputs/hiring-integration-stage7-2026-11-05/isolated-app");
mkdirSync(root, { recursive: true });
prepareLockedApp(repo, app);
if (!existsSync(app + "/node_modules"))
  symlinkSync(repo + "/node_modules", app + "/node_modules", "dir");
const url = "http://127.0.0.1:5197";
const env = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  TMPDIR: process.env.TMPDIR ?? "/tmp",
  NODE_ENV: "development",
  NODE_OPTIONS: "--max-old-space-size=8192",
  SUPABASE_URL: c.API_URL,
  SUPABASE_PUBLISHABLE_KEY: c.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: c.SERVICE_ROLE_KEY,
  SUPABASE_PROJECT_ID: "techerp-stage7-isolated",
  VITE_SUPABASE_URL: c.API_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: c.ANON_KEY,
  VITE_SUPABASE_PROJECT_ID: "techerp-stage7-isolated",
  APP_URL: url,
  VITE_APP_URL: url,
  PUBLIC_APP_URL: url,
  LOVABLE_APP_URL: url,
};
const log = openSync(root + "/app.private.log", "w", 0o600);
const child = spawn(
  process.execPath,
  [app + "/node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5197", "--strictPort"],
  { cwd: app, env, stdio: ["ignore", log, log] },
);
writeFileSync(root + "/app.pid", String(child.pid));
console.log("Isolated UI starting on " + url);
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
