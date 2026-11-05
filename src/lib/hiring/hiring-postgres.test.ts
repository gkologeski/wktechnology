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
const container = "techerp-hiring-ci-" + randomUUID();
const W = "aaaaaaaa-0000-4000-8000-00000000000a",
  B = "aaaaaaaa-0000-4000-8000-00000000000b";
const U = "10000000-0000-4000-8000-000000000002",
  O = "10000000-0000-4000-8000-000000000001",
  P = "10000000-0000-4000-8000-000000000003";
const R = "30000000-0000-4000-8000-0000000000a8";
const IDs = [
  "50000000-0000-4000-8000-000000000001",
  "50000000-0000-4000-8000-000000000002",
  "50000000-0000-4000-8000-000000000003",
];
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
  await db.unsafe(readFileSync("tests/fixtures/hiring-stage2.sql", "utf8"));
  await db.unsafe(readFileSync("drizzle/migrations/0308_hiring_demands_and_approvals.sql", "utf8"));
}, 120000);
afterAll(async () => {
  if (db) await db.end();
  if (started) dockerRun("rm", "-f", container);
  if (temporary) rmSync(temporary, { recursive: true, force: true });
});
const J = IDs[0];
async function reset() {
  await db.unsafe(
    "TRUNCATE deal_role_profiles,hiring_workspace_settings,service_catalog,deal_line_items,quote_line_items,hiring_email_outbox,hiring_demand_events,hiring_demand_steps,hiring_demand_requests,hiring_policy_versions,hiring_area_policies,notifications,ats_jobs,user_groups,workspace_members,profiles,grants,workspaces CASCADE",
  );
  await db`insert into workspaces values(${W}),(${B})`;
  for (const u of [U, O, P]) {
    await db`insert into profiles values(${u},${W},'Fixture')`;
    await db`insert into workspace_members(workspace_id,user_id) values(${W},${u})`;
    for (const a of ["view", "update", "create", "approve"])
      await db`insert into grants values(${u},${"techhire.hiring_demands." + a + ".workspace"},'grant')`;
    await db`insert into grants values(${u},'techhire.hiring_policies.manage.workspace','grant')`;
  }
  await db`insert into user_groups values(${R},${W},'Area')`;
  await db`insert into ats_jobs(id,workspace_id,title) values(${J},${W},'Fixture')`;
  await db`select set_config('request.uid',${U},false)`;
}
async function access() {
  return (await db`select hiring_stage2_access(${W},'view',${J}) v`)[0].v;
}
it("hiring allows authorized active member", async () => {
  await reset();
  expect(await access()).toBe(true);
});
it("hiring rejects missing permission", async () => {
  await reset();
  await db`delete from grants where user_id=${U}`;
  expect(await access()).toBe(false);
});
it("hiring rejects explicit deny", async () => {
  await reset();
  await db`insert into grants values(${U},'techhire.hiring_demands.view.workspace','deny')`;
  expect(await access()).toBe(false);
});
it("hiring rejects foreign workspace", async () => {
  await reset();
  await db`update profiles set active_workspace_id=${B} where id=${U}`;
  expect(await access()).toBe(false);
});
it("hiring rejects inactive member", async () => {
  await reset();
  await db`update workspace_members set status='inactive' where user_id=${U}`;
  expect(await access()).toBe(false);
});
async function revision() {
  return (await db`select hiring_revision v from ats_jobs where id=${J}`)[0].v;
}
async function request() {
  return (await db`select hiring_demand_request(${W},${J},${await revision()}) v`)[0].v;
}
it("approval is ordered manager then CEO and edit invalidates", async () => {
  await reset();
  await db`select hiring_area_policy_save(${W},${R},${O},${P},null,null)`;
  await db`select hiring_demand_save(${W},${J},${await revision()},'internal',${R},'clt','not_applicable')`;
  const r = await request();
  expect(await request()).toBe(r);
  expect((await db`select count(*)::int n from notifications`)[0].n).toBe(1);
  await db`select set_config('request.uid',${P},false)`;
  await expect(db`select hiring_demand_decide(${W},${r},'approved','')`).rejects.toThrow();
  await db`select set_config('request.uid',${O},false)`;
  await db`select hiring_demand_decide(${W},${r},'approved','')`;
  expect((await db`select count(*)::int n from notifications`)[0].n).toBe(2);
  await db`select set_config('request.uid',${P},false)`;
  await db`select hiring_demand_decide(${W},${r},'approved','')`;
  expect((await db`select hiring_approval_status s from ats_jobs`)[0].s).toBe("approved");
  await db`update ats_jobs set status='published' where id=${J}`;
  await db`update ats_jobs set title='Edited' where id=${J}`;
  expect((await db`select status s,hiring_approval_status a from ats_jobs`)[0]).toMatchObject({
    s: "on_hold",
    a: "not_requested",
  });
});
it("self approval requires delegate and absent policy blocks", async () => {
  await reset();
  await db`select hiring_demand_save(${W},${J},${await revision()},'internal',${R},'pj','not_applicable')`;
  await expect(request()).rejects.toThrow("Configure");
  await db`select hiring_area_policy_save(${W},${R},${U},${P},null,null)`;
  await expect(request()).rejects.toThrow("substituto");
});
it("direct approval and publication shortcuts are blocked", async () => {
  await reset();
  await expect(
    db`update ats_jobs set hiring_approval_status='approved' where id=${J}`,
  ).rejects.toThrow();
  await db`select hiring_area_policy_save(${W},${R},${O},${P},null,null)`;
  await expect(
    db`insert into ats_jobs(id,workspace_id,title,status) values(${IDs[1]},${W},'Unauthorized','published')`,
  ).rejects.toThrow("aprovação");
});
it("policy changes invalidate approved and pending revisions", async () => {
  await reset();
  await db`select hiring_area_policy_save(${W},${R},${O},${P},null,null)`;
  await db`select hiring_demand_save(${W},${J},${await revision()},'internal',${R},'clt','not_applicable')`;
  const r = await request();
  await db`select hiring_area_policy_save(${W},${R},${O},${P},null,null)`;
  expect((await db`select status from hiring_demand_requests where id=${r}`)[0].status).toBe(
    "superseded",
  );
  expect((await db`select count(*)::int n from hiring_policy_versions`)[0].n).toBe(2);
});

it("RLS conceals requests from unauthorized readers and forbids direct mutation", async () => {
  await reset();
  await db`select hiring_area_policy_save(${W},${R},${O},${P},null,null)`;
  await db`select hiring_demand_save(${W},${J},${await revision()},'internal',${R},'clt','not_applicable')`;
  await request();
  await expect(
    db.begin(async (tx) => {
      await tx.unsafe("SET LOCAL ROLE authenticated");
      expect((await tx`select count(*)::int n from hiring_demand_requests`)[0].n).toBe(1);
      await tx`update hiring_demand_requests set status='approved'`;
    }),
  ).rejects.toThrow("permission denied");
  await db`insert into grants values(${U},'techhire.hiring_demands.view.workspace','deny')`;
  await db.begin(async (tx) => {
    await tx.unsafe("SET LOCAL ROLE authenticated");
    expect((await tx`select count(*)::int n from hiring_demand_requests`)[0].n).toBe(0);
  });
});
it("email outbox claims once, honors revocation and does not expose a public claim", async () => {
  await reset();
  await db`select hiring_area_policy_save(${W},${R},${O},${P},null,null)`;
  await db`select hiring_demand_save(${W},${J},${await revision()},'internal',${R},'clt','not_applicable')`;
  await request();
  expect((await db`select count(*)::int n from hiring_email_outbox`)[0].n).toBe(1);
  await db`insert into grants values(${O},'techhire.hiring_demands.approve.workspace','deny')`;
  expect(await db`select * from hiring_email_claim()`).toHaveLength(0);
  await db`delete from grants where effect='deny'`;
  expect(await db`select * from hiring_email_claim()`).toHaveLength(1);
  expect(await db`select * from hiring_email_claim()`).toHaveLength(0);
  expect(
    (await db`select has_function_privilege('authenticated','hiring_email_claim()','execute') v`)[0]
      .v,
  ).toBe(false);
});
it("inactive services reject only new associations and canonical classification requires permission", async () => {
  await reset();
  await db`insert into service_catalog(id,workspace_id,active) values(${IDs[1]},${W},false)`;
  await expect(
    db`insert into deal_line_items(id,workspace_id,service_catalog_id) values(${IDs[2]},${W},${IDs[1]})`,
  ).rejects.toThrow("inativo");
  await expect(
    db`update service_catalog set staffing_kind='squad' where id=${IDs[1]}`,
  ).rejects.toThrow("permissão");
  await db`insert into grants values(${U},'techsales.catalog.services.update.workspace','grant')`;
  await db`update service_catalog set staffing_kind='squad',active=true where id=${IDs[1]}`;
  await db`insert into deal_line_items(id,workspace_id,service_catalog_id) values(${IDs[2]},${W},${IDs[1]})`;
  await db`update service_catalog set active=false where id=${IDs[1]}`;
  await db`update deal_line_items set service_catalog_id=service_catalog_id where id=${IDs[2]}`;
});
