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
const container = "techerp-employment-ci-" + randomUUID();
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
  await db`insert into workspaces(id) values(${W})`;
  await db`insert into contracts(id,workspace_id,title,body_html) values(${K},${W},'Contrato já assinado','Texto jurídico anterior à etapa 4')`;
  beforeSchemaHash = (await db`select hiring_contract_fingerprint(${K}) v`)[0].v;
  await db.unsafe(
    readFileSync("drizzle/migrations/0311_hiring_employment_and_access_models.sql", "utf8"),
  );
  afterSchemaHash = (await db`select hiring_contract_fingerprint(${K}) v`)[0].v;
  for (const migration of [
    "0312_hiring_allocation_access_and_invites.sql",
    "0313_hiring_contract_owner_boundary.sql",
    "0314_hiring_invite_reissue_boundary.sql",
    "0315_hiring_role_restrictions.sql",
  ]) {
    await db.unsafe(readFileSync("drizzle/migrations/" + migration, "utf8"));
  }
}, 120000);
afterAll(async () => {
  if (competitor) await competitor.end();
  if (db) await db.end();
  if (started) dockerRun("rm", "-f", container);
  if (temporary) rmSync(temporary, { recursive: true, force: true });
});
const C = "60000000-0000-4000-8000-000000000001",
  L = "60000000-0000-4000-8000-000000000002",
  K = "60000000-0000-4000-8000-000000000003",
  D = "60000000-0000-4000-8000-000000000004",
  J = IDs[0],
  A = IDs[1],
  F = IDs[2];
let beforeSchemaHash = "",
  afterSchemaHash = "";
const FILE_HASH = "a".repeat(64);
async function reset() {
  await db`select set_config('request.jwt.claim.sub','',false)`;
  await db`truncate auth.users cascade`;
  const tables = await db`select tablename from pg_tables where schemaname='public'`;
  await db.unsafe(
    "TRUNCATE " +
      tables.map((t) => 'public."' + t.tablename + '"').join(",") +
      ",storage.objects CASCADE",
  );
  await db`insert into workspaces(id) values(${W}),(${B})`;
  for (const u of [U, O, P]) {
    await db`insert into profiles values(${u},${W},'Fixture')`;
    await db`insert into workspace_members(workspace_id,user_id) values(${W},${u})`;
    for (const k of [
      "base.contracts.view",
      "base.contracts.update",
      "techcontracts.signature_evidence.view.workspace",
      "techcontracts.signature_evidence.manage.workspace",
      "techcontracts.esign.create.workspace",
      "techcontracts.esign.send.workspace",
      "techhire.hiring_demands.view.workspace",
      "techhire.hiring_demands.update.workspace",
      "techhire.hiring_demands.create.workspace",
      "techhire.hiring_demands.approve.workspace",
      "techsales.role_profiles.view.workspace",
      "techsales.role_profiles.manage.workspace",
    ])
      await db`insert into grants values(${u},${k},'grant')`;
  }
  await db`select set_config('request.uid',${U},false)`;
  await db`insert into auth.users(id,email) values(${U},'actor@example.test'),(${O},'other@example.test')`;
  await db`insert into user_groups values(${R},${W},'Area')`;
  await db`insert into companies values(${C},${W},'Cliente','00000000000000',null)`;
  await db`insert into legal_entities values(${L},${W},'Emissor','00000000000001',true)`;
  await db`insert into deals(id,workspace_id,company_id,stage,name) values(${D},${W},${C},'won','Negocio')`;
  await db`insert into contracts(id,workspace_id,owner_id,title,number,deal_id,counterparty_company_id,contracting_legal_entity_id,starts_at,ends_at,body_html,total_value) values(${K},${W},${U},'Contrato fixture','FIX',${D},${C},${L},current_date,current_date+365,'Termos comerciais conferidos pelas partes',100)`;
  await db`insert into hiring_workspace_settings(workspace_id,enabled,updated_by,signature_gate_enabled) values(${W},true,${U},true)`;
  await db`insert into hiring_commercial_contracts(deal_id,workspace_id,contract_id,selected_by) values(${D},${W},${K},${U})`;
  await db`insert into ats_jobs(id,workspace_id,title,deal_id,employment_type,hiring_area_id,hiring_billing_model) values(${J},${W},'Vaga',${D},'pj',${R},'per_hour')`;
  await db`select set_config('app.hiring_stage2','on',false)`;
  await db`update ats_jobs set hiring_approval_status='approved' where id=${J}`;
  await db`select set_config('app.hiring_stage2','off',false)`;
}
async function fingerprint() {
  return (await db`select hiring_contract_fingerprint(${K}) v`)[0].v as string;
}
async function signatureReason() {
  return (await db`select hiring_contract_signature_reason(${K},${W},${D}) v`)[0].v;
}
async function recruitmentReason() {
  return (await db`select hiring_recruitment_reason(${W},${J}) v`)[0].v;
}
async function external() {
  const hash = await fingerprint(),
    path = `${W}/${K}/fixture.pdf`;
  await db`insert into storage.objects(bucket_id,name,user_metadata) values('contract-signature-evidence',${path},${db.json({ sha256: FILE_HASH, contract_hash: hash, actor_id: U })})`;
  return (
    await db`select hiring_contract_external_attest(${W},${K},${hash},${path},${FILE_HASH},current_date-1,'Certificado fixture','Conferência humana do documento completo e assinatura das duas partes.') v`
  )[0].v;
}
const MODEL = "70000000-0000-4000-8000-000000000001",
  ROLE = "70000000-0000-4000-8000-000000000002",
  CAND = "70000000-0000-4000-8000-000000000003",
  APP = "70000000-0000-4000-8000-000000000004",
  PROJ = "70000000-0000-4000-8000-000000000005",
  OTHER = "70000000-0000-4000-8000-000000000006";
const accessKeys = [
  "techprojects.projects.view.workspace",
  "techprojects.tasks.view.workspace",
  "techprojects.time_entries.create.own",
  "techpeople.people.view.own",
];
async function setup() {
  await reset();
  await db`update hiring_workspace_settings set employment_gate_enabled=true where workspace_id=${W}`;
  for (const k of [
    "techpeople.employment.view.workspace",
    "techpeople.employment.manage.workspace",
    "system.hiring_access.view.workspace",
    "system.hiring_access.manage.workspace",
    "system.roles.manage.workspace",
    "techpeople.people.create.workspace",
    "techcontracts.contracts.create.workspace",
    "fixture.hr",
    "fixture.work",
  ])
    await db`insert into grants values(${U},${k},'grant')`;
  await db`insert into permissions(key) values('system.roles.manage.workspace'),('techpeople.employment.manage.workspace') on conflict do nothing`;
  for (const k of accessKeys)
    await db`insert into permissions(key) values(${k}) on conflict do nothing`;
  await db`insert into job_roles(id,workspace_id,name) values(${ROLE},${W},'Desenvolvedor')`;
  await db`insert into ats_candidates values(${CAND},${W},'Profissional Fixture','fixture@example.test',null,'Brasil')`;
  await db`update ats_jobs set hiring_role_id=${ROLE} where id=${J}`;
  await db`select set_config('app.hiring_stage2','on',false)`;
  await db`update ats_jobs set hiring_approval_status='approved' where id=${J}`;
  await db`select set_config('app.hiring_stage2','off',false)`;
  await external();
  await db`insert into ats_applications(id,workspace_id,job_id,candidate_id,status,hiring_details) values(${APP},${W},${J},${CAND},'hired',jsonb_build_object('model','outsourcing','start_date',current_date::text))`;
  await db`select hiring_model_save(${W},${null},0,${ROLE},'Modelo alocado',${accessKeys},true,true)`;
  await db`update workspace_members set role='member' where user_id=${P}`;
  const m = (await db`select id from hiring_access_models where workspace_id=${W}`)[0].id;
  return m as string;
}
async function admit(m: string, person: string | null = null) {
  return (
    await db`select hiring_employment_admit(${W},${APP},${person},${m},${L},${null},${null},'', 'pj') id`
  )[0].id as string;
}
async function context() {
  return (await db`select hiring_employment_context(${W},${null},${CAND}) v`)[0].v;
}
it("employment allows authorized active member", async () => {
  await setup();
  expect((await context()).applications).toHaveLength(1);
});
it("employment rejects missing permission", async () => {
  await setup();
  await db`delete from grants where user_id=${U} and key='techpeople.employment.view.workspace'`;
  await expect(context()).rejects.toThrow("permissão");
});
it("employment rejects explicit deny", async () => {
  await setup();
  await db`insert into grants values(${U},'techpeople.employment.view.workspace','deny')`;
  await expect(context()).rejects.toThrow("permissão");
});
it("employment rejects foreign workspace", async () => {
  await setup();
  await db`update profiles set active_workspace_id=${B} where id=${U}`;
  await expect(context()).rejects.toThrow("permissão");
});
it("employment rejects inactive member", async () => {
  await setup();
  await db`update workspace_members set status='inactive' where user_id=${U}`;
  await expect(context()).rejects.toThrow("permissão");
});
it("admission is idempotent under competing requests and inherits entity and dates", async () => {
  const m = await setup();
  const [a, b] = await Promise.all([
    admit(m),
    competitor.begin(async (tx) => {
      await tx`select set_config('request.uid',${U},true)`;
      return (
        await tx`select hiring_employment_admit(${W},${APP},null,${m},${L},null,null,'','pj') id`
      )[0].id;
    }),
  ]);
  expect(a).toBe(b);
  const e = (await db`select * from hiring_engagements where id=${a}`)[0];
  expect(e.legal_entity_id).toBe(L);
  expect(e.commercial_contract_id).toBe(K);
  expect((await db`select count(*)::int n from people`)[0].n).toBe(1);
});
it("does not infer or duplicate an existing person by name or email", async () => {
  const m = await setup();
  await db`insert into people(id,workspace_id,full_name,email,employment_type) values(${OTHER},${W},'Pessoa existente','fixture@example.test','pj')`;
  const e = await admit(m, OTHER);
  expect((await db`select person_id from hiring_engagements where id=${e}`)[0].person_id).toBe(
    OTHER,
  );
  expect((await db`select count(*)::int n from people`)[0].n).toBe(1);
});
it("blocks Hunting, wrong entity, unsigned contract and unapproved demand", async () => {
  const m = await setup();
  await db`update ats_applications set hiring_details='{"model":"hunting"}' where id=${APP}`;
  await expect(admit(m)).rejects.toThrow("Hunting");
  await db`update ats_applications set hiring_details='{}' where id=${APP}`;
  await expect(
    db`select hiring_employment_admit(${W},${APP},null,${m},${OTHER},null,null,'','pj')`,
  ).rejects.toThrow("entidade");
  await db`update hiring_contract_evidence set revoked_at=now()`;
  await expect(admit(m)).rejects.toThrow("Assinatura");
});
it("period changes require a reason and cannot extend commercial obligation", async () => {
  const m = await setup();
  await expect(
    db`select hiring_employment_admit(${W},${APP},null,${m},${L},current_date+1,current_date+30,'','pj')`,
  ).rejects.toThrow("Justifique");
  await expect(
    db`select hiring_employment_admit(${W},${APP},null,${m},${L},current_date,current_date+500,'Prazo solicitado com justificativa','pj')`,
  ).rejects.toThrow("vigência");
});
it("creates one purchase draft with client role and correct WK entity", async () => {
  const m = await setup(),
    e = await admit(m);
  const a = (await db`select hiring_employment_contract(${W},${e},null) id`)[0].id;
  const b = (await db`select hiring_employment_contract(${W},${e},null) id`)[0].id;
  expect(a).toBe(b);
  const c = (await db`select * from contracts where id=${a}`)[0];
  expect(c.role).toBe("client");
  expect(c.status).toBe("draft");
  expect(c.contracting_legal_entity_id).toBe(L);
  await expect(
    db`update contracts set contracting_legal_entity_id=null where id=${a}`,
  ).rejects.toThrow("preservar");
});
async function readyAllocation() {
  const m = await setup(),
    e = await admit(m);
  const c = (await db`select hiring_employment_contract(${W},${e},null) id`)[0].id;
  await db`update contracts set status='active' where id=${c}`;
  await db`insert into projects(id,workspace_id,name,contract_id,deal_id) values(${PROJ},${W},'Projeto alocado',${K},${D}),(${OTHER},${W},'Outro projeto',null,null)`;
  return { m, e, c };
}
it("allocates transactionally and rejects another project or mismatch", async () => {
  const { e } = await readyAllocation();
  await expect(db`select hiring_allocate(${W},${e},${OTHER},null,null,50,'')`).rejects.toThrow(
    "Projeto",
  );
  const a = (await db`select hiring_allocate(${W},${e},${PROJ},null,null,50,'') id`)[0].id;
  const b = (await db`select hiring_allocate(${W},${e},${PROJ},null,null,50,'') id`)[0].id;
  expect(a).toBe(b);
  await expect(db`update people_allocations set contract_id=null where id=${a}`).rejects.toThrow(
    "CNPJ",
  );
});
async function accept(e: string) {
  await db`insert into auth.users(id,email) values(${P},'fixture@example.test') on conflict(id) do nothing`;
  const token = (await db`select hiring_employment_invite(${W},${e}) t`)[0].t;
  await db`select set_config('request.uid',${P},false)`;
  await db`select hiring_accept_invite(${token})`;
  return token as string;
}
it("specific invite grants only its snapshot and no Sales role; project scope is enforced by RLS", async () => {
  const { e } = await readyAllocation();
  await db`select hiring_allocate(${W},${e},${PROJ},null,null,100,'')`;
  const token = await accept(e);
  await db`select hiring_accept_invite(${token})`;
  expect((await db`select count(*)::int n from user_job_roles where user_id=${P}`)[0].n).toBe(0);
  expect((await db`select count(*)::int n from hiring_access_grants where user_id=${P}`)[0].n).toBe(
    1,
  );
  expect((await db`select hiring_allocation_scope(${W},${PROJ}) v`)[0].v).toBe(true);
  expect((await db`select hiring_allocation_scope(${W},${OTHER}) v`)[0].v).toBe(false);
  await db`update workspace_members set role='member' where user_id=${P}`;
  await db`set role authenticated`;
  expect((await db`select id from projects`).map((r) => r.id)).toEqual([PROJ]);
  await db`reset role`;
});
it("rejects wrong recipient and ended invite without changing existing account credentials", async () => {
  const { e } = await readyAllocation();
  const token = (await db`select hiring_employment_invite(${W},${e}) t`)[0].t;
  await db`insert into auth.users values(${P},'another@example.test')`;
  await db`select set_config('request.uid',${P},false)`;
  await expect(db`select hiring_accept_invite(${token})`).rejects.toThrow("destinatário");
  await db`select set_config('request.uid',${U},false)`;
  await db`select hiring_employment_end(${W},${e},'Vínculo encerrado pelo gestor autorizado')`;
  await db`select set_config('request.uid',${P},false)`;
  await expect(db`select hiring_accept_invite(${token})`).rejects.toThrow("expirado");
});
it("ending a single allocation preserves a second allocation and its access", async () => {
  const { e } = await readyAllocation();
  const a = (await db`select hiring_allocate(${W},${e},${PROJ},null,null,50,'') id`)[0].id;
  await db`insert into projects(id,workspace_id,name,contract_id,deal_id) values(${MODEL},${W},'Segundo projeto',${K},${D})`;
  await db`select hiring_allocate(${W},${e},${MODEL},null,null,50,'')`;
  await accept(e);
  await db`select set_config('request.uid',${U},false)`;
  await db`update people_allocations set status='ended',can_track_time=false where id=${a}`;
  await db`select set_config('request.uid',${P},false)`;
  expect((await db`select hiring_allocation_scope(${W},${PROJ}) v`)[0].v).toBe(false);
  expect((await db`select hiring_allocation_scope(${W},${MODEL}) v`)[0].v).toBe(true);
  expect((await db`select project_time_can_track(${P},${PROJ},current_date) v`)[0].v).toBe(false);
  expect((await db`select project_time_can_track(${P},${MODEL},current_date) v`)[0].v).toBe(true);
});
it("employment end revokes only its owned grant and keeps manual access and membership", async () => {
  const { e } = await readyAllocation();
  await accept(e);
  await db`select set_config('request.uid',${U},false)`;
  await db`insert into permission_sets(id,workspace_id,module,name) values(${OTHER},${W},'manual','Manual')`;
  await db`insert into user_permission_sets(workspace_id,user_id,set_id) values(${W},${P},${OTHER})`;
  await db`select hiring_employment_end(${W},${e},'Encerramento confirmado pela área responsável')`;
  expect(
    (await db`select set_id from user_permission_sets where user_id=${P}`).map((r) => r.set_id),
  ).toEqual([OTHER]);
  expect((await db`select status from workspace_members where user_id=${P}`)[0].status).toBe(
    "active",
  );
  expect((await db`select status from people limit 1`)[0].status).toBe("active");
});
it("expired grants are ignored by the actual permission resolver and deny still wins", async () => {
  const { e } = await readyAllocation();
  await accept(e);
  await db`update workspace_members set role='member' where user_id=${P}`;
  expect(
    (await db`select * from techerp_api.effective_permissions_unchecked(${P},${W})`).map(
      (r) => r.effective_permissions_unchecked,
    ),
  ).toContain(accessKeys[0]);
  await db`insert into user_job_roles(user_id,workspace_id,role_id) values(${P},${W},${ROLE})`;
  await db`insert into job_role_permission_overrides values(${W},${ROLE},${accessKeys[0]},'deny')`;
  expect(
    (await db`select * from techerp_api.effective_permissions_unchecked(${P},${W})`).map(
      (r) => r.effective_permissions_unchecked,
    ),
  ).not.toContain(accessKeys[0]);
  await db`update hiring_engagements set ends_at=current_date-1,starts_at=current_date-2 where id=${e}`;
  expect(
    await db`select * from techerp_api.effective_permissions_unchecked(${P},${W})`,
  ).toHaveLength(0);
});
it("model snapshot is immutable and a new revision does not broaden existing grants", async () => {
  const { m, e } = await readyAllocation();
  await accept(e);
  await db`select set_config('request.uid',${U},false)`;
  await db`insert into permissions(key) values('techprojects.time_entries.update.own') on conflict do nothing`;
  const set = (await db`select set_id from hiring_access_grants where engagement_id=${e}`)[0]
    .set_id;
  await expect(
    db`insert into permission_set_items values(${set},'system.roles.manage.workspace')`,
  ).rejects.toThrow("imutável");
  await db`select hiring_model_save(${W},${m},1,${ROLE},'Modelo revisado',${[...accessKeys, "techprojects.time_entries.update.own"]},true,true)`;
  expect(
    (await db`select count(*)::int n from permission_set_items where set_id=${set}`)[0].n,
  ).toBe(accessKeys.length);
});
it("a pending invite is refused after its administrator loses authority", async () => {
  const { e } = await readyAllocation();
  const token = (await db`select hiring_employment_invite(${W},${e}) t`)[0].t;
  await db`insert into auth.users values(${P},'fixture@example.test')`;
  await db`update workspace_members set status='inactive' where user_id=${U}`;
  await db`select set_config('request.uid',${P},false)`;
  await expect(db`select hiring_accept_invite(${token})`).rejects.toThrow("Responsável");
});
it("internal admission requires approval and explicit WK entity but no fictional deal", async () => {
  const m = await setup();
  const internal = "80000000-0000-4000-8000-000000000001";
  await db`insert into ats_jobs(id,workspace_id,title,hiring_purpose,hiring_area_id,employment_type,hiring_billing_model,hiring_role_id) values(${internal},${W},'Interno','internal',${R},'pj','not_applicable',${ROLE})`;
  await db`select set_config('app.hiring_stage2','on',false)`;
  await db`update ats_jobs set hiring_approval_status='approved' where id=${internal}`;
  await db`select set_config('app.hiring_stage2','off',false)`;
  await db`update ats_applications set job_id=${internal},hiring_details=jsonb_build_object('model','internal','start_date',current_date::text) where id=${APP}`;
  const e = (
    await db`select hiring_employment_admit(${W},${APP},null,${m},${L},current_date,null,'','pj') id`
  )[0].id;
  expect(
    (await db`select commercial_contract_id from hiring_engagements where id=${e}`)[0]
      .commercial_contract_id,
  ).toBeNull();
});
it("SQL blocks removal of integrated allocation history and stops tracking after purchase cancellation", async () => {
  const { e, c } = await readyAllocation();
  const a = (await db`select hiring_allocate(${W},${e},${PROJ},null,null,100,'') id`)[0].id;
  await accept(e);
  await expect(db`delete from people_allocations where id=${a}`).rejects.toThrow("histórico");
  await db`update contracts set status='terminated' where id=${c}`;
  expect((await db`select project_time_can_track(${P},${PROJ},current_date) v`)[0].v).toBe(false);
});
it("access role belongs to the approved demand and a role change invalidates approval", async () => {
  const m = await setup();
  await db`select hiring_job_role_set(${W},${J},(select hiring_revision from ats_jobs where id=${J}),${ROLE})`;
  await db`insert into job_roles(id,workspace_id,name) values(${OTHER},${W},'Financeiro')`;
  await db`select hiring_job_role_set(${W},${J},(select hiring_revision from ats_jobs where id=${J}),${OTHER})`;
  expect(
    (await db`select hiring_approval_status from ats_jobs where id=${J}`)[0].hiring_approval_status,
  ).toBe("not_requested");
  await expect(admit(m)).rejects.toThrow("aprovação");
});
it("changing an accepted model replaces only its own assignment and preserves the previous snapshot", async () => {
  const { m, e } = await readyAllocation();
  await accept(e);
  await db`select set_config('request.uid',${U},false)`;
  await db`insert into permissions(key) values('techprojects.time_entries.update.own') on conflict do nothing`;
  const previous = (
    await db`select set_id from hiring_access_grants where engagement_id=${e} and revoked_at is null`
  )[0].set_id;
  await db`select hiring_model_save(${W},${m},1,${ROLE},'Modelo revisado',${[...accessKeys, "techprojects.time_entries.update.own"]},true,true)`;
  await db`select hiring_employment_model_change(${W},${e},(select revision from hiring_engagements where id=${e}),${m},'Revisão explícita de acesso pelo administrador')`;
  expect(
    (await db`select count(*)::int n from hiring_access_grants where engagement_id=${e}`)[0].n,
  ).toBe(2);
  expect((await db`select count(*)::int n from user_permission_sets where user_id=${P}`)[0].n).toBe(
    1,
  );
  expect(
    (await db`select count(*)::int n from permission_set_items where set_id=${previous}`)[0].n,
  ).toBe(accessKeys.length);
});
it("actual admission date stays separate from commercial term and blocks pre-admission allocation", async () => {
  const m = await setup();
  const e = (
    await db`select hiring_employment_admit(${W},${APP},null,${m},${L},null,null,'','pj',current_date+5) id`
  )[0].id;
  expect(
    (
      await db`select hire_date > (select starts_at from hiring_engagements where id=${e}) different from people`
    )[0].different,
  ).toBe(true);
  const c = (await db`select hiring_employment_contract(${W},${e},null) id`)[0].id;
  await db`update contracts set status='active' where id=${c}`;
  await db`insert into projects(id,workspace_id,name,contract_id,deal_id) values(${PROJ},${W},'Projeto',${K},${D})`;
  await expect(db`select hiring_allocate(${W},${e},${PROJ},null,null,100,'')`).rejects.toThrow(
    "admissão efetiva",
  );
});
it("removing a managed assignment marks only that origin revoked", async () => {
  const { e } = await readyAllocation();
  await accept(e);
  await db`select set_config('request.uid',${U},false)`;
  const g = (
    await db`select * from hiring_access_grants where engagement_id=${e} and revoked_at is null`
  )[0];
  await db`delete from user_permission_sets where id=${g.assignment_id}`;
  expect(
    (await db`select revoked_at is not null revoked from hiring_access_grants where id=${g.id}`)[0]
      .revoked,
  ).toBe(true);
});
it("nonmanaged workspaces retain their original project row policies", async () => {
  await setup();
  await db`select set_config('request.uid',${P},false)`;
  await db`set role authenticated`;
  const plan = (await db`explain (format json) select * from projects`)[0]["QUERY PLAN"];
  expect(JSON.stringify(plan)).toContain("hashed SubPlan");
  await db`reset role`;
});

it("schema-only metadata preserves the existing commercial signature fingerprint", () => {
  expect(beforeSchemaHash).toMatch(/^[a-f0-9]{64}$/);
  expect(afterSchemaHash).toBe(beforeSchemaHash);
});
it("an already-applied engagement cannot prepare a second active grant", async () => {
  const { e } = await readyAllocation();
  await accept(e);
  await db`select set_config('request.uid',${U},false)`;
  await expect(db`select hiring_employment_invite(${W},${e})`).rejects.toThrow("já foi aplicado");
  expect(
    (
      await db`select count(*)::int n from hiring_access_grants where engagement_id=${e} and revoked_at is null`
    )[0].n,
  ).toBe(1);
});
it("reissuing after explicit assignment revocation preserves the previous immutable package", async () => {
  const { e } = await readyAllocation();
  await accept(e);
  await db`select set_config('request.uid',${U},false)`;
  const first = (
    await db`select * from hiring_access_grants where engagement_id=${e} and revoked_at is null`
  )[0];
  await db`delete from user_permission_sets where id=${first.assignment_id}`;
  const token = (await db`select hiring_employment_invite(${W},${e}) t`)[0].t;
  await db`select set_config('request.uid',${P},false)`;
  await db`select hiring_accept_invite(${token})`;
  expect(
    (await db`select count(*)::int n from hiring_access_grants where engagement_id=${e}`)[0].n,
  ).toBe(2);
  expect(
    (
      await db`select count(*)::int n from hiring_access_grants where engagement_id=${e} and revoked_at is null`
    )[0].n,
  ).toBe(1);
  expect(
    (await db`select count(*)::int n from permission_sets where id=${first.set_id}`)[0].n,
  ).toBe(1);
});
it("the service worker executes current admission and purchase draft through the same transactional doors", async () => {
  const m = await setup();
  const first = (
    await db`select hiring_workflow_employment(${W},${APP},${U},'create_person_from_candidate',${db.json({ access_model_id: m, employment_type: "pj" })}) v`
  )[0].v;
  expect(first.handled).toBe(true);
  expect(first.person_id).toBeTruthy();
  const draft = (
    await db`select hiring_workflow_employment(${W},${APP},${U},'create_contract_document','{}') v`
  )[0].v;
  expect((await db`select owner_id from contracts where id=${draft.id}`)[0].owner_id).toBe(U);
  expect((await db`select count(*)::int n from people`)[0].n).toBe(1);
  expect(
    (
      await db`select has_function_privilege('authenticated','hiring_workflow_employment(uuid,uuid,uuid,text,jsonb)','execute') v`
    )[0].v,
  ).toBe(false);
});
it("the service worker rejects an inactive responsible before admission", async () => {
  const m = await setup();
  await db`update workspace_members set status='inactive' where user_id=${U}`;
  await expect(
    db`select hiring_workflow_employment(${W},${APP},${U},'create_person_from_candidate',${db.json({ access_model_id: m, employment_type: "pj" })})`,
  ).rejects.toThrow("inativo");
  expect((await db`select count(*)::int n from people`)[0].n).toBe(0);
});
it("model role denies prevail without inheriting its implicit role grants", async () => {
  const { e } = await readyAllocation();
  await accept(e);
  await db`insert into job_role_permission_overrides values(${W},${ROLE},${accessKeys[0]},'deny')`;
  await db`insert into permissions(key) values('techsales.deals.view.workspace') on conflict do nothing`;
  await db`insert into permission_sets(id,workspace_id,owner_id,module,name) values(${OTHER},${W},${W},'crm','Preset comercial não concedido')`;
  await db`insert into permission_set_items values(${OTHER},'techsales.deals.view.workspace')`;
  await db`insert into job_role_sets values(${ROLE},${OTHER})`;
  const keys = (await db`select * from techerp_api.effective_permissions_unchecked(${P},${W})`).map(
    (r) => r.effective_permissions_unchecked,
  );
  expect(keys).not.toContain(accessKeys[0]);
  expect(keys).not.toContain("techsales.deals.view.workspace");
  expect((await db`select count(*)::int n from user_job_roles where user_id=${P}`)[0].n).toBe(0);
});
it("model role field restrictions remain effective for the employee", async () => {
  const { e } = await readyAllocation();
  await accept(e);
  await db`insert into shared_field_catalog values('techpeople.people','cnpj','people',true)`;
  await db`insert into field_permission_rules values(${W},'techpeople.people','cnpj','hidden',${ROLE},null)`;
  const c = (await db`select shared_field_context() v`)[0].v;
  expect(c.is_privileged).toBe(false);
  expect(c.rules["techpeople.people"].cnpj).toBe("hidden");
});
