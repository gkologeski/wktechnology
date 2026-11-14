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
const native = process.platform === "darwin" && process.env.TECHERP_NATIVE_PG === "1";
const pgBin = "/Applications/Postgres.app/Contents/Versions/16/bin/";
let nativeStarted = false;
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
  if (native) {
    temporary = mkdtempSync(join(tmpdir(), "techerp-journey-pg-"));
    execFileSync(
      pgBin + "initdb",
      [
        "-D",
        join(temporary, "data"),
        "-U",
        "postgres",
        "--auth-local=trust",
        "--auth-host=reject",
        "--no-locale",
        "--encoding=UTF8",
      ],
      { stdio: "pipe", timeout: 30000 },
    );
    execFileSync(
      pgBin + "pg_ctl",
      [
        "-D",
        join(temporary, "data"),
        "-l",
        join(temporary, "postgres.log"),
        "-o",
        "-k " + temporary + " -h '' -F",
        "-w",
        "start",
      ],
      { stdio: "pipe", timeout: 30000 },
    );
    nativeStarted = true;
    db = postgres({
      host: temporary,
      port: 5432,
      database: "postgres",
      username: "postgres",
      max: 1,
      connect_timeout: 1,
      onnotice: () => {},
    });
  } else {
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
  }
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
  await db.unsafe(
    "CREATE OR REPLACE FUNCTION work_area_authorize(r text,a text,i uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql AS $$ DECLARE w uuid;k text;BEGIN SELECT active_workspace_id INTO w FROM profiles WHERE id=auth.uid();k:=CASE WHEN r='techcontracts.esign' AND a IN('send','cancel','share') THEN r||'_'||a||'.manage.workspace' ELSE r||'.'||a||'.workspace' END;IF NOT is_workspace_member(w,auth.uid()) OR NOT user_has_permission(auth.uid(),w,k) THEN RAISE EXCEPTION 'not allowed';END IF;RETURN w;END $$",
  );
  await db.unsafe(readFileSync("drizzle/migrations/0357_contract_signature_delivery.sql", "utf8"));
}, 120000);
afterAll(async () => {
  if (db) await db.end();
  if (started) dockerRun("rm", "-f", container);
  if (nativeStarted)
    execFileSync(pgBin + "pg_ctl", ["-D", join(temporary, "data"), "-m", "fast", "-w", "stop"], {
      stdio: "pipe",
      timeout: 15000,
    });
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
      "techcontracts.esign.view.workspace",
      "techcontracts.esign_send.manage.workspace",
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

async function invitation() {
  const hash = await fingerprint();
  const doc = (
    await db`select hiring_contract_native_prepare(${W},${K},${hash},'Cliente fixture','cliente@example.test','Emissor fixture','emissor@example.test') v`
  )[0].v;
  return { hash, doc, request: randomUUID() };
}
async function claim(i: Awaited<ReturnType<typeof invitation>>) {
  return (await db`select contract_esign_request(${K},${i.hash},${i.doc},${i.request}) v`)[0].v;
}
it("contract invitation allows authorized active member", async () => {
  await reset();
  const i = await invitation();
  const r = await claim(i);
  expect(r.workspace_id).toBe(W);
  expect(r.deliveries).toHaveLength(2);
  expect(JSON.stringify(r)).not.toMatch(/public_token|example.test/);
  expect((await db`select status::text from esign_documents where id=${i.doc}`)[0].status).toBe(
    "sent",
  );
});
it("contract invitation rejects missing permission", async () => {
  await reset();
  const i = await invitation();
  await db`delete from grants where user_id=${U} and key='techcontracts.esign_send.manage.workspace'`;
  await expect(claim(i)).rejects.toThrow();
});
it("contract invitation rejects explicit deny", async () => {
  await reset();
  const i = await invitation();
  await db`insert into grants values(${U},'techcontracts.esign_send.manage.workspace','deny')`;
  await expect(claim(i)).rejects.toThrow();
});
it("contract invitation rejects foreign workspace", async () => {
  await reset();
  const i = await invitation();
  await db`update profiles set active_workspace_id=${B} where id=${U}`;
  await expect(claim(i)).rejects.toThrow();
});
it("contract invitation rejects inactive member", async () => {
  await reset();
  const i = await invitation();
  await db`update workspace_members set status='inactive' where user_id=${U}`;
  await expect(claim(i)).rejects.toThrow();
});
it("contract invitation deduplicates a repeated request and rate-limits a new one", async () => {
  await reset();
  const i = await invitation();
  const a = await claim(i),
    b = await claim(i);
  expect(b.deliveries).toEqual(a.deliveries);
  expect((await db`select count(*)::int n from contract_esign_deliveries`)[0].n).toBe(2);
  await expect(claim({ ...i, request: randomUUID() })).rejects.toThrow("60 segundos");
});
it("contract invitation rejects a changed contract version", async () => {
  await reset();
  const i = await invitation();
  await db`update contracts set body_html='Nova versão das cláusulas que precisa de outra assinatura' where id=${K}`;
  await expect(claim(i)).rejects.toThrow("versão atual");
});
it("contract invitation never resends to an already signed party", async () => {
  await reset();
  const i = await invitation();
  await claim(i);
  const token = (
    await db`select public_token from esign_signers where document_id=${i.doc} order by sign_order limit 1`
  )[0].public_token;
  await db`select contract_esign_public(${token},'sign','Cliente fixture')`;
  const again = await claim(i);
  expect(again.deliveries).toHaveLength(1);
});
it("contract invitation delivery result cannot be forged by an authenticated client", async () => {
  await reset();
  const i = await invitation();
  await claim(i);
  await expect(
    db.begin(async (tx) => {
      await tx.unsafe("SET LOCAL ROLE authenticated");
      await tx`update contract_esign_deliveries set status='accepted'`;
    }),
  ).rejects.toThrow("permission denied");
});
it("contract invitation rejects a read-only session", async () => {
  await reset();
  const i = await invitation();
  await expect(
    db.begin(async (tx) => {
      await tx.unsafe(
        "CREATE OR REPLACE FUNCTION is_read_only_view() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$",
      );
      await tx`select contract_esign_request(${K},${i.hash},${i.doc},${i.request})`;
    }),
  ).rejects.toThrow();
});

it("contract invitation requires read access even when send is granted", async () => {
  await reset();
  const i = await invitation();
  await db`insert into grants values(${U},'techcontracts.esign.view.workspace','deny')`;
  await expect(claim(i)).rejects.toThrow();
});
