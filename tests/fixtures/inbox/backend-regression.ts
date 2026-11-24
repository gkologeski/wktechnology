import { createHmac, randomUUID } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  db,
  W,
  B,
  reset,
  fixtureHttpBase,
  ownedAuthServiceConfiguration,
} from "../notification-deliveries";
import { setupInboxExecutionCopy } from "./runtime";

// Public authorization data stays in the owned PostgreSQL/PostgREST fixture.
// GoTrue owns a separate empty auth database and issues real login JWTs with
// the same ephemeral signing secret. No configured credential or URL is read.
const image =
  "supabase/gotrue@sha256:1f378d415f670d59c7c2e52e244da6f0d486321998c6a6485e109efaeaba51ac";
const docker =
  process.platform === "darwin"
    ? "/Applications/Docker.app/Contents/Resources/bin/docker"
    : "docker";
const name = "techerp-inbox-auth-ci-" + randomUUID();
let endpoint = "",
  directory = "",
  authBase = "",
  started = false;
export const workspace = W;
const user = (n: number) => `fb110000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const role = (n: number) => `fd110000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const run = (...args: string[]) =>
  execFileSync(docker, ["--host", endpoint, ...args], {
    encoding: "utf8",
    timeout: 90000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
export function apiBase() {
  return fixtureHttpBase();
}
export const fetchLocal: typeof fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  const base = apiBase();
  if (url.origin !== base) throw new Error("Refused non-owned backend origin");
  if (url.pathname.startsWith("/rest/v1/"))
    return fetch(base + url.pathname.slice("/rest/v1".length) + url.search, init);
  if (url.pathname.startsWith("/auth/v1/") && authBase)
    return fetch(authBase + url.pathname.slice("/auth/v1".length) + url.search, init);
  throw new Error("Refused unsupported owned backend route");
};
export async function scalar(query: string) {
  fixtureHttpBase();
  const rows = await db.unsafe(query);
  const value = Object.values(rows[0] ?? {})[0];
  return typeof value === "boolean" ? (value ? "t" : "f") : String(value);
}
/** Conversation creation is fixture preparation, not a tested user write. */
export async function seedChatSession(id: string, assignee: string) {
  fixtureHttpBase();
  await db`insert into live_chat_sessions(id,workspace_id,owner_id,visitor_id,assignee_id,status)
    values(${id},${W},${W},${id},${assignee},'open')`;
}
async function seedSubjects() {
  await db.unsafe("ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS slug text");
  await db`update workspaces set slug=case when id=${W} then 'gmail-queue-isolated-a' else 'gmail-queue-isolated-b' end`;
  for (const n of [11, 12, 13, 14, 15, 16, 17]) {
    const tenant = n === 14 ? B : W;
    await db`insert into profiles(id,active_workspace_id) values(${user(n)},${tenant})`;
    await db`insert into auth.users(id,email,email_confirmed_at) values(${user(n)},${"backend-regression-" + n + "@example.invalid"},now())`;
    await db`insert into workspace_members(workspace_id,user_id,status) values(${tenant},${user(n)},${n === 15 ? "inactive" : "active"})`;
  }
  for (const n of [11, 13, 16, 17])
    await db`insert into job_roles(id,workspace_id) values(${role(n)},${W})`;
  for (const n of [11, 13, 15])
    await db`insert into user_job_roles(role_id,user_id,workspace_id,owner_id) values(${role(11)},${user(n)},${W},${user(11)})`;
  for (const n of [13, 16, 17])
    await db`insert into user_job_roles(role_id,user_id,workspace_id,owner_id) values(${role(n)},${user(n)},${W},${user(11)})`;
  const grant = async (n: number, key: string, effect = "grant") => {
    await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect)
      values(${W},${role(n)},${key},${effect})`;
  };
  for (const key of [
    "techsales.inbox.chat.view.workspace",
    "techsales.inbox.chat.create.workspace",
    "techsales.inbox.email.view.workspace",
    "techsales.inbox.email.create.workspace",
    "techsales.email_accounts.view.own",
  ])
    await grant(11, key);
  for (const key of [
    "techsales.inbox.chat.create.workspace",
    "techsales.inbox.email.view.workspace",
    "techsales.inbox.email.create.workspace",
  ])
    await grant(13, key, "deny");
  for (const n of [16, 17]) await grant(n, "techsales.inbox.chat.view.workspace");
  await grant(16, "techsales.inbox.chat.create.own");
  await grant(17, "techsales.inbox.chat.create.team");
}
function serviceToken(secret: string) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const payload =
    encode({ alg: "HS256", typ: "JWT" }) +
    "." +
    encode({
      role: "service_role",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
  return payload + "." + createHmac("sha256", secret).update(payload).digest("base64url");
}
export async function setup() {
  fixtureHttpBase();
  await setupInboxExecutionCopy(db, { keepAvailabilityLock: true });
  await reset();
  await seedSubjects();
  const config = ownedAuthServiceConfiguration();
  await db.unsafe("CREATE DATABASE techerp_inbox_auth_ci");
  endpoint = execFileSync(
    docker,
    ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"],
    { encoding: "utf8", timeout: 10000 },
  ).trim();
  if (!endpoint.startsWith("unix://"))
    throw new Error("Only an owned local Docker socket is allowed");
  run(
    "exec",
    config.databaseContainer,
    "psql",
    "-U",
    "postgres",
    "-d",
    "techerp_inbox_auth_ci",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "CREATE SCHEMA auth; ALTER DATABASE techerp_inbox_auth_ci SET search_path=auth,public",
  );
  directory = mkdtempSync(join(tmpdir(), "techerp-inbox-auth-ci-"));
  const env = join(directory, "auth.env");
  writeFileSync(
    env,
    [
      "GOTRUE_DB_DRIVER=postgres",
      "GOTRUE_DB_DATABASE_URL=postgres://postgres:" +
        config.password +
        "@notification-db:5432/techerp_inbox_auth_ci",
      "DB_NAMESPACE=auth",
      "GOTRUE_API_HOST=0.0.0.0",
      "PORT=9999",
      "GOTRUE_API_PORT=9999",
      "API_EXTERNAL_URL=http://127.0.0.1:9999",
      "GOTRUE_SITE_URL=http://localhost:8080",
      "GOTRUE_JWT_SECRET=" + config.jwtSecret,
      "GOTRUE_JWT_AUD=authenticated",
      "GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated",
      "GOTRUE_JWT_ADMIN_ROLES=service_role",
      "GOTRUE_JWT_EXP=3600",
      "GOTRUE_DISABLE_SIGNUP=true",
      "GOTRUE_EXTERNAL_EMAIL_ENABLED=true",
      "GOTRUE_EXTERNAL_PHONE_ENABLED=false",
      "GOTRUE_MAILER_AUTOCONFIRM=true",
      "GOTRUE_LOG_LEVEL=error",
    ].join("\n") + "\n",
    { mode: 0o600 },
  );
  run(
    "run",
    "-d",
    "--name",
    name,
    "--network",
    config.network,
    "--env-file",
    env,
    "-p",
    "127.0.0.1::9999",
    image,
  );
  started = true;
  const mapped = run("port", name, "9999/tcp");
  if (!/^127\.0\.0\.1:\d+$/.test(mapped)) throw new Error("Unexpected disposable GoTrue binding");
  authBase = "http://" + mapped;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(authBase + "/health")).ok) return serviceToken(config.jwtSecret);
    } catch {
      /* wait for migrations */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const captured = spawnSync(docker, ["--host", endpoint, "logs", name], {
    encoding: "utf8",
    timeout: 10000,
  });
  const detail = (captured.stdout + captured.stderr)
    .replaceAll(config.password, "<ephemeral-db-password>")
    .replaceAll(config.jwtSecret, "<ephemeral-jwt-key>")
    .slice(-3000);
  throw new Error("Disposable GoTrue did not become ready: " + detail);
}
export async function stop() {
  try {
    if (started) run("rm", "-f", "-v", name);
  } finally {
    if (directory) rmSync(directory, { recursive: true, force: true });
  }
}
