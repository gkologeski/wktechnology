import { afterAll, beforeAll, expect, it } from "vitest";
import postgres from "postgres";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// Real PostgreSQL/RLS with production resolvers, isolated from all configured URLs.
// Claims are a SQL fixture, not a GoTrue login; real-JWT acceptance remains separate.
const docker =
  process.platform === "darwin"
    ? "/Applications/Docker.app/Contents/Resources/bin/docker"
    : "docker";
const image = "postgres@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b";
const container = "techerp-purchase-sales-ci-" + randomUUID();
const W = "aaaaaaaa-0000-4000-8000-00000000000a",
  B = "aaaaaaaa-0000-4000-8000-00000000000b";
const U = "10000000-0000-4000-8000-000000000002",
  O = "10000000-0000-4000-8000-000000000001",
  P = "10000000-0000-4000-8000-000000000003";
const R = "30000000-0000-4000-8000-0000000000a8";
const C = "60000000-0000-4000-8000-000000000001",
  S = "60000000-0000-4000-8000-000000000002",
  V = "60000000-0000-4000-8000-000000000003";
let endpoint = "",
  temporary = "",
  started = false;
let db: ReturnType<typeof postgres>;
const dockerRun = (...args: string[]) =>
  execFileSync(docker, ["--host", endpoint, ...args], {
    encoding: "utf8",
    timeout: 90000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
function sourceFunction(file: string, name: string) {
  const source = readFileSync(file, "utf8"),
    start = source.indexOf(
      "CREATE OR REPLACE FUNCTION " + (name.includes(".") ? name : "public." + name) + "(",
    );
  if (start < 0) throw Error("Missing production function: " + name);
  const tail = source.slice(start),
    opening = /\bAS\s+(\$[a-z_]*\$)/i.exec(tail);
  if (!opening) throw Error("Missing SQL function body: " + name);
  const end = tail.indexOf(opening[1], opening.index + opening[0].length);
  if (end < 0) throw Error("Incomplete SQL function: " + name);
  return tail.slice(0, end + opening[1].length) + ";";
}
beforeAll(async () => {
  if (process.platform === "darwin" && !existsSync(docker))
    throw Error("Docker Desktop is required for mandatory SQL permission tests.");
  endpoint = execFileSync(
    docker,
    ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"],
    { encoding: "utf8", timeout: 10000 },
  ).trim();
  if (!endpoint.startsWith("unix://")) throw Error("Only a local Unix Docker socket is allowed.");
  temporary = mkdtempSync(join(tmpdir(), "techerp-permission-ci-"));
  const password = randomUUID() + randomUUID(),
    envFile = join(temporary, "postgres.env");
  writeFileSync(
    envFile,
    "POSTGRES_DB=techerp_permission_ci\nPOSTGRES_PASSWORD=" + password + "\n",
    { mode: 0o600 },
  );
  dockerRun(
    "run",
    "-d",
    "--rm",
    "--name",
    container,
    "--env-file",
    envFile,
    "-p",
    "127.0.0.1::5432",
    image,
    "-c",
    "fsync=off",
  );
  started = true;
  const mapped = dockerRun("port", container, "5432/tcp");
  if (!/^127\.0\.0\.1:\d+$/.test(mapped)) throw Error("Unexpected disposable DB binding");
  db = postgres({
    host: "127.0.0.1",
    port: Number(mapped.split(":")[1]),
    database: "techerp_permission_ci",
    username: "postgres",
    password,
    max: 1,
    connect_timeout: 1,
    onnotice: () => {},
  });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await db`select 1`;
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  if (!ready) throw Error("Disposable PostgreSQL did not become ready");
  await db.unsafe(readFileSync("tests/fixtures/permission-postgres-ci.sql", "utf8"));
  for (const [file, name] of [
    ["drizzle/migrations/0031_workspace_members_status_inactive.sql", "is_workspace_member"],
    ["drizzle/migrations/0127_rbac_wk_vis_local_per_role.sql", "user_effective_permissions"],
    ["drizzle/migrations/0120_activities_team_scope_active_membership.sql", "my_team_member_pairs"],
    ["drizzle/migrations/0046_view_as_role_only_readonly.sql", "is_read_only_view"],
    ["drizzle/migrations/0216_work_core_prepare.sql", "work_access_context"],
    ["drizzle/migrations/0218_order3_completion_prepare.sql", "work_action_prefix"],
    ["drizzle/migrations/0218_order3_completion_prepare.sql", "work_context_access"],
    ["drizzle/migrations/0210_finance_core_actions.sql", "finance_access_context"],
    ["drizzle/migrations/0222_order4_sales_prepare.sql", "sales_access_context"],
    ["drizzle/migrations/0222_order4_sales_prepare.sql", "sales_context_access"],
  ])
    await db.unsafe(sourceFunction(file, name));
  await db.unsafe(readFileSync("tests/fixtures/contract-proposal.sql", "utf8"));
  await db.unsafe(`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS role text,ADD COLUMN IF NOT EXISTS parent_contract_id uuid;
    CREATE TABLE contract_purchase_sales(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL,purchase_contract_id uuid NOT NULL,sale_contract_id uuid NOT NULL,created_by uuid,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(purchase_contract_id,sale_contract_id));
    GRANT SELECT,INSERT,DELETE ON contract_purchase_sales TO authenticated;`);
  await db.unsafe(sourceFunction("drizzle/migrations/0464_purchase_contract_sales.sql", "contract_purchase_sale_set"));
  await db`insert into workspaces(id) values(${W}),(${B})`;
  await db`insert into profiles(id,active_workspace_id) values(${U},${W})`;
  await db`insert into workspace_members(workspace_id,user_id) values(${W},${U})`;
  await db`insert into job_roles(id,workspace_id) values(${R},${W})`;
  await db`insert into user_job_roles(role_id,user_id,workspace_id,owner_id) values(${R},${U},${W},${U})`;
  await db`insert into contracts(id,workspace_id,owner_id,status,role,parent_contract_id) values(${C},${W},${U},'draft','client',${V}),(${S},${W},${U},'active','provider',null),(${V},${W},${U},'active','provider',null)`;
}, 120000);
afterAll(async () => {
  if (db) await db.end();
  if (started) dockerRun("rm", "-f", "-v", container);
  if (temporary) rmSync(temporary, { recursive: true, force: true });
}, 30000);

async function subject(
  fn: (tx: postgres.TransactionSql) => Promise<void>,
  options: { keys?: boolean; deny?: boolean; inactive?: boolean; workspace?: string } = {},
) {
  const rollback = new Error("rollback");
  try {
    await db.begin(async (tx) => {
      await tx`update profiles set active_workspace_id=${options.workspace ?? W} where id=${U}`;
      if (options.inactive)
        await tx`update workspace_members set status='inactive' where user_id=${U}`;
      for (const key of [
        "techcontracts.contracts.view.workspace",
        "techcontracts.contracts.update.workspace",
      ]) {
        if (options.keys !== false)
          await tx`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${W},${R},${key},${options.deny ? "deny" : "grant"})`;
      }
      await tx`select set_config('request.jwt.claims',${JSON.stringify({ sub: U, role: "authenticated" })},true)`;
      await tx.unsafe("SET LOCAL ROLE authenticated");
      await fn(tx);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}
async function link(tx: postgres.TransactionSql, purchase = C, sale = S) {
  const [r] = await tx`select contract_purchase_sale_set(${purchase}::uuid, ${sale}::uuid, true) as r`;
  return r.r as { linked: boolean; primary: boolean };
}
it("purchase sales SQL allows an authorized active member", async () => {
  await subject(async (tx) => {
    expect(await link(tx)).toEqual({ linked: true, primary: false });
    expect(await link(tx, C, V)).toEqual({ linked: true, primary: true });
  });
});
it("purchase sales SQL rejects missing permission", async () => {
  await expect(subject(async (tx) => void (await link(tx)), { keys: false })).rejects.toThrow();
});
it("purchase sales SQL respects explicit deny", async () => {
  await expect(subject(async (tx) => void (await link(tx)), { deny: true })).rejects.toThrow();
});
it("purchase sales SQL isolates foreign workspace", async () => {
  await expect(subject(async (tx) => void (await link(tx)), { workspace: B })).rejects.toThrow();
});
it("purchase sales SQL rejects inactive membership", async () => {
  await expect(subject(async (tx) => void (await link(tx)), { inactive: true })).rejects.toThrow();
});
it("purchase sales SQL only links a purchase to a sale", async () => {
  await expect(subject(async (tx) => void (await link(tx, S, V)))).rejects.toThrow(/compra/);
});
