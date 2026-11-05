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
const container = "techerp-hiring-finance-ci-" + randomUUID();
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
let competitor: ReturnType<typeof postgres>;
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
  competitor = postgres({
    host: "127.0.0.1",
    port: Number(mapped.split(":")[1]),
    database: "techerp_permission_ci",
    username: "postgres",
    password,
    max: 1,
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
  await db.unsafe(readFileSync("tests/fixtures/hiring-stage3.sql", "utf8"));
  await db.unsafe(readFileSync("tests/fixtures/hiring-stage4.sql", "utf8"));
  await db.unsafe(readFileSync("drizzle/migrations/0308_hiring_demands_and_approvals.sql", "utf8"));
  await db.unsafe(
    sourceFunction(
      "drizzle/migrations/0172_techprojects_cycle2_deal_delivery.sql",
      "deal_stage_type",
    ),
  );
  await db.unsafe(
    sourceFunction(
      "drizzle/migrations/0218_order3_completion_prepare.sql",
      "contract_esign_manage",
    ),
  );
  await db.unsafe(
    sourceFunction(
      "drizzle/migrations/0218_order3_completion_prepare.sql",
      "contract_esign_public",
    ),
  );
  await db.unsafe(
    sourceFunction(
      "supabase/migrations/20260519191027_0ff4d7ed-582a-4195-a34b-e34969225c38.sql",
      "esign_check_completion",
    ),
  );
  await db.unsafe(
    "CREATE TRIGGER completion AFTER UPDATE ON esign_signers FOR EACH ROW EXECUTE FUNCTION esign_check_completion()",
  );
  await db.unsafe(readFileSync("drizzle/migrations/0309_hiring_signature_evidence.sql", "utf8"));
  await db.unsafe(
    readFileSync("drizzle/migrations/0310_hiring_recruitment_authorization.sql", "utf8"),
  );
  await db.unsafe(
    readFileSync("drizzle/migrations/0311_hiring_employment_and_access_models.sql", "utf8"),
  );
  for (const migration of [
    "0312_hiring_allocation_access_and_invites.sql",
    "0313_hiring_contract_owner_boundary.sql",
    "0314_hiring_invite_reissue_boundary.sql",
    "0315_hiring_role_restrictions.sql",
  ]) {
    await db.unsafe(readFileSync("drizzle/migrations/" + migration, "utf8"));
  }
  await db.unsafe(readFileSync("tests/fixtures/hiring-stage5.sql", "utf8"));
  await db.unsafe(
    sourceFunction("drizzle/migrations/0228_order5_fields_prepare.sql", "shared_field_mode_for"),
  );
  await db.unsafe(readFileSync("drizzle/migrations/0175_techprojects_cycle4_billing.sql", "utf8"));
  for (const f of [
    "0316_hiring_monthly_provisions.sql",
    "0317_hiring_billing_boundaries.sql",
    "0318_hiring_internal_cost_provisions.sql",
    "0319_hiring_legacy_billing_ownership.sql",
    "0320_hiring_completed_success_settlement.sql",
  ])
    await db.unsafe(readFileSync("drizzle/migrations/" + f, "utf8"));
}, 120000);
afterAll(async () => {
  if (competitor) await competitor.end();
  if (db) await db.end();
  if (started) dockerRun("rm", "-f", container);
  if (temporary) rmSync(temporary, { recursive: true, force: true });
});

it("finance schema loads production migrations", async () => {
  expect((await db`select count(*) n from hiring_monthly_provisions`)[0].n).toBe("0");
});
const K = "60000000-0000-4000-8000-000000000003",
  L = "60000000-0000-4000-8000-000000000002";
const CFG = "70000000-0000-4000-8000-000000000001",
  PROJ = "70000000-0000-4000-8000-000000000005";
async function setup() {
  const tables = await db`select tablename from pg_tables where schemaname='public'`;
  await db.unsafe(
    "TRUNCATE " +
      tables.map((t) => 'public."' + t.tablename + '"').join(",") +
      ",storage.objects,auth.users CASCADE",
  );
  await db`insert into workspaces values(${W}),(${B})`;
  await db`insert into profiles(id,active_workspace_id,full_name) values(${U},${W},'Finance fixture'),(${O},${W},'Reviewer')`;
  await db`insert into workspace_members(workspace_id,user_id,status,role) values(${W},${U},'active','member'),(${W},${O},'active','member')`;
  await db`insert into auth.users(id,email) values(${U},'finance@example.test'),(${O},'reviewer@example.test')`;
  await db`select set_config('request.uid',${U},false)`;
  for (const k of [
    "fixture.work",
    "techfinance.provisions.view.workspace",
    "techfinance.provisions.manage.workspace",
    "techfinance.provisions.approve.workspace",
    "techprojects.rates.view.workspace",
    "techprojects.measurements.view.workspace",
    "techprojects.measurements.manage.workspace",
    "techprojects.measurements.approve.workspace",
    "techprojects.measurement_finance.create.workspace",
    "techfinance.entries.create.own",
    "techprojects.billing_acceptance.approve.workspace",
  ])
    for (const u of [U, O]) await db`insert into grants values(${u},${k},'grant')`;
  await db`insert into legal_entities values(${L},${W},'WK fixture','00000000000001',true)`;
  await db`insert into contracts(id,workspace_id,owner_id,title,contracting_legal_entity_id,starts_at,ends_at,currency,monthly_value) values(${K},${W},${U},'Contrato fixture',${L},'2020-01-01','2049-12-31','BRL',1000)`;
  await db`insert into projects(id,workspace_id,owner_id,name,contract_id) values(${PROJ},${W},${U},'Projeto fixture',${K})`;
  await db`select set_config('app.project_billing_flow','on',false)`;
  await db`insert into project_billing_configs(id,workspace_id,contract_id,model,currency,params,valid_from,reason,created_by) values(${CFG},${W},${K},'fixed_recurring','BRL','{"amount_source":"contract_monthly"}','2020-01-01','Modelo fixture',${U})`;
  await db`select set_config('app.project_billing_flow','off',false)`;
}
async function preview() {
  return (await db`select hiring_provision_preview(${W},${CFG},'2026-10-01') v`)[0].v;
}
async function asUser<T>(fn: (sql: typeof db) => Promise<T>) {
  return db.begin(async (tx) => {
    await tx`set local role authenticated`;
    return fn(tx as unknown as typeof db);
  });
}
it("finance allows authorized active member", async () => {
  await setup();
  expect(
    (await asUser((s) => s`select hiring_provision_context(${W},${K},'2026-10-01') v`))[0].v
      .configs,
  ).toHaveLength(1);
});
it("finance rejects missing permission", async () => {
  await setup();
  await db`delete from grants where key='techfinance.provisions.view.workspace'`;
  await expect(
    asUser((s) => s`select hiring_provision_context(${W},${K},'2026-10-01')`),
  ).rejects.toThrow("Sem acesso");
});
it("finance rejects explicit deny", async () => {
  await setup();
  await db`insert into grants values(${U},'techfinance.provisions.view.workspace','deny')`;
  await expect(
    asUser((s) => s`select hiring_provision_context(${W},${K},'2026-10-01')`),
  ).rejects.toThrow("Sem acesso");
});
it("finance rejects foreign workspace", async () => {
  await setup();
  await expect(
    asUser((s) => s`select hiring_provision_context(${B},${K},'2026-10-01')`),
  ).rejects.toThrow("Sem acesso");
});
it("finance rejects inactive member", async () => {
  await setup();
  await db`update workspace_members set status='inactive' where user_id=${U}`;
  await expect(
    asUser((s) => s`select hiring_provision_context(${W},${K},'2026-10-01')`),
  ).rejects.toThrow("Sem acesso");
});
it("provision preview is a read-only fixed-model snapshot", async () => {
  await setup();
  const v = await preview();
  expect(v.totals.eligible_revenue).toBe(1000);
  expect((await db`select count(*) n from financial_entries`)[0].n).toBe("0");
});
const CO = "60000000-0000-4000-8000-000000000001",
  ENTRY = "80000000-0000-4000-8000-000000000001";
async function seal() {
  await db`insert into companies values(${CO},${W},'Client fixture','00000000000000',null) on conflict do nothing`;
  await db`update contracts set counterparty_company_id=${CO} where id=${K}`;
  const hash = (await db`select hiring_contract_fingerprint(${K}) v`)[0].v;
  await db`insert into storage.objects(bucket_id,name,user_metadata) values('contract-signature-evidence',${hash},${db.json({ sha256: hash })})`;
  await db`insert into hiring_contract_evidence(workspace_id,contract_id,kind,contract_hash,file_path,file_hash,signed_on,reference,note,recorded_by) values(${W},${K},'external',${hash},${hash},${hash},current_date,'Fixture','Fixture external confirmation',${U}) on conflict do nothing`;
  await db`insert into hiring_workspace_settings(workspace_id,enabled,updated_by,finance_gate_enabled) values(${W},true,${U},true) on conflict(workspace_id) do update set finance_gate_enabled=true`;
}
async function close(hash: string, previous: string | null = null, sql: typeof db = db) {
  return (
    await sql`select hiring_provision_close(${W},${CFG},'2026-10-01',${hash},${previous},'Fechamento gerencial conferido') v`
  )[0].v;
}
async function time(status = "draft", source = "manual", seconds = 3600) {
  await db`insert into project_time_entries(id,workspace_id,project_id,user_id,entry_date,status,source,duration_seconds,billable) values(${ENTRY},${W},${PROJ},${U},'2026-10-15',${status},${source},${seconds},true)`;
}
it("monthly close is idempotent and never creates a financial title", async () => {
  await setup();
  await seal();
  const v = await preview();
  const id = await close(v.hash);
  expect(await close(v.hash)).toBe(id);
  expect((await db`select count(*) n from hiring_monthly_provisions`)[0].n).toBe("1");
  expect((await db`select count(*) n from financial_entries`)[0].n).toBe("0");
});
it("monthly close rejects an open month", async () => {
  await setup();
  await seal();
  await expect(
    db`select hiring_provision_close(${W},${CFG},date_trunc('month',current_date)::date,'x',null,'Conferido na fixture')`,
  ).rejects.toThrow("mês encerrado");
});
it("monthly close rejects stale preview and preserves the first revision", async () => {
  await setup();
  await seal();
  const v = await preview();
  const id = await close(v.hash);
  await time();
  await expect(close(v.hash, id)).rejects.toThrow("PREVIEW_STALE");
  const next = await preview();
  await expect(close(next.hash)).rejects.toThrow("REVISION_STALE");
  const revised = await close(next.hash, id);
  expect(revised).not.toBe(id);
  expect(
    (await db`select revision from hiring_monthly_provisions order by revision`).map(
      (x) => x.revision,
    ),
  ).toEqual([1, 2]);
  await expect(
    db`update hiring_monthly_provisions set reason='Outra razão válida' where id=${id}`,
  ).rejects.toThrow("imutável");
});
it("two actual SQL connections close one provision only", async () => {
  await setup();
  await seal();
  const v = await preview();
  await competitor`select set_config('request.uid',${U},false)`;
  const ids = await Promise.all([close(v.hash), close(v.hash, null, competitor)]);
  expect(ids[0]).toBe(ids[1]);
  expect((await db`select count(*) n from hiring_monthly_provisions`)[0].n).toBe("1");
});
it("billing requires a current signature, not active status", async () => {
  await setup();
  await db`insert into hiring_workspace_settings(workspace_id,updated_by,finance_gate_enabled) values(${W},${U},true)`;
  await expect(preview()).rejects.toThrow("FINANCE_SOURCE");
  await seal();
  await preview();
  await db`update contracts set title='Conteúdo jurídico alterado' where id=${K}`;
  await expect(preview()).rejects.toThrow("FINANCE_SOURCE");
});
it("hourly billing excludes pending, imported and approved but unclosed hours", async () => {
  await setup();
  await seal();
  await db`select set_config('app.project_billing_flow','on',false)`;
  await db`update project_billing_configs set model='per_hour',params='{"require_closed_period":false}' where id=${CFG}`;
  await db`select set_config('app.project_billing_flow','off',false)`;
  await time();
  let v = await preview();
  expect(v.pending_estimates).toHaveLength(1);
  expect(v.revenue[0].issue).toBe("excluded:not_approved");
  await db`update project_time_entries set status='approved' where id=${ENTRY}`;
  v = await preview();
  expect(v.revenue[0].issue).toBe("excluded:not_closed");
  await db`update project_time_entries set status='locked',source='import' where id=${ENTRY}`;
  v = await preview();
  expect(v.revenue[0].issue).toBe("excluded:imported_locked");
  expect(v.pending_estimates).toHaveLength(0);
});
it("unknown hourly cost stays unknown, never zero", async () => {
  await setup();
  await time();
  const v = await preview();
  expect(v.costs[0].amount).toBeNull();
  expect(v.totals.unknown_cost_lines).toBe(1);
  expect(v.totals.known_estimated_cost).toBeNull();
});
it("no source permission means no cost snapshot or SQL table read", async () => {
  await setup();
  await db`insert into grants values(${U},'techprojects.rates.view.workspace','deny')`;
  await expect(
    asUser((s) => s`select hiring_provision_context(${W},${K},'2026-10-01')`),
  ).rejects.toThrow("Sem acesso");
  expect((await asUser((s) => s`select * from hiring_monthly_provisions`)).length).toBe(0);
});
it("a done milestone needs explicit current delivery acceptance", async () => {
  await setup();
  await seal();
  await db`select set_config('app.project_billing_flow','on',false)`;
  await db`update project_billing_configs set model='milestone',params='{}' where id=${CFG}`;
  await db`select set_config('app.project_billing_flow','off',false)`;
  await db`insert into project_milestones(id,workspace_id,project_id,name,status,completed_at,billable,bill_amount) values(${ENTRY},${W},${PROJ},'Entrega fixture','done','2026-10-15',true,1500)`;
  expect((await preview()).revenue[0].issue).toBe("excluded:delivery_acceptance_missing");
  const x = (
    await db`select hiring_milestone_accept(${W},${ENTRY},'Aceite expresso do cliente fixture') v`
  )[0].v;
  expect(
    (
      await db`select hiring_milestone_accept(${W},${ENTRY},'Aceite expresso do cliente fixture') v`
    )[0].v,
  ).toBe(x);
  expect((await preview()).totals.eligible_revenue).toBe(1500);
  await db`update project_milestones set bill_amount=1600 where id=${ENTRY}`;
  expect((await preview()).revenue[0].issue).toBe("excluded:delivery_acceptance_missing");
});
it("ended signed contract can settle its last valid month, never the next month", async () => {
  await setup();
  await db`update contracts set ends_at='2026-10-31' where id=${K}`;
  await seal();
  await db`update contracts set status='ended' where id=${K}`;
  expect((await preview()).totals.eligible_revenue).toBe(1000);
  await expect(db`select hiring_provision_preview(${W},${CFG},'2026-11-01')`).rejects.toThrow(
    "fora da vigência",
  );
});
async function measurement() {
  return (
    await db`select project_measurement_build(${CFG},'2026-10-01','regular','America/Sao_Paulo') v`
  )[0].v as string;
}
async function ready() {
  const id = await measurement();
  const hash = (await db`select lines_hash v from project_measurements where id=${id}`)[0].v;
  await db`select project_measurement_submit(${id},${hash})`;
  await expect(db`select project_measurement_approve(${id},${hash})`).rejects.toThrow();
  await db`select set_config('request.uid',${O},false)`;
  await db`select project_measurement_approve(${id},${hash})`;
  return { id, hash };
}
it("segregated measurement creates a single title under concurrent generation", async () => {
  await setup();
  await seal();
  const { id, hash } = await ready();
  await competitor`select set_config('request.uid',${O},false)`;
  const run = (s: typeof db) =>
    s`select project_measurement_generate(${id},${hash},'2026-11-15') v`;
  const [a, b] = await Promise.all([run(db), run(competitor)]);
  expect(a[0].v.status).toBe("generated");
  expect(b[0].v.status).toBe("generated");
  expect((await db`select count(*) n from financial_entries`)[0].n).toBe("1");
  expect((await db`select legal_entity_id from financial_entries`)[0].legal_entity_id).toBe(L);
});
it("provision still reports revenue after a regular measurement reserves the sources", async () => {
  await setup();
  await seal();
  await measurement();
  expect((await preview()).totals.eligible_revenue).toBe(1000);
});
it("package fee is contractual but pending time never consumes approved balance", async () => {
  await setup();
  await seal();
  await db`select set_config('app.project_billing_flow','on',false)`;
  await db`update project_billing_configs set model='package',params='{"included_seconds":3600,"package_amount":100,"carryover_months":0}' where id=${CFG}`;
  await db`select set_config('app.project_billing_flow','off',false)`;
  await time();
  const v = await preview();
  expect(v.totals.eligible_revenue).toBe(100);
  expect(
    v.revenue.find((x: { source_type: string }) => x.source_type === "time_entry").included,
  ).toBe(false);
});
it("monthly person cost is allocated by percentage in the contract currency", async () => {
  await setup();
  const person = "90000000-0000-4000-8000-000000000001",
    allocation = "90000000-0000-4000-8000-000000000002";
  await db`insert into people(id,workspace_id,profile_id,full_name,status) values(${person},${W},${U},'Cost fixture','active')`;
  await db`insert into people_allocations(id,workspace_id,person_id,project_id,starts_at,ends_at,allocation_pct,status) values(${allocation},${W},${person},${PROJ},'2026-10-01','2026-10-31',50,'active')`;
  await db`select set_config('app.project_billing_flow','on',false)`;
  await db`insert into project_rates(workspace_id,kind,scope,person_id,unit,proration,currency,amount,valid_from,reason,created_by) values(${W},'cost','person',${person},'month','calendar_days','BRL',20000,'2026-10-01','Custo mensal fixture',${U})`;
  await db`select set_config('app.project_billing_flow','off',false)`;
  const v = await preview();
  expect(v.costs[0].amount).toBe(10000);
  expect(v.costs[0].allocation_id).toBe(allocation);
});
const D = "60000000-0000-4000-8000-000000000004",
  J = "50000000-0000-4000-8000-000000000001",
  APP = "50000000-0000-4000-8000-000000000002",
  SVC = "50000000-0000-4000-8000-000000000003";
async function hunting() {
  await setup();
  await db`insert into deals(id,workspace_id,company_id,name) values(${D},${W},${CO},'Hunting fixture')`;
  await db`update contracts set deal_id=${D} where id=${K}`;
  await db`insert into ats_jobs(id,workspace_id,title,deal_id) values(${J},${W},'Hunting fixture',${D})`;
  await db`insert into ats_applications(id,workspace_id,job_id,status,hiring_details) values(${APP},${W},${J},'hired','{"model":"hunting"}')`;
  await db`insert into grants values(${U},'fixture.hr','grant')`;
  await db`insert into services(id,workspace_id,contract_id,name,percent,percent_base_amount,currency,type) values(${SVC},${W},${K},'Hunting fixture',20,1000,'BRL','one_time')`;
  await db`select set_config('app.project_billing_flow','on',false)`;
  await db`update project_billing_configs set service_id=${SVC},model='percent',params='{"percent":20}' where id=${CFG}`;
  await db`select set_config('app.project_billing_flow','off',false)`;
  await seal();
  return measurement();
}
it("Hunting requires a confirmed hiring event in the measured month, not an offer signature", async () => {
  const id = await hunting();
  await expect(
    db`select project_measurement_add_success_event(${id},'ats_application',${APP},null,'Evento comercial conferido')`,
  ).rejects.toThrow("HUNTING_SUCCESS");
  await db`insert into ats_hiring_decisions(workspace_id,application_id,event,created_at) values(${W},${APP},'confirmed','2026-10-15')`;
  await db`select project_measurement_add_success_event(${id},'ats_application',${APP},null,'Evento comercial conferido')`;
  expect(
    (await db`select total_amount from project_measurements where id=${id}`)[0].total_amount,
  ).toBe("200.00");
  expect((await preview()).totals.eligible_revenue).toBe(200);
  await db`update ats_applications set status='active' where id=${APP}`;
  await expect(db`select hiring_measurement_source_check(${id})`).rejects.toThrow(
    "HUNTING_SUCCESS",
  );
  expect((await db`select count(*) n from financial_entries`)[0].n).toBe("0");
});
it("offer and application aliases cannot bill the same hiring twice", async () => {
  const id = await hunting();
  await db`insert into ats_hiring_decisions(workspace_id,application_id,event,created_at) values(${W},${APP},'confirmed','2026-10-15')`;
  await db`insert into ats_offers(id,workspace_id,job_id,application_id) values(${ENTRY},${W},${J},${APP})`;
  await db`select project_measurement_add_success_event(${id},'ats_offer',${ENTRY},null,'Evento comercial conferido')`;
  await expect(
    db`select project_measurement_add_success_event(${id},'ats_application',${APP},null,'Mesmo evento reapresentado')`,
  ).rejects.toThrow();
  expect(
    (await db`select source_id from project_measurement_lines where source_type='success_event'`)[0]
      .source_id,
  ).toBe(APP);
});

it("hidden financial amount blocks the complete provision snapshot through the real field resolver", async () => {
  await setup();
  await db`insert into job_roles(id,workspace_id,name) values(${R},${W},'Restricted finance')`;
  await db`insert into user_job_roles(user_id,workspace_id,role_id) values(${U},${W},${R})`;
  await db`insert into shared_field_catalog(resource,field,table_name,configurable,guard_fields) values('techfinance.entries','amount','financial_entries',true,array['amount'])`;
  await db`insert into field_permission_rules(workspace_id,resource,field,mode,role_id) values(${W},'techfinance.entries','amount','hidden',${R})`;
  await expect(
    asUser((s) => s`select hiring_provision_context(${W},${K},'2026-10-01')`),
  ).rejects.toThrow("Sem acesso");
});
it("raw authenticated writes and internal calculators are not an alternate API", async () => {
  await setup();
  await expect(
    asUser((s) => s`insert into hiring_monthly_provisions default values`),
  ).rejects.toThrow("permission denied");
  await expect(
    asUser((s) => s`select hiring_provision_compute(${CFG},'2026-10-01')`),
  ).rejects.toThrow("permission denied");
  await expect(
    asUser((s) => s`select hiring_workflow_finance_guard(${W},${APP},${U})`),
  ).rejects.toThrow("permission denied");
});
it("provision preparation alone cannot close the month", async () => {
  await setup();
  await seal();
  const v = await preview();
  await db`delete from grants where key='techfinance.provisions.approve.workspace'`;
  await expect(close(v.hash)).rejects.toThrow("Sem acesso");
  expect((await db`select count(*) n from hiring_monthly_provisions`)[0].n).toBe("0");
});
it("paid measurement cannot be reversed by the new workflow", async () => {
  await setup();
  await seal();
  await db`insert into grants values(${O},'techprojects.measurement_reverse.manage.workspace','grant')`;
  const { id, hash } = await ready();
  await db`select project_measurement_generate(${id},${hash},'2026-11-15')`;
  const fe = (await db`select id from financial_entries`)[0].id;
  await db`insert into financial_payments(id,entry_id,amount) values(gen_random_uuid(),${fe},1000)`;
  await expect(
    db`select project_measurement_reverse(${id},'Tentativa de estorno conferida')`,
  ).rejects.toThrow("REVERSE_BLOCKED");
  expect((await db`select count(*) n from financial_payments where entry_id=${fe}`)[0].n).toBe("1");
  expect((await db`select status from project_measurements where id=${id}`)[0].status).toBe(
    "generated",
  );
});
const PERSON = "90000000-0000-4000-8000-000000000001",
  MODEL = "90000000-0000-4000-8000-000000000002",
  VERSION = "90000000-0000-4000-8000-000000000003",
  ENG = "90000000-0000-4000-8000-000000000004";
async function internalCost() {
  await setup();
  await db`select set_config('app.project_billing_flow','on',false)`;
  await db`delete from project_billing_configs where id=${CFG}`;
  await db`select set_config('app.project_billing_flow','off',false)`;
  await db`delete from projects where id=${PROJ}`;
  await db`insert into grants values(${U},'fixture.hr','grant'),(${U},'techpeople.employment.view.workspace','grant')`;
  await db`insert into people(id,workspace_id,profile_id,full_name,hire_date,employment_type) values(${PERSON},${W},${U},'Internal fixture','2026-01-01','clt')`;
  await db`select set_config('app.hiring_purchase','on',false)`;
  await db`update contracts set role='client',hiring_person_id=${PERSON},deal_id=null where id=${K}`;
  await db`select set_config('app.hiring_purchase','off',false)`;
  await db`insert into ats_jobs(id,workspace_id,title) values(${J},${W},'Internal fixture')`;
  await db`insert into hiring_access_models(id,workspace_id,name,updated_by) values(${MODEL},${W},'Internal fixture',${U})`;
  await db`insert into hiring_access_model_versions(id,model_id,workspace_id,revision,name,allocation_only,permission_keys,created_by) values(${VERSION},${MODEL},${W},1,'Internal fixture',false,'{}',${U})`;
  await db`insert into hiring_engagements(id,workspace_id,person_id,job_id,purpose,employment_type,legal_entity_id,purchase_contract_id,model_version_id,starts_at,created_by) values(${ENG},${W},${PERSON},${J},'internal','clt',${L},${K},${VERSION},'2026-01-01',${U})`;
  await db`insert into hiring_workspace_settings(workspace_id,enabled,updated_by,finance_gate_enabled) values(${W},true,${U},true)`;
  await db`select set_config('app.project_billing_flow','on',false)`;
  await db`insert into project_rates(workspace_id,kind,scope,person_id,unit,proration,currency,amount,valid_from,reason,created_by) values(${W},'cost','person',${PERSON},'month','calendar_days','BRL',10000,'2026-01-01','Custo mensal fixture',${U})`;
  await db`select set_config('app.project_billing_flow','off',false)`;
}
it("internal employment provisions costs without a sale, client or billing config", async () => {
  await internalCost();
  const ctx = (await db`select hiring_provision_context(${W},${K},'2026-10-01') v`)[0].v;
  expect(ctx.configs[0].model).toBe("cost_monthly");
  const v = (await db`select hiring_provision_preview(${W},${K},'2026-10-01') v`)[0].v;
  expect(v.totals.known_estimated_cost).toBe(10000);
  expect(v.revenue).toEqual([]);
  const id = (
    await db`select hiring_provision_close(${W},${K},'2026-10-01',${v.hash},null,'Fechamento de custo interno conferido') v`
  )[0].v;
  expect(
    (await db`select kind,config_id from hiring_monthly_provisions where id=${id}`)[0],
  ).toMatchObject({ kind: "cost", config_id: null });
  expect((await db`select count(*) n from financial_entries`)[0].n).toBe("0");
});
it("internal cost starts on the actual admission date, not commercial/employment start", async () => {
  await internalCost();
  await db`update people set hire_date='2026-10-16' where id=${PERSON}`;
  const v = (await db`select hiring_provision_preview(${W},${K},'2026-10-01') v`)[0].v;
  expect(v.totals.known_estimated_cost).toBe(5161.29);
});
it("cost-only history requires HR source visibility as well as financial permission", async () => {
  await internalCost();
  await db`insert into grants values(${U},'fixture.hr','deny')`;
  await expect(
    asUser((s) => s`select hiring_provision_context(${W},${K},'2026-10-01')`),
  ).rejects.toThrow("Sem acesso");
});
it("shared management does not require a fabricated sales contract", async () => {
  await internalCost();
  await db`update hiring_engagements set purpose='shared_management' where id=${ENG}`;
  const v = (await db`select hiring_provision_preview(${W},${K},'2026-10-01') v`)[0].v;
  expect(v.model).toBe("cost_monthly");
  expect(v.totals.known_estimated_cost).toBe(10000);
});
it("legacy hiring workers yield when a measurement already owns the deal", async () => {
  await hunting();
  await expect(db`select hiring_workflow_finance_guard(${W},${APP},${U})`).rejects.toThrow(
    "FINANCE_MONTHLY_FLOW",
  );
  await expect(
    db`insert into financial_entries(workspace_id,owner_id,direction,origin_type,description,amount,currency,competence_date,due_date,status,metadata) values(${W},${U},'receivable','manual','Duplicação legada',200,'BRL',current_date,current_date,'open',${db.json({ origin: "workflow_hiring", source_id: APP })})`,
  ).rejects.toThrow("FINANCE_MONTHLY_FLOW");
  expect((await db`select count(*) n from financial_entries`)[0].n).toBe("0");
});
it("existing legacy success title becomes a gate, never a duplicate invoice", async () => {
  const id = await hunting();
  await db`update hiring_workspace_settings set finance_gate_enabled=false where workspace_id=${W}`;
  await db`insert into financial_entries(workspace_id,owner_id,direction,origin_type,description,amount,currency,competence_date,due_date,status,metadata) values(${W},${U},'receivable','manual','Título anterior à implantação',200,'BRL','2026-10-01','2026-11-15','open',${db.json({ origin: "workflow_hiring", source_id: APP })})`;
  await db`update hiring_workspace_settings set finance_gate_enabled=true where workspace_id=${W}`;
  await db`insert into ats_hiring_decisions(workspace_id,application_id,event,created_at) values(${W},${APP},'confirmed','2026-10-15')`;
  await db`select project_measurement_add_success_event(${id},'ats_application',${APP},null,'Evento comercial conferido')`;
  const hash = (await db`select lines_hash from project_measurements where id=${id}`)[0].lines_hash;
  await db`select project_measurement_submit(${id},${hash})`;
  await db`select set_config('request.uid',${O},false)`;
  expect((await db`select project_measurement_approve(${id},${hash}) v`)[0].v).toBe("approved");
  await expect(db`select project_measurement_generate(${id},${hash},'2026-11-15')`).rejects.toThrow(
    "hiring_legacy_success_exists",
  );
  expect((await db`select count(*) n from financial_entries`)[0].n).toBe("1");
});

it("completed governed Hunting settles its valid final month without reopening recruitment", async () => {
  const id = await hunting();
  await db`update contracts set ends_at='2026-10-31' where id=${K}`;
  await seal();
  await db`update contracts set status='ended' where id=${K}`;
  await db`update hiring_workspace_settings set signature_gate_enabled=true where workspace_id=${W}`;
  await db`select set_config('app.hiring_stage2','on',false)`;
  await db`select set_config('app.hiring_contract_link','on',false)`;
  await db`update ats_jobs set hiring_governed=true,hiring_purpose='client',hiring_approval_status='approved',hiring_contract_id=${K} where id=${J}`;
  await db`select set_config('app.hiring_stage2','off',false)`;
  await db`select set_config('app.hiring_contract_link','off',false)`;
  await db`insert into ats_hiring_decisions(workspace_id,application_id,event,created_at) values(${W},${APP},'confirmed','2026-10-15')`;
  expect((await db`select hiring_workflow_recruitment_check(${W},${APP}) v`)[0].v.ready).toBe(
    false,
  );
  await db`select project_measurement_add_success_event(${id},'ats_application',${APP},null,'Contratação confirmada na competência')`;
  expect(
    (await db`select total_amount from project_measurements where id=${id}`)[0].total_amount,
  ).toBe("200.00");
});
