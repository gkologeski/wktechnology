import { afterAll, beforeAll, expect, it } from "vitest";
import postgres from "postgres";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// Disposable SQL engine, synthetic rows only; no shared database URL is read.
const docker =
  process.platform === "darwin"
    ? "/Applications/Docker.app/Contents/Resources/bin/docker"
    : "docker";
const image = "postgres@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b";
const native = process.platform === "darwin" && process.env.TECHERP_NATIVE_PG === "1";
const pgBin = "/Applications/Postgres.app/Contents/Versions/16/bin/";
const container = "techerp-signature-execution-" + randomUUID();
const W = "aaaaaaaa-0000-4000-8000-00000000000a";
const C = "50000000-0000-4000-8000-000000000001";
const S = "60000000-0000-4000-8000-000000000001";
let temporary = "",
  endpoint = "",
  started = false,
  nativeStarted = false;
let db: ReturnType<typeof postgres>;
const dockerRun = (...args: string[]) =>
  execFileSync(docker, ["--host", endpoint, ...args], {
    encoding: "utf8",
    timeout: 90000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
function sourceFunction(file: string, name: string) {
  const source = readFileSync(file, "utf8");
  const start = source.indexOf("CREATE OR REPLACE FUNCTION public." + name + "(");
  if (start < 0) throw Error("Missing production function: " + name);
  const tail = source.slice(start),
    opening = /\bAS\s+(\$[a-z_]*\$)/i.exec(tail);
  if (!opening) throw Error("Missing SQL body: " + name);
  const end = tail.indexOf(opening[1], opening.index + opening[0].length);
  if (end < 0) throw Error("Incomplete SQL function: " + name);
  return tail.slice(0, end + opening[1].length) + ";";
}
beforeAll(async () => {
  if (native) {
    temporary = mkdtempSync(join(tmpdir(), "techerp-signature-pg-"));
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
        join(temporary, "pg.log"),
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
      max: 2,
      connect_timeout: 1,
      onnotice: () => {},
    });
  } else {
    if (process.platform === "darwin" && !existsSync(docker))
      throw Error("Docker required for SQL tests");
    endpoint = execFileSync(
      docker,
      ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"],
      { encoding: "utf8", timeout: 10000 },
    ).trim();
    if (!endpoint.startsWith("unix://")) throw Error("Only a local Docker socket is allowed");
    temporary = mkdtempSync(join(tmpdir(), "techerp-signature-pg-"));
    const password = randomUUID() + randomUUID(),
      envFile = join(temporary, "postgres.env");
    writeFileSync(envFile, "POSTGRES_DB=signature_ci\nPOSTGRES_PASSWORD=" + password + "\n", {
      mode: 0o600,
    });
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
    const binding = dockerRun("port", container, "5432/tcp");
    if (!/^127\.0\.0\.1:\d+$/.test(binding)) throw Error("Unexpected binding");
    db = postgres({
      host: "127.0.0.1",
      port: Number(binding.split(":")[1]),
      database: "signature_ci",
      username: "postgres",
      password,
      max: 2,
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
  if (!ready) throw Error("Disposable PostgreSQL did not start");
  await db.unsafe(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE ROLE techerp_request_writer;
 CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
 CREATE TABLE workspaces(id uuid PRIMARY KEY);
 CREATE TABLE legal_entities(id uuid PRIMARY KEY,workspace_id uuid,name text,cnpj text);
 CREATE TABLE companies(id uuid PRIMARY KEY,workspace_id uuid,name text,cnpj text);
 CREATE TABLE contracts(id uuid PRIMARY KEY,workspace_id uuid,role text,body_html text,title text,contracting_legal_entity_id uuid,counterparty_company_id uuid,status text,signed_at timestamptz,starts_at date,ends_at date,metadata jsonb DEFAULT '{}');
 CREATE TABLE services(id uuid PRIMARY KEY,workspace_id uuid,contract_id uuid,name text,type text,status text,unit_price numeric,quantity numeric,starts_at date,ends_at date,billing_hold text,billing_hold_schedule jsonb,next_billing_at date,metadata jsonb DEFAULT '{}');
 CREATE TABLE contract_attachments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,contract_id uuid,kind text,file_name text,source_id uuid,source_stamp text,sha256 text,created_at timestamptz DEFAULT now(),ready boolean DEFAULT true);
 INSERT INTO workspaces VALUES('${W}');
 INSERT INTO contracts(id,workspace_id,role,body_html,title,status)VALUES('${C}','${W}','provider','<p>Current clauses</p>','Synthetic contract','awaiting_signature');
 INSERT INTO services(id,workspace_id,contract_id,name,type,status,unit_price,quantity,starts_at)VALUES('${S}','${W}','${C}','Synthetic service','one_time','pending',250,18,'2026-11-26');`);
  await db.unsafe(
    sourceFunction(
      "drizzle/migrations/0378_hiring_signature_adapter.sql",
      "hiring_contract_fingerprint_without_attachments",
    ),
  );
  await db.unsafe(
    sourceFunction(
      "drizzle/migrations/0367_contract_signature_packages.sql",
      "contract_attachment_source_stamp",
    ),
  );
  await db.unsafe(
    sourceFunction(
      "drizzle/migrations/0367_contract_signature_packages.sql",
      "hiring_contract_fingerprint",
    ),
  );
  // Prime the old caller plan before the rename, proving compatibility on an existing connection.
  await db`select hiring_contract_fingerprint(${C}::uuid)`;
  await db.unsafe(
    readFileSync("drizzle/migrations/0484_service_execution_signature_integrity.sql", "utf8"),
  );
}, 90000);
afterAll(async () => {
  if (db) await db.end({ timeout: 2 });
  if (started) dockerRun("rm", "-f", "-v", container);
  if (nativeStarted)
    execFileSync(
      pgBin + "pg_ctl",
      ["-D", join(temporary, "data"), "-m", "immediate", "-w", "stop"],
      { stdio: "pipe", timeout: 30000 },
    );
  if (temporary) rmSync(temporary, { recursive: true, force: true });
});
const rollback = Symbol("synthetic rollback");
async function scenario(run: (tx: postgres.TransactionSql) => Promise<void>) {
  try {
    await db.begin(async (tx) => {
      await run(tx);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}
async function hash(tx: postgres.TransactionSql) {
  const [r] = await tx`select hiring_contract_fingerprint(${C}::uuid) as hash`;
  return r.hash as string;
}
it("signature anchor preserves an existing hash when activation only holds billing", async () =>
  scenario(async (tx) => {
    const previous = await hash(tx);
    await tx`update services set status='active',billing_hold='awaiting_signature',billing_hold_schedule='[{"amount":4500}]' where id=${S}`;
    expect(await hash(tx)).toBe(previous);
    const [a] =
      await tx`select signature_base_hash from contract_service_signature_anchors where contract_id=${C}`;
    expect(a.signature_base_hash).toBe(previous);
    const [c] = await tx`select signed_at,status from contracts where id=${C}`;
    expect(c).toMatchObject({ signed_at: null, status: "awaiting_signature" });
  }));
it("signature anchor preserves pending native and ForSign revision through completion and hold release", async () =>
  scenario(async (tx) => {
    const submitted = await hash(tx);
    await tx`update services set status='active',billing_hold='awaiting_signature' where id=${S}`;
    await tx`update services set status='completed',ends_at='2026-11-26' where id=${S}`;
    expect(await hash(tx)).toBe(submitted);
    await tx`update services set billing_hold=null,billing_hold_schedule=null where id=${S}`;
    expect(await hash(tx)).toBe(submitted);
  }));
it("signature anchor does not validate changed clauses", async () =>
  scenario(async (tx) => {
    const submitted = await hash(tx);
    await tx`update services set status='active' where id=${S}`;
    await tx`update contracts set body_html='<p>Changed clauses</p>' where id=${C}`;
    expect(await hash(tx)).not.toBe(submitted);
    await tx`update services set status='completed' where id=${S}`;
    expect(await hash(tx)).not.toBe(submitted);
  }));
it("signature anchor does not validate changed values in a mixed operational update", async () =>
  scenario(async (tx) => {
    const submitted = await hash(tx);
    await tx`update services set status='completed',unit_price=300 where id=${S}`;
    expect(await hash(tx)).not.toBe(submitted);
  }));
it("signature anchor keeps contract commercial dates in the document revision", async () =>
  scenario(async (tx) => {
    const submitted = await hash(tx);
    await tx`update services set status='active',starts_at='2026-11-20',ends_at='2026-11-25' where id=${S}`;
    expect(await hash(tx)).toBe(submitted);
    await tx`update contracts set starts_at='2026-12-01' where id=${C}`;
    expect(await hash(tx)).not.toBe(submitted);
  }));
it("signature anchor still invalidates an added changed or removed annex", async () =>
  scenario(async (tx) => {
    await tx`insert into contract_attachments(workspace_id,contract_id,kind,file_name,sha256)values(${W},${C},'file','Synthetic.pdf',${"a".repeat(64)})`;
    const submitted = await hash(tx);
    await tx`update services set status='active' where id=${S}`;
    expect(await hash(tx)).toBe(submitted);
    await tx`update contract_attachments set sha256=${"b".repeat(64)} where contract_id=${C}`;
    expect(await hash(tx)).not.toBe(submitted);
    await tx`delete from contract_attachments where contract_id=${C}`;
    expect(await hash(tx)).not.toBe(submitted);
  }));
it("signature anchor preserves existing purchase signature semantics", async () =>
  scenario(async (tx) => {
    await tx`update contracts set role='client' where id=${C}`;
    const before = await hash(tx);
    await tx`update services set status='active',billing_hold='awaiting_signature' where id=${S}`;
    expect(await hash(tx)).not.toBe(before);
    const [count] = await tx`select count(*)::int as n from contract_service_signature_anchors`;
    expect(count.n).toBe(0);
  }));
it("signature anchor does not create or rewrite business data on migration", async () =>
  scenario(async (tx) => {
    const [count] = await tx`select count(*)::int as n from contract_service_signature_anchors`;
    expect(count.n).toBe(0);
    const [row] = await tx`select status,billing_hold from services where id=${S}`;
    expect(row).toMatchObject({ status: "pending", billing_hold: null });
  }));
it("signature anchor is private to anon authenticated service and request writer", async () =>
  scenario(async (tx) => {
    const [checks] =
      await tx`select bool_and(not has_table_privilege(r,'public.contract_service_signature_anchors','SELECT') and not has_table_privilege(r,'public.contract_service_signature_anchors','INSERT') and not has_function_privilege(r,'public.hiring_contract_fingerprint_without_attachments(uuid)','EXECUTE') and not has_function_privilege(r,'public.service_execution_preserve_signature_hash()','EXECUTE')) as private from unnest(array['anon','authenticated','service_role','techerp_request_writer']) r`;
    expect(checks.private).toBe(true);
  }));

it("signature anchor does not wait on the contract lock already held by billing release", async () => {
  await scenario(async (parent) => {
    await parent`select id from contracts where id=${C} for update`;
    await scenario(async (writer) => {
      await writer`set local lock_timeout='2s'`;
      await writer`select id from services where id=${S} for update`;
      const before = await hash(writer);
      await writer`update services set status='active',billing_hold='awaiting_signature' where id=${S}`;
      expect(await hash(writer)).toBe(before);
    });
  });
});
it("signature anchor cleans its private cache when the parent is deleted", async () =>
  scenario(async (tx) => {
    await tx`update services set status='active' where id=${S}`;
    expect(
      await tx`select contract_id from contract_service_signature_anchors where contract_id=${C}`,
    ).toHaveLength(1);
    await tx`delete from services where contract_id=${C}`;
    await tx`delete from contracts where id=${C}`;
    expect(
      await tx`select contract_id from contract_service_signature_anchors where contract_id=${C}`,
    ).toHaveLength(0);
  }));
