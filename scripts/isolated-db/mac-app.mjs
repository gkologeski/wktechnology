import { prepareLockedApp } from "./locked-app.mjs";
// Starts a disposable application copy using only credentials from the local CLI.
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  existsSync,
  lstatSync,
  openSync,
  readdirSync,
} from "node:fs";
import { dirname, resolve, relative, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawn } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const root = resolve(repo, ".techerp-isolated.local");
const app = resolve(root, "app");
process.umask(0o077);
if (
  lstatSync(root).isSymbolicLink() ||
  readFileSync(resolve(root, ".isolation-marker"), "utf8").trim() !== "techerp-empty-local-v1"
)
  throw new Error("Marcador local inválido");
if (existsSync(resolve(root, "supabase/.temp/project-ref")))
  throw new Error("Vínculo remoto recusado");
const status = JSON.parse(readFileSync(resolve(root, "status.private.json"), "utf8"));
if (
  !["http://127.0.0.1:54321", "http://localhost:54321"].includes(status.API_URL) ||
  !status.SERVICE_ROLE_KEY ||
  !status.ANON_KEY
)
  throw new Error("Configuração local incompleta");
if (existsSync(app) && lstatSync(app).isSymbolicLink())
  throw new Error("Diretório de app inválido");
mkdirSync(app, { recursive: true });
if (
  readdirSync(app).some(
    (name) => name.startsWith(".env") || name === ".dev.vars" || name === ".npmrc",
  )
)
  throw new Error("Configuração externa encontrada na cópia local");
// Do not inherit integration credentials or load the repository's production env files.
const env = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  TMPDIR: process.env.TMPDIR ?? "/tmp",
  NODE_ENV: "development",
  SUPABASE_URL: status.API_URL,
  SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  SUPABASE_PROJECT_ID: "techerp-isolated.local",
  VITE_SUPABASE_URL: status.API_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
  VITE_SUPABASE_PROJECT_ID: "techerp-isolated.local",
  VITE_APP_URL: "http://127.0.0.1:5173",
  APP_URL: "http://127.0.0.1:5173",
  PUBLIC_APP_URL: "http://127.0.0.1:5173",
  LOVABLE_APP_URL: "http://127.0.0.1:5173",
  NODE_OPTIONS: "--max-old-space-size=8192",
};
const packageHash = prepareLockedApp(repo, app);
const installMarker = resolve(root, "app-dependencies.sha256");
if (
  !existsSync(resolve(app, "node_modules/vite")) ||
  !existsSync(installMarker) ||
  readFileSync(installMarker, "utf8") !== packageHash
) {
  console.log(
    "Instalando as dependências da cópia local. A primeira execução pode demorar alguns minutos...",
  );
  const log = openSync(resolve(root, "app-install.private.log"), "w", 0o600);
  // Use exactly the versions and integrity hashes of the project lockfile.
  execFileSync(
    resolve(process.env.HOME, ".bun/bin/bun"),
    ["install", "--frozen-lockfile", "--ignore-scripts"],
    { cwd: app, env, stdio: ["ignore", log, log], timeout: 900000 },
  );
  writeFileSync(installMarker, packageHash);
}
const { createClient } = await import(
  resolve(root, "node_modules/@supabase/supabase-js/dist/index.mjs")
);
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const ws = await admin
  .from("workspaces")
  .select("id,slug")
  .in("id", ["aaaaaaaa-0000-4000-8000-00000000000a", "aaaaaaaa-0000-4000-8000-00000000000b"]);
if (ws.error || ws.data?.length !== 2 || ws.data.some((w) => !w.slug.startsWith("iso-tenant-")))
  throw new Error("Fixtures locais não confirmadas");
const password = randomBytes(24).toString("base64url");
const accounts = [];
for (const [n, email] of [
  [1, "admin-a@techerp-test.invalid"],
  [2, "own-a@techerp-test.invalid"],
]) {
  const id = "10000000-0000-4000-8000-00000000000" + n;
  const existing = await admin.auth.admin.getUserById(id);
  if (existing.error || existing.data.user.email !== email)
    throw new Error("Conta fictícia não confirmada");
  const changed = await admin.auth.admin.updateUserById(id, { password });
  if (changed.error) throw new Error("Não foi possível preparar a conta local");
  accounts.push({ id, email, password });
}
writeFileSync(resolve(root, "app-accounts.private.json"), JSON.stringify(accounts, null, 2), {
  mode: 0o600,
});
const log = openSync(resolve(root, "app-server.private.log"), "w", 0o600);
const child = spawn(
  process.execPath,
  [
    resolve(app, "node_modules/vite/bin/vite.js"),
    "--host",
    "127.0.0.1",
    "--port",
    "5173",
    "--strictPort",
    "--mode",
    "isolated",
  ],
  { cwd: app, env, stdio: ["ignore", log, log] },
);
let stopped = false;
child.on("exit", (code) => {
  stopped = true;
  process.exitCode = code ?? 1;
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
console.log("Iniciando a aplicação local. Os registros ficarão em app-server.private.log.");
let ready = false;
for (let i = 0; i < 40 && !stopped; i++) {
  try {
    const response = await fetch("http://127.0.0.1:5173", { signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      ready = true;
      break;
    }
  } catch {}
  await new Promise((r) => setTimeout(r, 1500));
}
writeFileSync(
  resolve(root, "artifacts/app-start.json"),
  JSON.stringify({ ready, url: "http://127.0.0.1:5173", ui_tests_executed: false }, null, 2),
);
if (ready)
  console.log(
    "Aplicação respondeu em http://127.0.0.1:5173. Deixe este Terminal aberto e avise no chat.",
  );
else {
  console.error("A aplicação ainda não respondeu. Avise no chat para análise do registro local.");
  child.kill("SIGTERM");
  process.exitCode = 1;
}
