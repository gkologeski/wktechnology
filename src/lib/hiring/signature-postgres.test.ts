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
const container = "techerp-signature-ci-" + randomUUID();
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
  await db.unsafe(readFileSync("tests/fixtures/hiring-stage2.sql", "utf8"));
  await db.unsafe(readFileSync("tests/fixtures/hiring-stage3.sql", "utf8"));
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
}, 120000);
afterAll(async () => {
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
const FILE_HASH = "a".repeat(64);
async function reset() {
  const tables = await db`select tablename from pg_tables where schemaname='public'`;
  await db.unsafe(
    "TRUNCATE " +
      tables.map((t) => 'public."' + t.tablename + '"').join(",") +
      ",storage.objects CASCADE",
  );
  await db`insert into workspaces values(${W}),(${B})`;
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
async function access() {
  return (await db`select hiring_signature_access(${W},${K},'manage') v`)[0].v;
}
it("signature allows authorized active member", async () => {
  await reset();
  expect(await access()).toBe(true);
});
it("signature rejects missing permission", async () => {
  await reset();
  await db`delete from grants where user_id=${U} and key='techcontracts.signature_evidence.manage.workspace'`;
  expect(await access()).toBe(false);
});
it("signature rejects explicit deny", async () => {
  await reset();
  await db`insert into grants values(${U},'techcontracts.signature_evidence.manage.workspace','deny')`;
  expect(await access()).toBe(false);
});
it("signature rejects foreign workspace", async () => {
  await reset();
  await db`update profiles set active_workspace_id=${B} where id=${U}`;
  expect(await access()).toBe(false);
});
it("signature rejects inactive membership", async () => {
  await reset();
  await db`update workspace_members set status='inactive' where user_id=${U}`;
  expect(await access()).toBe(false);
});
it("won or active alone cannot start recruiting and no timestamp backfill authorizes", async () => {
  await reset();
  expect(await recruitmentReason()).toContain("Assinatura");
  await expect(
    db`insert into ats_applications(id,workspace_id,job_id) values(${A},${W},${J})`,
  ).rejects.toThrow("RECRUITMENT_BLOCKED");
});
it("external attestation enables operations and repeated evidence is idempotent", async () => {
  await reset();
  const e = await external();
  expect(await signatureReason()).toBe(null);
  expect(await recruitmentReason()).toBe(null);
  const hash = await fingerprint();
  const again =
    await db`select hiring_contract_external_attest(${W},${K},${hash},${W + "/" + K + "/fixture.pdf"},${FILE_HASH},current_date-1,'Certificado fixture','Conferência humana do documento completo e assinatura das duas partes.') v`;
  expect(again[0].v).toBe(e);
  await db`insert into ats_applications(id,workspace_id,job_id) values(${A},${W},${J})`;
});
it("unverified or altered file metadata cannot be attested", async () => {
  await reset();
  await expect(
    db`select hiring_contract_external_attest(${W},${K},${await fingerprint()},${W + "/" + K + "/missing.pdf"},${FILE_HASH},current_date-1,'Certificado','Conferência humana completa do documento assinado.')`,
  ).rejects.toThrow("PDF");
});
it("contract changes revoke current-version eligibility without deleting history", async () => {
  await reset();
  await external();
  await db`update contracts set total_value=200 where id=${K}`;
  expect(await signatureReason()).toContain("versão");
  expect((await db`select count(*)::int n from hiring_contract_evidence`)[0].n).toBe(1);
});
it("revocation expiry cancellation and wrong tenant prevent new operations", async () => {
  await reset();
  const e = await external();
  await db`select hiring_contract_evidence_revoke(${W},${e},'Documento substituído pelas partes.')`;
  expect(await signatureReason()).toContain("revogada");
  await reset();
  await external();
  await db`update contracts set ends_at=current_date-1 where id=${K}`;
  expect(await signatureReason()).toContain("expirada");
  await db`update contracts set status='terminated' where id=${K}`;
  expect(await signatureReason()).toContain("Ative");
  expect((await db`select hiring_contract_signature_reason(${K},${B},${D}) v`)[0].v).toContain(
    "mesmo workspace",
  );
});
it("internal hiring requires approval but no fictional deal or commercial contract", async () => {
  await reset();
  await db`update ats_jobs set deal_id=null,hiring_purpose='internal',hiring_billing_model='not_applicable' where id=${J}`;
  expect(await recruitmentReason()).toContain("aprovação");
  await db`select set_config('app.hiring_stage2','on',false)`;
  await db`update ats_jobs set hiring_approval_status='approved' where id=${J}`;
  await db`select set_config('app.hiring_stage2','off',false)`;
  expect(await recruitmentReason()).toBe(null);
});
it("legacy vacancy remains readable and operational without retroactive adoption", async () => {
  await reset();
  await db`update hiring_workspace_settings set enabled=false where workspace_id=${W}`;
  await db`insert into ats_jobs(id,workspace_id,title) values(${F},${W},'Histórica')`;
  await db`update hiring_workspace_settings set enabled=true where workspace_id=${W}`;
  expect((await db`select hiring_recruitment_reason(${W},${F}) v`)[0].v).toBe(null);
  await db`insert into ats_applications(id,workspace_id,job_id) values(${A},${W},${F})`;
});
it("direct writes and broad legacy storage policies cannot overwrite evidence", async () => {
  await reset();
  await external();
  await expect(
    db.begin(async (tx) => {
      await tx.unsafe("SET LOCAL ROLE authenticated");
      await tx`update hiring_contract_evidence set note='forged'`;
    }),
  ).rejects.toThrow("permission denied");
  await expect(
    db.begin(async (tx) => {
      await tx.unsafe("SET LOCAL ROLE authenticated");
      await tx`insert into storage.objects(bucket_id,name) values('contract-signature-evidence','forged.pdf')`;
    }),
  ).rejects.toThrow("row-level security");
  await db`insert into grants values(${U},'techcontracts.signature_evidence.view.workspace','deny')`;
  await db.begin(async (tx) => {
    await tx.unsafe("SET LOCAL ROLE authenticated");
    expect((await tx`select count(*)::int n from hiring_contract_evidence`)[0].n).toBe(0);
    expect(
      (
        await tx`select count(*)::int n from storage.objects where bucket_id='contract-signature-evidence'`
      )[0].n,
    ).toBe(0);
  });
});
it("native signing requires both mapped parties, completion and unchanged seal", async () => {
  await reset();
  const hash = await fingerprint();
  const doc = (
    await db`select hiring_contract_native_prepare(${W},${K},${hash},'Cliente fixture','cliente@example.test','Emissor fixture','emissor@example.test') v`
  )[0].v;
  expect(
    (
      await db`select hiring_contract_native_prepare(${W},${K},${hash},'Cliente fixture','cliente@example.test','Emissor fixture','emissor@example.test') v`
    )[0].v,
  ).toBe(doc);
  await db`select contract_esign_manage('send',${doc},'{}')`;
  const tokens =
    await db`select public_token from esign_signers where document_id=${doc} order by sign_order`;
  await db`select contract_esign_public(${tokens[0].public_token},'sign','Cliente fixture')`;
  expect(await signatureReason()).not.toBe(null);
  await db`select contract_esign_public(${tokens[1].public_token},'sign','Emissor fixture')`;
  expect(await signatureReason()).toBe(null);
  await expect(db`update esign_documents set body='forged' where id=${doc}`).rejects.toThrow(
    "vinculado",
  );
});
it("canonical pipeline type defeats stage-name heuristics", async () => {
  await reset();
  await external();
  await db`insert into pipelines values(${R},'[{"value":"won_like_name","type":"open"},{"value":"custom_success","type":"won"}]')`;
  await db`update deals set pipeline_id=${R},stage_id='won_like_name',stage='won' where id=${D}`;
  expect(await recruitmentReason()).toContain("canônica");
  await db`update deals set stage_id='custom_success',stage='open' where id=${D}`;
  expect(await recruitmentReason()).toBe(null);
});
it("revoked contracts block offers interviews and postings while cancellations remain possible", async () => {
  await reset();
  await external();
  await db`insert into ats_interviews values(${A},${W},${J},'scheduled')`;
  await db`insert into ats_job_postings values(${A},${W},${J},'published')`;
  await db`insert into ats_offers(id,workspace_id,job_id) values(${A},${W},${J})`;
  await db`update contracts set status='terminated' where id=${K}`;
  await expect(db`update ats_interviews set status='scheduled' where id=${A}`).rejects.toThrow(
    "RECRUITMENT_BLOCKED",
  );
  await expect(db`update ats_job_postings set status='published' where id=${A}`).rejects.toThrow(
    "RECRUITMENT_BLOCKED",
  );
  await expect(db`update ats_offers set status='sent' where id=${A}`).rejects.toThrow(
    "RECRUITMENT_BLOCKED",
  );
  await db`update ats_interviews set status='canceled' where id=${A}`;
  await db`update ats_job_postings set status='unpublished' where id=${A}`;
  await db`update ats_offers set status='canceled' where id=${A}`;
});
it("new commercial projects remain planning without signature and Hunting does not auto-provision project", async () => {
  await reset();
  await db`insert into projects(id,workspace_id,name,status,deal_id,contract_id) values(${F},${W},'Planejamento','planning',${D},${K})`;
  await expect(db`update projects set status='active' where id=${F}`).rejects.toThrow(
    "planejamento",
  );
  await external();
  await db`update projects set status='active' where id=${F}`;
  await db`insert into grants values(${U},'techsales.catalog.services.update.workspace','grant')`;
  await db`insert into service_catalog(id,workspace_id,name,staffing_kind) values(${A},${W},'Hunting','hunting')`;
  await db`insert into deal_line_items(id,workspace_id,deal_id,service_catalog_id,name) values(${A},${W},${D},${A},'Hunting')`;
  await db`insert into deal_delivery_policies values(${W},${U},null,true)`;
  const out = (await db`select deal_delivery_ensure_internal(${D},'manual',${U},${U},null) v`)[0].v;
  expect(out.results[0].action).toBe("skipped");
});
it("profile forwarding waits for signature, uses one requisition and rejects early override", async () => {
  await reset();
  await db`insert into service_catalog(id,workspace_id,name) values(${A},${W},'Outsourcing')`;
  await db`insert into deal_line_items(id,workspace_id,deal_id,service_catalog_id,name) values(${A},${W},${D},${A},'Outsourcing')`;
  await db`insert into ats_pipelines(id,workspace_id,is_default) values(${R},${W},true)`;
  await db`insert into deal_role_profile_versions values(${F},1)`;
  await db`insert into deal_role_profiles(id,workspace_id,deal_id,modality,approved_version_id,status,title,company_id,quantity) values(${F},${W},${D},'outsourcing',${F},'approved','Perfil',${C},1)`;
  const payload = db.json({ title: "Vaga do perfil", employment_type: "pj" });
  await expect(db`select role_profile_forward(${F},${payload},false,null)`).rejects.toThrow(
    "assinado",
  );
  await external();
  await expect(
    db`select role_profile_forward(${F},${payload},true,'Antecipado autorizado')`,
  ).rejects.toThrow("Antecipação");
  const first = (await db`select role_profile_forward(${F},${payload},false,null) v`)[0].v;
  const next = (await db`select role_profile_forward(${F},${payload},false,null) v`)[0].v;
  const concurrent = await Promise.all([
    db`select role_profile_forward(${F},${payload},false,null) v`,
    db`select role_profile_forward(${F},${payload},false,null) v`,
  ]);
  expect(concurrent.every((r) => r[0].v.ats_job_id === first.ats_job_id)).toBe(true);
  await expect(
    db`update ats_jobs set deal_id=null,hiring_purpose='internal' where id=${first.ats_job_id}`,
  ).rejects.toThrow("preservar");
  expect(next.already).toBe(true);
  expect(next.ats_job_id).toBe(first.ats_job_id);
  expect(
    (await db`select hiring_contract_id from ats_jobs where id=${first.ats_job_id}`)[0]
      .hiring_contract_id,
  ).toBe(K);
});
