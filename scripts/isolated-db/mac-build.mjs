import { readFileSync, openSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
const repo = process.cwd();
const root = resolve(repo, ".techerp-isolated.local");
if (readFileSync(root + "/.isolation-marker", "utf8").trim() !== "techerp-empty-local-v1")
  throw new Error("Isolated marker required");
const status = JSON.parse(readFileSync(root + "/status.private.json", "utf8"));
if (status.API_URL !== "http://127.0.0.1:54321") throw new Error("Local API required");
const app = resolve(root, "validation-check");
mkdirSync(root + "/artifacts", { recursive: true });
const log = openSync(root + "/cycle14-build-reviewed.private.log", "w", 0o600);
const child = spawn(process.execPath, ["scripts/perf/build.mjs"], {
  cwd: app,
  stdio: ["ignore", log, log],
  env: {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    TMPDIR: process.env.TMPDIR,
    NODE_ENV: "production",
    NODE_OPTIONS: "--max-old-space-size=8192",
    SUPABASE_URL: status.API_URL,
    SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
    VITE_SUPABASE_URL: status.API_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
    VITE_SUPABASE_PROJECT_ID: "techerp-isolated.local",
    VITE_APP_URL: "http://127.0.0.1:5174",
  },
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", () => {
  process.exitCode = 1;
});
child.on("close", (code) => {
  console.log(
    code === 0 ? "Isolated production artifact built." : "Isolated build failed; review local log.",
  );
  process.exitCode = code === 0 ? 0 : (code ?? 1);
});
