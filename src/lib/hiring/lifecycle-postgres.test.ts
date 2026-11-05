import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import postgres from "postgres";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, chownSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Never use project PG*/database URLs: new local cluster, synthetic rows, real PostgreSQL/RLS.
let db: ReturnType<typeof postgres>;
let dir = "",
  pg = "",
  local = false;
const W = "aaaaaaaa-0000-4000-8000-00000000000a",
  B = "aaaaaaaa-0000-4000-8000-00000000000b";
const U = "10000000-0000-4000-8000-000000000001",
  M = "10000000-0000-4000-8000-000000000002",
  C = "10000000-0000-4000-8000-000000000003";
const E = "80000000-0000-4000-8000-000000000001",
  A = "80000000-0000-4000-8000-000000000002",
  P = "60000000-0000-4000-8000-000000000001",
  J = "50000000-0000-4000-8000-000000000001",
  L = "40000000-0000-4000-8000-000000000001",
  R = "30000000-0000-4000-8000-000000000001",
  V = "70000000-0000-4000-8000-000000000002",
  K = "90000000-0000-4000-8000-000000000001";
const keys = [
  "fixture.hr",
  "fixture.work",
  "techpeople.employment.manage.workspace",
  "techpeople.lifecycle.view.workspace",
  "techpeople.lifecycle.renew.workspace",
  "techpeople.lifecycle.replace.workspace",
  "techpeople.lifecycle.end_allocation.workspace",
  "techpeople.lifecycle.end_employment.workspace",
  "techpeople.lifecycle.approve.workspace",
  "techpeople.lifecycle.execute.workspace",
];
function functionSource(file: string, name: string) {
  const text = readFileSync(file, "utf8"),
    start = text.indexOf("CREATE OR REPLACE FUNCTION public." + name + "(");
  if (start < 0) throw Error("Missing production SQL function " + name);
  const tail = text.slice(start),
    match = /\bAS\s+(\$[a-z_]*\$)/i.exec(tail);
  if (!match) throw Error("Missing SQL body");
  return (
    tail.slice(0, tail.indexOf(match[1], match.index + match[0].length) + match[1].length) + ";"
  );
}
function run(bin: string, args: string[]) {
  const options = {
    encoding: "utf8" as const,
    timeout: 30000,
    stdio: ["ignore", "pipe", "pipe"] as ["ignore", "pipe", "pipe"],
  };
  if (process.getuid?.() === 0)
    return execFileSync("runuser", ["-u", "nobody", "--", join(pg, bin), ...args], options);
  return execFileSync(join(pg, bin), args, options);
}
beforeAll(async () => {
  const candidates = existsSync("/nix/store")
    ? readdirSync("/nix/store")
        .filter((x) => x.includes("postgresql-"))
        .map((x) => join("/nix/store", x, "bin"))
    : [];
  pg = candidates.find((x) => existsSync(join(x, "initdb"))) ?? "";
  if (!pg) {
    try {
      pg = execFileSync("pg_config", ["--bindir"], { encoding: "utf8" }).trim();
    } catch {
      throw Error(
        "Local PostgreSQL binaries required for isolated lifecycle tests; no production fallback.",
      );
    }
  }
  dir = mkdtempSync(join(tmpdir(), "hiring-stage6-"));
  if (process.getuid?.() === 0) chownSync(dir, 65534, 65534);
  run("initdb", ["-D", join(dir, "data"), "-A", "trust", "--no-locale"]);
  run("pg_ctl", [
    "-D",
    join(dir, "data"),
    "-l",
    join(dir, "server.log"),
    "-o",
    "-h '' -k " + dir + " -p 55437",
    "start",
  ]);
  local = true;
  db = postgres({
    host: dir,
    port: 55437,
    database: "postgres",
    username: process.getuid?.() === 0 ? "nobody" : process.env.USER,
    ssl: false,
    max: 1,
    onnotice: () => {},
  });
  for (const file of ["hiring-stage2.sql", "hiring-stage3.sql", "hiring-stage4.sql"])
    await db.unsafe(readFileSync("tests/fixtures/" + file, "utf8"));
  await db.unsafe(readFileSync("drizzle/migrations/0308_hiring_demands_and_approvals.sql", "utf8"));
  await db.unsafe(
    functionSource(
      "drizzle/migrations/0172_techprojects_cycle2_deal_delivery.sql",
      "deal_stage_type",
    ),
  );
  for (const name of ["contract_esign_manage", "contract_esign_public"])
    await db.unsafe(functionSource("drizzle/migrations/0218_order3_completion_prepare.sql", name));
  for (const file of [
    "0309_hiring_signature_evidence.sql",
    "0310_hiring_recruitment_authorization.sql",
    "0311_hiring_employment_and_access_models.sql",
    "0312_hiring_allocation_access_and_invites.sql",
    "0313_hiring_contract_owner_boundary.sql",
    "0314_hiring_invite_reissue_boundary.sql",
    "0315_hiring_role_restrictions.sql",
  ])
    await db.unsafe(readFileSync("drizzle/migrations/" + file, "utf8"));
  await db.unsafe(readFileSync("tests/fixtures/hiring-stage6.sql", "utf8"));
  await db.unsafe(readFileSync(process.env.HIRING_STAGE6_CANDIDATE ?? "drizzle/migrations/0321_hiring_lifecycle_governance.sql", "utf8"));
}, 60000);
afterAll(async () => {
  if (db) await db.end();
  if (local) run("pg_ctl", ["-D", join(dir, "data"), "-m", "immediate", "stop"]);
  if (dir) rmSync(dir, { recursive: true, force: true });
});
async function actor(u = U) {
  await db`select set_config('request.uid',${u},false)`;
}
beforeEach(async () => {
  await db`reset role`;
  await actor("");
  const tables =
    await db`select tablename from pg_tables where schemaname='public' and tablename<>'permissions'`;
  await db.unsafe(
    "TRUNCATE " +
      tables.map((t) => 'public."' + t.tablename + '"').join(",") +
      ",storage.objects CASCADE",
  );
  await db`insert into workspaces(id) values(${W}),(${B})`;
  for (const u of [U, M, C]) {
    await db`insert into profiles values(${u},${W},'Fixture')`;
    await db`insert into workspace_members(workspace_id,user_id,role) values(${W},${u},'member')`;
    for (const k of keys) await db`insert into grants values(${u},${k},'grant')`;
  }
  await db`insert into user_groups values(${R},${W},'Área fixture')`;
  await db`insert into hiring_area_policies(workspace_id,area_id,manager_id,ceo_id,updated_by) values(${W},${R},${M},${C},${U})`;
  await db`insert into legal_entities values(${L},${W},'Entidade fixture','00000000000001',true)`;
  await db`insert into hiring_workspace_settings(workspace_id,enabled,updated_by,employment_gate_enabled) values(${W},true,${U},false)`;
  await db`insert into ats_jobs(id,workspace_id,title,employment_type,hiring_area_id,hiring_purpose,hiring_billing_model) values(${J},${W},'Interna','pj',${R},'internal','not_applicable')`;
  await db`select set_config('app.hiring_stage2','on',false)`;
  await db`update ats_jobs set hiring_approval_status='approved' where id=${J}`;
  await db`select set_config('app.hiring_stage2','off',false)`;
  await db`insert into people(id,workspace_id,full_name,employment_type,hire_date) values(${P},${W},'Pessoa fixture','pj',current_date-10)`;
  await db`insert into hiring_access_models(id,workspace_id,name,updated_by) values('70000000-0000-4000-8000-000000000001',${W},'Modelo fixture',${U})`;
  await db`insert into hiring_access_model_versions(id,model_id,workspace_id,revision,name,allocation_only,permission_keys,created_by) values(${V},'70000000-0000-4000-8000-000000000001',${W},1,'Modelo fixture',true,'{}',${U})`;
  await db`insert into hiring_engagements(id,workspace_id,person_id,job_id,purpose,employment_type,legal_entity_id,model_version_id,starts_at,ends_at,created_by) values(${E},${W},${P},${J},'internal','pj',${L},${V},current_date-10,current_date+30,${U})`;
  await db`update hiring_workspace_settings set lifecycle_gate_enabled=true where workspace_id=${W}`;
  await actor();
});
async function preview(kind = "end_employment", allocation: string | null = null) {
  return (
    await db`select hiring_lifecycle_preview(${W},${E},${allocation},${kind},current_date+5,null,null,null,false,'Corte conferido em teste isolado') v`
  )[0].v;
}
async function request() {
  const p = await preview();
  return (
    await db`select hiring_lifecycle_request(${W},${E},null,'end_employment',current_date+5,null,null,null,false,'Corte conferido em teste isolado',${p.hash}) v`
  )[0].v as string;
}
async function approve(r: string) {
  await actor(M);
  await db`select hiring_lifecycle_decide(${W},${r},1,'approved','Gestor conferiu')`;
  await actor(C);
  await db`select hiring_lifecycle_decide(${W},${r},2,'approved','CEO conferiu')`;
  await actor();
}
it("lifecycle allows authorized active member", async () => {
  expect((await preview()).revision).toBe(1);
});
it("lifecycle rejects missing permission", async () => {
  await db`delete from grants where user_id=${U} and key='techpeople.lifecycle.end_employment.workspace'`;
  await expect(preview()).rejects.toThrow("permissão");
});
it("lifecycle rejects explicit deny", async () => {
  await db`insert into grants values(${U},'techpeople.lifecycle.end_employment.workspace','deny')`;
  await expect(preview()).rejects.toThrow("permissão");
});
it("lifecycle rejects foreign workspace", async () => {
  await db`update profiles set active_workspace_id=${B} where id=${U}`;
  await expect(preview()).rejects.toThrow("permissão");
});
it("lifecycle rejects inactive member", async () => {
  await db`update workspace_members set status='inactive' where user_id=${U}`;
  await expect(preview()).rejects.toThrow("permissão");
});
it("lifecycle gate defaults false and never seeds requests", async () => {
  await db`insert into hiring_workspace_settings(workspace_id,updated_by) values(${B},${U})`;
  expect(
    (
      await db`select lifecycle_gate_enabled v from hiring_workspace_settings where workspace_id=${B}`
    )[0].v,
  ).toBe(false);
  expect((await db`select count(*)::int n from hiring_lifecycle_requests`)[0].n).toBe(0);
});
it("lifecycle requires configured area and never invents a Technical approver", async () => {
  await db`delete from hiring_area_policies`;
  await expect(preview()).rejects.toThrow("sem aprovador");
});
it("lifecycle prohibits self approval and enforces manager before CEO", async () => {
  const r = await request();
  await expect(
    db`select hiring_lifecycle_decide(${W},${r},1,'approved','Conferido')`,
  ).rejects.toThrow("Solicitante");
  await actor(C);
  await expect(
    db`select hiring_lifecycle_decide(${W},${r},1,'approved','Conferido')`,
  ).rejects.toThrow("Aguarde");
});
it("lifecycle decisions are idempotent and execute requires complete approval", async () => {
  const r = await request();
  await expect(db`select hiring_lifecycle_execute(${W},${r},1)`).rejects.toThrow("Aprovação");
  await actor(M);
  await db`select hiring_lifecycle_decide(${W},${r},1,'approved','Gestor conferiu')`;
  await db`select hiring_lifecycle_decide(${W},${r},1,'approved','Gestor conferiu')`;
  expect((await db`select revision from hiring_lifecycle_requests where id=${r}`)[0].revision).toBe(
    2,
  );
});
it("lifecycle revalidates policy and source CAS before every decision", async () => {
  const r = await request();
  await db`update hiring_area_policies set revision=revision+1`;
  await actor(M);
  await expect(
    db`select hiring_lifecycle_decide(${W},${r},1,'approved','Conferido')`,
  ).rejects.toThrow("alterados");
});
it("lifecycle rejects legacy end with active gate even without allocations", async () => {
  await expect(
    db`select hiring_employment_end(${W},${E},'Encerramento legado isolado')`,
  ).rejects.toThrow("legado bloqueado");
  expect((await db`select status from hiring_engagements where id=${E}`)[0].status).toBe("active");
});
it("lifecycle future end is inclusive and preserves membership and manual packages", async () => {
  const r = await request();
  await approve(r);
  const a = (await db`select hiring_lifecycle_execute(${W},${r},3) v`)[0].v;
  const b = (await db`select hiring_lifecycle_execute(${W},${r},3) v`)[0].v;
  expect(a).toEqual(b);
  expect(a.financial_cancelled).toBe(false);
  expect(
    (await db`select ends_at=current_date+5 v from hiring_engagements where id=${E}`)[0].v,
  ).toBe(true);
  expect((await db`select status from people where id=${P}`)[0].status).toBe("active");
  expect((await db`select count(*)::int n from workspace_members where status='active'`)[0].n).toBe(
    3,
  );
});
it("lifecycle SQL RLS denies direct foreign request reads", async () => {
  const r = await request();
  await db`set role authenticated`;
  expect((await db`select id from hiring_lifecycle_requests`).map((x) => x.id)).toEqual([r]);
  await db`reset role`;
  await db`update profiles set active_workspace_id=${B} where id=${U}`;
  await db`set role authenticated`;
  expect(await db`select id from hiring_lifecycle_requests`).toHaveLength(0);
});
it("lifecycle finance blocks canonical direct cancellation including service contexts", async () => {
  await db`insert into financial_entries(id,workspace_id,direction,status,metadata) values(${K},${W},'payable','open',jsonb_build_object('person_id',${P}::text))`;
  await expect(db`update financial_entries set status='cancelled' where id=${K}`).rejects.toThrow(
    "FINANCE_LIFECYCLE_REVIEW",
  );
  expect((await db`select status from financial_entries where id=${K}`)[0].status).toBe("open");
});
it("lifecycle offboarding refuses broad person effects and financial schedules", async () => {
  await expect(
    db`select hiring_offboarding_guard(${W},${P},${U},'cancel_payable_schedules')`,
  ).rejects.toThrow("cancelamento amplo bloqueado");
});
it("lifecycle renewal refuses unsigned purchase and replacement never admits implicitly", async () => {
  await expect(
    db`select hiring_lifecycle_preview(${W},${E},null,'renew',current_date+30,current_date+31,current_date+60,null,false,'Renovação revisada isolada')`,
  ).rejects.toThrow("Contrato revisado");
  await expect(preview("replace", A)).rejects.toThrow("Selecione alocação");
  expect((await db`select count(*)::int n from people`)[0].n).toBe(1);
});
