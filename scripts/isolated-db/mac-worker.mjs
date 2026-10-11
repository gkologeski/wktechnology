// Run the exact emitted Cloudflare artifact through the real local workerd runtime.
import { readFileSync, realpathSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const root = resolve(process.cwd(), ".techerp-isolated.local");
if (readFileSync(root + "/.isolation-marker", "utf8").trim() !== "techerp-empty-local-v1")
  throw new Error("Local marker required");
const app = realpathSync(resolve(root, process.argv[2] || "validation-check"));
if (!app.startsWith(root + "/")) throw new Error("Local artifact required");
const build = JSON.parse(readFileSync(app + "/.verification/build.json", "utf8"));
if (!build.complete || !build.finalized) throw new Error("Finalized build required");
const cfg = JSON.parse(readFileSync(app + "/.output/server/wrangler.json", "utf8"));
if (!cfg.compatibility_flags.includes("nodejs_compat") || cfg.no_bundle !== true)
  throw new Error("Cloudflare artifact required");
const status = JSON.parse(readFileSync(root + "/status.private.json", "utf8"));
if (status.API_URL !== "http://127.0.0.1:54321") throw new Error("Local API only");
const { Miniflare, Log, LogLevel } = await import(
  pathToFileURL(app + "/node_modules/miniflare/dist/src/index.js").href
);
const worker = new Miniflare({
  host: "127.0.0.1",
  port: 5174,
  log: new Log(LogLevel.NONE),
  modules: [
    "index.mjs",
    ...readdirSync(app + "/.output/server", { recursive: true }).filter(
      (name) => name !== "index.mjs" && /\.(?:mjs|js)$/.test(name),
    ),
  ].map((name) => ({ type: "ESModule", path: app + "/.output/server/" + name })),
  modulesRoot: app + "/.output/server",
  modulesRules: [{ type: "ESModule", include: ["**/*.mjs", "**/*.js"], fallthrough: true }],
  compatibilityDate: cfg.compatibility_date,
  compatibilityFlags: cfg.compatibility_flags,
  assets: {
    directory: app + "/.output/public",
    binding: "ASSETS",
    routerConfig: { has_user_worker: true, invoke_user_worker_ahead_of_assets: true },
  },
  bindings: {
    SUPABASE_URL: status.API_URL,
    SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    APP_URL: "http://127.0.0.1:5174",
  },
});
let closing = false;
const close = async () => {
  if (closing) return;
  closing = true;
  await worker.dispose();
  process.exit(0);
};
process.on("SIGINT", close);
process.on("SIGTERM", close);
process.stdin.on("data", (data) => {
  if (data.toString().trim() === "stop") void close();
});
await worker.ready;
console.log("Cloudflare worker ready locally at http://127.0.0.1:5174; enter stop to finish.");
