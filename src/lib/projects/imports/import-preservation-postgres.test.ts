import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import postgres from "postgres";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import {
  initialCollectCursor,
  mergeClickUpTaskObservation,
} from "@/lib/integrations/clickup/clickup-collection";

// Mandatory real SQL/RLS, no configured connection URL, local disposable PostgreSQL only.
// Effective-key/actor context is a fixture; this suite is not a GoTrue real-JWT claim.
const docker =
  process.platform === "darwin"
    ? "/Applications/Docker.app/Contents/Resources/bin/docker"
    : "docker";
const image = "postgres@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b";
const container = "techerp-import-preservation-ci-" + randomUUID();
const W = "aaaaaaaa-0000-4000-8000-00000000000a",
  B = "aaaaaaaa-0000-4000-8000-00000000000b";
const U = "10000000-0000-4000-8000-000000000002",
  V = "10000000-0000-4000-8000-000000000003";
const CK = "20000000-0000-4000-8000-000000000001",
  JB = "20000000-0000-4000-8000-000000000002",
  CU = "20000000-0000-4000-8000-000000000003";
const project = "30000000-0000-4000-8000-000000000001",
  foreignProject = "30000000-0000-4000-8000-000000000002";
const providers = ["clockify", "jibble", "clickup"] as const;
type Provider = (typeof providers)[number];
const source = (p: Provider) =>
  p === "clockify" ? "aaaaaaaaaaaaaaaaaaaaaaaa" : p === "jibble" ? "jibble-org" : "11";
const run = (p: Provider) => (p === "clockify" ? CK : p === "jibble" ? JB : CU);
const key = (p: Provider, action: "view" | "manage") =>
  `techprojects.${p}_import.${action}.workspace`;
const legacyWorkspace = "aaaaaaaa-0000-4000-8000-0000000000cc",
  unconfiguredWorkspace = "aaaaaaaa-0000-4000-8000-0000000000dd";
let migratedConnections: { workspace_id: string; legacy_key: boolean }[] = [];
let endpoint = "",
  temporary = "",
  started = false;
let db: ReturnType<typeof postgres>, competitor: ReturnType<typeof postgres>;
const dockerRun = (...args: string[]) =>
  execFileSync(docker, ["--host", endpoint, ...args], {
    encoding: "utf8",
    timeout: 90000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
function sourceFunction(file: string, name: string) {
  const source = readFileSync(file, "utf8"),
    start = source.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  if (start < 0) throw new Error(`Missing production SQL function ${name}`);
  const tail = source.slice(start),
    opening = /\bAS\s+(\$[a-z_]*\$)/i.exec(tail);
  if (!opening) throw new Error(`Missing SQL body ${name}`);
  const end = tail.indexOf(opening[1], opening.index + opening[0].length);
  if (end < 0) throw new Error(`Incomplete SQL body ${name}`);
  return tail.slice(0, end + opening[1].length) + ";";
}
beforeAll(async () => {
  if (process.platform === "darwin" && !existsSync(docker))
    throw new Error("Docker Desktop is required for import preservation SQL tests.");
  endpoint = execFileSync(
    docker,
    ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"],
    { encoding: "utf8", timeout: 10000 },
  ).trim();
  if (!endpoint.startsWith("unix://"))
    throw new Error("Only a local Docker Unix socket is allowed.");
  temporary = mkdtempSync(join(tmpdir(), "techerp-import-ci-"));
  const password = randomUUID() + randomUUID(),
    envFile = join(temporary, "postgres.env");
  writeFileSync(envFile, `POSTGRES_DB=techerp_import_ci\nPOSTGRES_PASSWORD=${password}\n`, {
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
  const mapped = dockerRun("port", container, "5432/tcp");
  if (!/^127\.0\.0\.1:\d+$/.test(mapped)) throw new Error("Unexpected disposable PostgreSQL port.");
  const config = {
    host: "127.0.0.1",
    port: Number(mapped.split(":")[1]),
    database: "techerp_import_ci",
    username: "postgres",
    password,
    max: 1,
    connect_timeout: 1,
    onnotice: () => {},
  };
  db = postgres(config);
  competitor = postgres(config);
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await db`select 1`;
      ready = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  if (!ready) throw new Error("Disposable PostgreSQL did not become ready.");
  await db.unsafe(readFileSync("tests/fixtures/import-preservation.sql", "utf8"));
  // Match the production Supabase defaults: migrations must explicitly remove
  // inherited mutation/TRUNCATE privileges, even when RLS already filters rows.
  await db.unsafe(
    "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role",
  );
  for (const name of ["clickup_import_access", "clickup_import_require"])
    await db.unsafe(sourceFunction("drizzle/migrations/0267_clickup_importer.sql", name));
  await db.unsafe(readFileSync("drizzle/migrations/0479_project_import_preservation.sql", "utf8"));
  const legacyRun = randomUUID();
  await db`insert into workspaces values(${legacyWorkspace}),(${unconfiguredWorkspace})`;
  await db`insert into clickup_import_runs(id,workspace_id,requested_by,status,applied_at) values(${legacyRun},${legacyWorkspace},${U},'applied',now())`;
  await db`insert into clickup_import_links values(${legacyWorkspace},'task','previous-task',${randomUUID()},${legacyRun})`;
  for (const file of [
    "0480_clickup_full_history_collection.sql",
    "0481_jibble_source_screenshots.sql",
    "0482_project_import_evidence_pages.sql",
  ])
    await db.unsafe(readFileSync(`drizzle/migrations/${file}`, "utf8"));
  migratedConnections = await db`select workspace_id,legacy_key from clickup_import_connections`;
}, 120000);
afterAll(async () => {
  if (competitor) await competitor.end();
  if (db) await db.end();
  if (started) dockerRun("rm", "-f", "-v", container);
  if (temporary) rmSync(temporary, { recursive: true, force: true });
});

async function seed() {
  await db`truncate project_import_records,project_import_journeys,clockify_import_runs,time_import_runs,clickup_import_runs,clockify_staging_records,time_import_staging,clickup_import_tasks,clickup_import_groups,clickup_import_people,clickup_import_links,clockify_mappings,time_import_mappings,time_import_connections,clickup_import_source_bindings,workspace_members,grants,profiles,auth.users,projects,people,project_time_entries,financial_entries,storage.objects,workspaces cascade`;
  await db`insert into workspaces values(${W}),(${B})`;
  await db`insert into profiles values(${U},${W},'Importer'),(${V},${B},'Foreign member')`;
  await db`insert into workspace_members values(${W},${U},'active','admin'),(${B},${V},'active','admin')`;
  for (const provider of providers)
    for (const action of ["view", "manage"] as const)
      await db`insert into grants values(${U},${W},${key(provider, action)},'grant'),(${V},${B},${key(provider, action)},'grant')`;
  await db`insert into auth.users values(${U},'importer@example.test'),(${V},'foreign@example.test')`;
  await db`insert into projects values(${project},${W},'Authorized project',true),(${foreignProject},${B},'Foreign project',true)`;
  await db`insert into clockify_import_runs(id,workspace_id,source_workspace_id,requested_by,delegation_authorized_by) values(${CK},${W},${source("clockify")},${U},null)`;
  await db`insert into time_import_runs(id,workspace_id,provider,source_org_id,requested_by,delegation_authorized_by) values(${JB},${W},'jibble',${source("jibble")},${U},null)`;
  await db`insert into time_import_connections values(${W},'jibble',${source("jibble")},'fixture-cipher',now(),'owner')`;
  await db`insert into clickup_import_runs(id,workspace_id,requested_by,source_team_ids) values(${CU},${W},${U},array['11'])`;
  await db`insert into clickup_import_source_bindings values(${W},'11','Authorized organization',${U},now())`;
  await db`insert into project_time_entries values(${randomUUID()},${W},'locked_import',60)`;
  await db`insert into financial_entries values(${randomUUID()},${W},100)`;
}
beforeEach(seed);
it("Clockify staging accepts time-off requests while rejecting arbitrary entity types", async () => {
  await db`insert into clockify_staging_records(workspace_id,source_workspace_id,entity_type,external_id,payload,last_run_id,status) values(${W},${source("clockify")},'time_off_request','ffffffffffffffffffffffff','{"id":"ffffffffffffffffffffffff"}',${CK},'staged')`;
  expect(
    (
      await db`select entity_type from clockify_staging_records where external_id='ffffffffffffffffffffffff'`
    )[0],
  ).toEqual({ entity_type: "time_off_request" });
  await expect(
    db`insert into clockify_staging_records(workspace_id,source_workspace_id,entity_type,external_id,payload,last_run_id,status) values(${W},${source("clockify")},'arbitrary_entity','eeeeeeeeeeeeeeeeeeeeeeee','{}',${CK},'staged')`,
  ).rejects.toThrow(/clockify_staging_records_entity_type_check/);
  expect((await db`select count(*)::integer count from clockify_staging_records`)[0].count).toBe(1);
});
async function actor<T>(
  fn: (tx: postgres.TransactionSql) => Promise<T>,
  options: {
    user?: string;
    service?: boolean;
    readonly?: boolean;
    connection?: ReturnType<typeof postgres>;
  } = {},
) {
  return (options.connection ?? db).begin(async (tx) => {
    const user = options.service ? "" : (options.user ?? U);
    await tx`select set_config('request.uid',${user},true),set_config('request.jwt.claim.sub',${user},true),set_config('request.role',${options.service ? "service_role" : "authenticated"},true),set_config('request.readonly',${String(options.readonly ?? false)},true)`;
    await tx.unsafe(`SET LOCAL ROLE ${options.service ? "service_role" : "authenticated"}`);
    return fn(tx);
  });
}
function record(
  id = "entry-1",
  payload: postgres.JSONValue = { name: "Original record", seconds: -60 },
  status = "pending",
  issues = ["negative_duration"],
) {
  return {
    entity: "time_entry",
    external_id: id,
    payload,
    payload_hash: createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
    status,
    issues,
  };
}
async function preserve(
  provider: Provider = "clockify",
  records = [record()],
  options: Parameters<typeof actor>[1] = {},
) {
  return actor(
    async (tx) =>
      (
        await tx`select project_import_preserve_records(${W},${provider},${source(provider)},${run(provider)},${tx.json(records)}) value`
      )[0]!.value,
    options,
  );
}
async function visible(provider: Provider = "clockify", user = U) {
  return actor(
    (tx) =>
      tx`select id,payload,status,version_count from project_import_records where provider=${provider}`,
    { user },
  );
}

async function reviewRecord(
  id: string,
  note: string,
  action = "review",
  target: string | null = null,
  targetType: string | null = null,
  assignee: string | null = null,
  version?: string,
) {
  const current =
    version ??
    (
      await db`select v.id from project_import_record_versions v join project_import_records r on r.id=v.record_id and r.current_version_number=v.version_number where r.id=${id}`
    )[0]!.id;
  return actor(
    (tx) =>
      tx`select project_import_record_review(${W},${id},${note},${action},${target},${targetType},${assignee},${current})`,
  );
}

it("import preservation SQL permits an active authorized actor for all providers", async () => {
  for (const provider of providers) {
    expect(await preserve(provider)).toBe(1);
    expect(await visible(provider)).toHaveLength(1);
  }
});
it("import preservation SQL denies a missing permission before preserving source data", async () => {
  for (const provider of providers) {
    await preserve(provider);
    await db`delete from grants where user_id=${U} and workspace_id=${W} and key like ${`techprojects.${provider}_import.%`}`;
    await expect(preserve(provider)).rejects.toThrow(/permissão/);
    expect(await visible(provider)).toEqual([]);
  }
});
it("import preservation SQL explicit deny wins over an existing grant", async () => {
  for (const provider of providers) {
    await preserve(provider);
    await db`insert into grants values(${U},${W},${key(provider, "manage")},'deny'),(${U},${W},${key(provider, "view")},'deny')`;
    await expect(preserve(provider)).rejects.toThrow(/permissão/);
    expect(await visible(provider)).toEqual([]);
  }
});
it("import preservation SQL isolates another workspace even with matching permission keys", async () => {
  for (const provider of providers) {
    await preserve(provider);
    await expect(preserve(provider, [record()], { user: V })).rejects.toThrow(/permissão/);
    expect(await visible(provider, V)).toEqual([]);
  }
});
it("import preservation SQL denies inactive membership and retains historical records", async () => {
  for (const provider of providers) await preserve(provider);
  await db`update workspace_members set status='inactive' where workspace_id=${W} and user_id=${U}`;
  for (const provider of providers) {
    await expect(preserve(provider)).rejects.toThrow(/permissão/);
    expect(await visible(provider)).toEqual([]);
  }
  expect((await db`select count(*)::int n from project_import_records`)[0]!.n).toBe(3);
});
it("source evidence is immutable to authenticated direct writes and keeps all error values", async () => {
  await preserve();
  await expect(
    actor((tx) => tx`update project_import_record_versions set payload='{}'`),
  ).rejects.toThrow(/permission denied/);
  await expect(actor((tx) => tx`delete from project_import_records`)).rejects.toThrow(
    /permission denied/,
  );
  const original = (await visible())[0]!;
  expect(original.payload).toEqual({ name: "Original record", seconds: -60 });
  expect(original.status).toBe("pending");
  expect((await db`select status,duration_minutes from project_time_entries`)[0]).toEqual({
    status: "locked_import",
    duration_minutes: 60,
  });
  expect((await db`select amount from financial_entries`)[0]!.amount).toBe("100");
});
it("reimporting the same source id does not duplicate records or versions", async () => {
  await preserve();
  await preserve();
  expect((await db`select count(*)::int n from project_import_records`)[0]!.n).toBe(1);
  expect((await db`select count(*)::int n from project_import_record_versions`)[0]!.n).toBe(1);
  expect((await db`select count(*)::int n from project_import_record_receipts`)[0]!.n).toBe(1);
});
it("a changed source creates a new version and never replaces the previous evidence", async () => {
  await preserve();
  await preserve("clockify", [
    record("entry-1", { name: "Corrected in source", seconds: 60 }, "received", []),
  ]);
  const versions =
    await db`select version_number,payload from project_import_record_versions order by version_number`;
  expect(versions.map((v) => v.payload.seconds)).toEqual([-60, 60]);
  expect((await visible())[0]).toMatchObject({ status: "pending", version_count: 2 });
  expect((await db`select issues from project_import_records`)[0]!.issues).toContain(
    "source_changed",
  );
});
it("service preservation derives an active native run owner and refuses foreign run or source", async () => {
  expect(await preserve("clockify", [record()], { service: true })).toBe(1);
  await expect(
    actor(
      (tx) =>
        tx`select project_import_preserve_records(${W},'clockify','forged-source',${CK},${tx.json([record()])})`,
      { service: true },
    ),
  ).rejects.toThrow(/permissão/);
  await expect(
    actor(
      (tx) =>
        tx`select project_import_preserve_records(${B},'clockify',${source("clockify")},${CK},${tx.json([record()])})`,
      { service: true },
    ),
  ).rejects.toThrow(/permissão/);
  await db`update workspace_members set status='inactive' where user_id=${U}`;
  await expect(preserve("clockify", [record()], { service: true })).rejects.toThrow(/permissão/);
});
it("SQL sanitizes credentials and temporary URL capabilities even through direct RPC", async () => {
  await preserve("clockify", [
    record("secret-example", {
      name: "Document",
      authorization: "not-history",
      nested: { client_secret: "private" },
      content: "[Arquivo](https://attachments.clickup.com/file.pdf?token=capability)",
    }),
  ]);
  const payload = (await visible())[0]!.payload;
  expect(payload).not.toHaveProperty("authorization");
  expect(payload.nested).not.toHaveProperty("client_secret");
  expect(JSON.stringify(payload)).not.toContain("capability");
  expect(payload.content).toContain("file.pdf");
});
it("status synchronization preserves originals and cannot turn source errors into approved hours", async () => {
  await preserve();
  await db`insert into clockify_staging_records(workspace_id,source_workspace_id,entity_type,external_id,payload,last_run_id,status,reason_code) values(${W},${source("clockify")},'time_entry','entry-1','{}',${CK},'imported',null)`;
  expect((await visible())[0]).toMatchObject({ status: "pending", payload: { seconds: -60 } });
  expect((await db`select count(*)::int n from project_import_record_versions`)[0]!.n).toBe(1);
});
it("receipt metrics count unique records and never add existing rows twice", async () => {
  await preserve("clockify", [
    record("pending"),
    record(
      "ready",
      {
        name: "Ready",
        timeInterval: { start: "2026-01-01T10:00:00Z", end: "2026-01-01T11:00:00Z" },
      },
      "ready",
      [],
    ),
    record(
      "received",
      {
        name: "Unclassified",
        timeInterval: { start: "2026-01-01T10:00:00Z", end: "2026-01-01T11:00:00Z" },
      },
      "received",
      [],
    ),
  ]);
  await preserve("clockify", [
    record(
      "ready",
      {
        name: "Ready",
        timeInterval: { start: "2026-01-01T10:00:00Z", end: "2026-01-01T11:00:00Z" },
      },
      "ready",
      [],
    ),
  ]);
  const count = await actor(
    async (tx) =>
      (await tx`select project_import_record_counts(${W},'clockify',${CK}) value`)[0]!.value,
  );
  expect(count).toEqual({ received: 3, ready: 1, pending: 1, unclassified: 1 });
});
it("legacy adoption preserves Clockify Jibble and ClickUp snapshots with resumable batches", async () => {
  await db`insert into clockify_staging_records(workspace_id,source_workspace_id,entity_type,external_id,payload,last_run_id,status,reason_code) values(${W},${source("clockify")},'time_entry','legacy-c','{"seconds":0}',${CK},'skipped','zero_duration')`;
  await db`insert into time_import_staging(workspace_id,provider,source_org_id,entity_type,external_id,payload,last_run_id,status,reason_code) values(${W},'jibble','jibble-org','time_entry','legacy-j','{"missing":"exit"}',${JB},'pending_review','missing_exit')`;
  await db`insert into clickup_import_groups(run_id,workspace_id,team_id,list_ext_id) values(${CU},${W},'11','22')`;
  await db`insert into clickup_import_tasks values(${CU},${W},'legacy-u','22',null,'{"title":"Normalized historical snapshot"}')`;
  for (const provider of providers) {
    const page = await actor(
      async (tx) =>
        (
          await tx`select project_import_preserve_legacy_step(${W},${provider},null,1,null) value`
        )[0]!.value,
    );
    expect(page.count).toBe(1);
    expect(page.done).toBe(false);
    const end = await actor(
      async (tx) =>
        (
          await tx`select project_import_preserve_legacy_step(${W},${provider},${page.cursor},1,null) value`
        )[0]!.value,
    );
    expect(end.done).toBe(true);
    expect((await visible(provider))[0]!.status).toBe("pending");
  }
  expect((await db`select count(*)::int n from project_import_records`)[0]!.n).toBe(3);
});
it("review requires a reason and cannot alter the original or link a foreign project", async () => {
  await preserve();
  const id = (await visible())[0]!.id;
  await expect(reviewRecord(id, "short")).rejects.toThrow(/motivo/);
  await expect(
    reviewRecord(id, "Confirmed fixture link", "link", foreignProject, "project"),
  ).rejects.toThrow(/indisponível/);
  await reviewRecord(id, "Conferir erro na origem");
  expect((await db`select count(*)::int n from project_import_record_events`)[0]!.n).toBe(1);
  expect((await visible())[0]!.payload.seconds).toBe(-60);
});
it("journey leases serialize workers and revoked authorization blocks service checkpoints", async () => {
  const begun = await actor(
    async (tx) =>
      (
        await tx`select project_import_journey_begin(${W},'clockify',${source("clockify")},'Clockify fixture') value`
      )[0]!.value,
  );
  const requests = [db, competitor].map((connection) =>
    actor(
      async (tx) =>
        (await tx`select project_import_journey_claim(${W},${begun.id}) value`)[0]!.value,
      { connection },
    ),
  );
  const claims = await Promise.all(requests);
  expect(claims.filter(Boolean)).toHaveLength(1);
  const lease = claims.find(Boolean)!;
  await expect(
    actor(
      (tx) =>
        tx`select project_import_journey_checkpoint(${W},${begun.id},${lease.lease_token},'{}')`,
    ),
  ).rejects.toThrow(/permission denied/);
  await db`insert into grants values(${U},${W},${key("clockify", "manage")},'deny')`;
  await expect(
    actor(
      (tx) =>
        tx`select project_import_journey_checkpoint(${W},${begun.id},${lease.lease_token},'{}')`,
      { service: true },
    ),
  ).rejects.toThrow(/revogada/);
});
it("ClickUp checkpoint is service-only scoped and rejects obsolete revisions", async () => {
  const cursor = initialCollectCursor([{ id: "11", name: "Authorized" }]);
  await expect(
    actor((tx) => tx`select clickup_import_checkpoint(${U},${CU},0,${tx.json(cursor)},null)`),
  ).rejects.toThrow(/permission denied/);
  expect(
    await actor(
      async (tx) =>
        (
          await tx`select clickup_import_checkpoint(${U},${CU},0,${tx.json(cursor)},null) revision`
        )[0]!.revision,
      { service: true },
    ),
  ).toBe(1);
  await expect(
    actor((tx) => tx`select clickup_import_checkpoint(${U},${CU},0,${tx.json(cursor)},null)`, {
      service: true,
    }),
  ).rejects.toThrow(/outra janela/);
  await expect(actor((tx) => tx`select clickup_import_finish_collect(${CU},'{}')`)).rejects.toThrow(
    /incompleta/,
  );
  const bad = { ...cursor, teams: [{ id: "99", name: "Not bound" }] };
  await expect(
    actor((tx) => tx`select clickup_import_checkpoint(${U},${CU},1,${tx.json(bad)},null)`, {
      service: true,
    }),
  ).rejects.toThrow(/não estão autorizadas/);
});
it("read-only view cannot start preserve review or advance ClickUp source collection", async () => {
  for (const provider of providers)
    await expect(preserve(provider, [record()], { readonly: true })).rejects.toThrow(/permissão/);
  expect(
    await actor(
      async (tx) =>
        (await tx`select clickup_import_access(${W},${U},'manage') allowed`)[0]!.allowed,
      { readonly: true },
    ),
  ).toBe(false);
  await expect(
    actor((tx) => tx`select clickup_import_sources_set(${W},'[{"id":"11","name":"Bound"}]')`, {
      readonly: true,
    }),
  ).rejects.toThrow(/permissão/);
});
it("ClickUp file manifests and private downloads stay inside the authorized source workspace", async () => {
  await expect(
    actor((tx) => tx`select clickup_import_file_authorize(${W},'11',${CU})`),
  ).rejects.toThrow(/permission denied/);
  await expect(
    actor((tx) => tx`select clickup_import_file_authorize(${W},'99',${CU})`, { service: true }),
  ).rejects.toThrow(/permissão|autorizadas/);
  const sha = "a".repeat(64),
    path = `${W}/11/${sha}`;
  await actor(
    (tx) =>
      tx`insert into clickup_source_files(workspace_id,run_id,team_id,attachment_id,file_key,title,sha256,storage_path,bytes,content_type,status) values(${W},${CU},'11','file-id',${sha},'file.pdf',${sha},${path},3,'application/pdf','preserved')`,
    { service: true },
  );
  await db`insert into storage.objects(bucket_id,name) values('clickup-source-files',${path})`;
  expect(await actor((tx) => tx`select * from clickup_source_files`)).toHaveLength(1);
  expect(await actor((tx) => tx`select * from storage.objects`)).toHaveLength(1);
  expect(await actor((tx) => tx`select * from clickup_source_files`, { user: V })).toHaveLength(0);
  expect(await actor((tx) => tx`select * from storage.objects`, { user: V })).toHaveLength(0);
});
it("Jibble private screenshot storage follows the same native owner and permission boundary", async () => {
  const cases = "tests/fixtures/jibble-source-files-cases.sql";
  if (!existsSync(cases))
    throw new Error("Missing mandatory Jibble screenshot SQL acceptance cases.");
  await db.unsafe(readFileSync(cases, "utf8"));
  expect(
    (await db`select public from storage.buckets where id='time-source-files'`)[0]!.public,
  ).toBe(false);
});
it("confirmed project links are persisted to each native import mapping atomically", async () => {
  for (const provider of providers) {
    const ext =
      provider === "clockify"
        ? "bbbbbbbbbbbbbbbbbbbbbbbb"
        : provider === "jibble"
          ? randomUUID()
          : "22";
    if (provider === "clockify")
      await db`insert into clockify_staging_records(workspace_id,source_workspace_id,entity_type,external_id,payload,last_run_id,status) values(${W},${source(provider)},'project',${ext},'{}',${CK},'staged')`;
    if (provider === "jibble")
      await db`insert into time_import_staging(workspace_id,provider,source_org_id,entity_type,external_id,payload,last_run_id,status) values(${W},'jibble',${source(provider)},'project',${ext},'{}',${JB},'staged')`;
    await preserve(provider, [
      {
        ...record(ext, { id: ext, name: "Source project" }, "received", []),
        entity: provider === "clickup" ? "list" : "project",
      },
    ]);
    const id = (await visible(provider))[0]!.id;
    await reviewRecord(id, "Confirmed project from official source", "link", project, "project");
    const target =
      provider === "clockify"
        ? (await db`select target_id target from clockify_mappings`)[0]!.target
        : provider === "jibble"
          ? (await db`select target_id target from time_import_mappings`)[0]!.target
          : (await db`select target_project_id target from clickup_import_list_targets`)[0]!.target;
    expect(target).toBe(project);
    expect((await visible(provider))[0]!.payload).toMatchObject({ id: ext });
    expect((await visible(provider))[0]!.status).toBe("pending");
  }
  expect((await db`select count(*)::int n from project_import_record_events`)[0]!.n).toBe(3);
});
it("historical person links never activate a member or create new permissions", async () => {
  const historical = "10000000-0000-4000-8000-000000000099";
  await db`insert into workspace_members values(${W},${historical},'inactive','member')`;
  for (const provider of providers) {
    const ext =
      provider === "clockify"
        ? "cccccccccccccccccccccccc"
        : provider === "jibble"
          ? randomUUID()
          : "99";
    const entity = provider === "clockify" ? "user" : "person";
    if (provider === "clockify")
      await db`insert into clockify_staging_records(workspace_id,source_workspace_id,entity_type,external_id,payload,last_run_id,status) values(${W},${source(provider)},'user',${ext},'{}',${CK},'staged')`;
    if (provider === "jibble")
      await db`insert into time_import_staging(workspace_id,provider,source_org_id,entity_type,external_id,payload,last_run_id,status) values(${W},'jibble',${source(provider)},'person',${ext},'{}',${JB},'staged')`;
    await preserve(provider, [
      {
        ...record(ext, { id: ext, name: "Historical person" }, "pending", ["missing_person_link"]),
        entity,
      },
    ]);
    const id = (await visible(provider))[0]!.id;
    await reviewRecord(
      id,
      "Historical identity explicitly confirmed",
      "link",
      historical,
      "member",
    );
  }
  expect(
    (await db`select status,role from workspace_members where user_id=${historical}`)[0],
  ).toEqual({ status: "inactive", role: "member" });
  expect((await db`select count(*)::int n from grants where user_id=${historical}`)[0]!.n).toBe(0);
  expect(
    (await db`select user_id from clickup_import_people where clickup_user_id=99`)[0]!.user_id,
  ).toBe(historical);
});
it("source search pages preserve RLS and literal search while allowing search by person name", async () => {
  await preserve("clockify", [
    { ...record("person1", { name: "Historical Person" }, "received", []), entity: "user" },
    {
      ...record("work1", { name: "Development" }, "pending", ["missing_exit"]),
      source_person_id: "person1",
    },
  ] as ReturnType<typeof record>[]);
  const found = await actor(
    async (tx) =>
      (
        await tx`select project_import_records_page(${W},'clockify',null,'Historical Person',0) value`
      )[0]!.value,
  );
  expect(found.total).toBe(2);
  const literal = await actor(
    async (tx) =>
      (await tx`select project_import_records_page(${W},'clockify',null,'%',0) value`)[0]!.value,
  );
  expect(literal.total).toBe(0);
  const hidden = await actor(
    async (tx) =>
      (await tx`select project_import_records_page(${W},null,null,'',0) value`)[0]!.value,
    { user: V },
  );
  expect(hidden).toEqual({ total: 0, rows: [] });
});
it("ClickUp completion with unavailable content stays explicitly partial", async () => {
  const cursor = {
    ...initialCollectCursor([{ id: "11", name: "Authorized" }]),
    phase: "done",
    gaps: [
      { entity: "attachment", sourceId: "11", subjectId: "file1", reason: "Content unavailable" },
    ],
  };
  await actor((tx) => tx`select clickup_import_checkpoint(${U},${CU},0,${tx.json(cursor)},null)`, {
    service: true,
  });
  const result = await actor(
    async (tx) =>
      (await tx`select clickup_import_finish_collect(${CU},'{"tasks":0}') value`)[0]!.value,
  );
  expect(result.status).toBe("planned");
  const run = (await db`select collect_coverage from clickup_import_runs where id=${CU}`)[0]!;
  expect(run.collect_coverage).toMatchObject({ complete: false, gaps: [{ entity: "attachment" }] });
});
it("ClickUp manage-only retains native access while time importers still require an active admin", async () => {
  await db`update workspace_members set role='member' where workspace_id=${W} and user_id=${U}`;
  await db`delete from grants where user_id=${U} and key=${key("clickup", "view")}`;
  await expect(preserve("clickup")).resolves.toBe(1);
  expect(await visible("clickup")).toHaveLength(1);
  await expect(preserve("clockify")).rejects.toThrow(/permissão/);
  await expect(preserve("jibble")).rejects.toThrow(/permissão/);
});
it("ClickUp source settings and private file RLS require the active workspace even for dual members", async () => {
  await db`insert into workspace_members values(${B},${U},'active','admin')`;
  for (const action of ["view", "manage"] as const)
    await db`insert into grants values(${U},${B},${key("clickup", action)},'grant')`;
  await expect(
    actor(
      (tx) => tx`select clickup_import_sources_set(${B},'[{"id":"99","name":"Other source"}]')`,
    ),
  ).rejects.toThrow(/Workspace ativo/);
  const sha = "b".repeat(64),
    path = `${W}/11/${sha}`;
  await actor(
    (tx) =>
      tx`insert into clickup_source_files(workspace_id,run_id,team_id,attachment_id,file_key,title,sha256,storage_path,bytes,content_type,status) values(${W},${CU},'11','file-id',${sha},'file.pdf',${sha},${path},3,'application/pdf','preserved')`,
    { service: true },
  );
  await db`insert into storage.objects(bucket_id,name) values('clickup-source-files',${path})`;
  await db`update profiles set active_workspace_id=${B} where id=${U}`;
  expect(await actor((tx) => tx`select * from clickup_source_files`)).toHaveLength(0);
  expect(await actor((tx) => tx`select * from storage.objects`)).toHaveLength(0);
  expect(await actor((tx) => tx`select * from clickup_import_source_bindings`)).toHaveLength(0);
});
it("review assignment records an authorized recipient without approving source errors", async () => {
  const recipient = "10000000-0000-4000-8000-000000000077";
  await db`insert into profiles values(${recipient},${W},'Review recipient')`;
  await db`insert into workspace_members values(${W},${recipient},'active','admin')`;
  await db`insert into grants values(${recipient},${W},${key("clockify", "view")},'grant')`;
  await preserve();
  const id = (await visible())[0]!.id;
  await reviewRecord(id, "Conferir saída com a origem", "review", null, null, recipient);
  expect(
    (
      await db`select review_assignee_id,status,payload from project_import_records where id=${id}`
    )[0],
  ).toMatchObject({ review_assignee_id: recipient, status: "pending", payload: { seconds: -60 } });
  expect(
    (
      await db`select assignee_id,actor_id from project_import_record_events where record_id=${id}`
    )[0],
  ).toEqual({ assignee_id: recipient, actor_id: U });
  const options = await actor(
    async (tx) =>
      (
        await tx`select project_import_member_targets(${W},'clockify','Review recipient',true) value`
      )[0]!.value,
  );
  expect(options.map((r: { id: string }) => r.id)).toEqual([recipient]);
});
it("review recipients with deny inactive or foreign membership are rejected atomically", async () => {
  const recipient = "10000000-0000-4000-8000-000000000077";
  await db`insert into profiles values(${recipient},${W},'Review recipient')`;
  await db`insert into workspace_members values(${W},${recipient},'active','admin')`;
  await db`insert into grants values(${recipient},${W},${key("clockify", "view")},'grant'),(${recipient},${W},${key("clockify", "view")},'deny')`;
  await preserve();
  const id = (await visible())[0]!.id;
  const assign = (user: string) =>
    reviewRecord(id, "Conferir saída com a origem", "review", null, null, user);
  await expect(assign(recipient)).rejects.toThrow(
    /indisponível|permissão|autorizado|inativo|acesso/,
  );
  await db`delete from grants where user_id=${recipient} and effect='deny'`;
  await db`update workspace_members set status='inactive' where user_id=${recipient}`;
  await expect(assign(recipient)).rejects.toThrow(
    /indisponível|permissão|autorizado|inativo|acesso/,
  );
  await expect(assign(V)).rejects.toThrow(/indisponível|permissão|autorizado|inativo|acesso/);
  expect((await db`select count(*)::int n from project_import_record_events`)[0]!.n).toBe(0);
  expect(
    (await db`select review_assignee_id from project_import_records`)[0]!.review_assignee_id,
  ).toBeNull();
});
it("task observations expand one identity without false source change then detect later real changes", async () => {
  const listing = { id: "task-envelope", name: "Task original", list: { id: "home" } };
  const detail = { ...listing, description: "Full source detail" };
  const first = mergeClickUpTaskObservation(null, listing, "list", "other");
  const complete = mergeClickUpTaskObservation(first, detail, "detail");
  const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as postgres.JSONValue;
  const task = (value: unknown) => ({
    ...record("task-envelope", json(value), "received", []),
    entity: "task",
  });
  await preserve("clickup", [task(first)]);
  await preserve("clickup", [task(complete)]);
  await preserve("clickup", [
    task(mergeClickUpTaskObservation(complete, listing, "list", "other")),
  ]);
  expect((await visible("clickup"))[0]).toMatchObject({ status: "received", version_count: 2 });
  expect((await db`select count(*)::int n from project_import_records`)[0]!.n).toBe(1);
  const nextRun = randomUUID();
  await db`insert into clickup_import_runs(id,workspace_id,requested_by,source_team_ids) values(${nextRun},${W},${U},array['11'])`;
  const changed = mergeClickUpTaskObservation(
    complete,
    { ...detail, description: "Updated in the provider" },
    "detail",
  );
  await actor(
    (tx) =>
      tx`select project_import_preserve_records(${W},'clickup','11',${nextRun},${tx.json([task(changed)])})`,
  );
  expect((await visible("clickup"))[0]).toMatchObject({ status: "pending", version_count: 3 });
  expect((await db`select issues from project_import_records`)[0]!.issues).toContain(
    "source_changed",
  );
});
it("a source change after opening review rejects the stale version before mapping or audit writes", async () => {
  const ext = "dddddddddddddddddddddddd";
  await db`insert into clockify_staging_records(workspace_id,source_workspace_id,entity_type,external_id,payload,last_run_id,status) values(${W},${source("clockify")},'project',${ext},'{}',${CK},'staged')`;
  await preserve("clockify", [
    { ...record(ext, { id: ext, name: "First source name" }, "received", []), entity: "project" },
  ]);
  const id = (await visible())[0]!.id;
  const old = (await db`select id from project_import_record_versions where record_id=${id}`)[0]!
    .id;
  await preserve("clockify", [
    {
      ...record(ext, { id: ext, name: "Changed while reviewing" }, "received", []),
      entity: "project",
    },
  ]);
  await expect(
    reviewRecord(id, "Confirmed project from source", "link", project, "project", null, old),
  ).rejects.toThrow(/mudou|versão atual/);
  expect((await db`select count(*)::int n from clockify_mappings`)[0]!.n).toBe(0);
  expect((await db`select count(*)::int n from project_import_record_events`)[0]!.n).toBe(0);
});
it("legacy ClickUp global-key capability is seeded only for previously applied imports with task links", () => {
  expect(migratedConnections).toEqual([{ workspace_id: legacyWorkspace, legacy_key: true }]);
  expect(migratedConnections.some((row) => row.workspace_id === unconfiguredWorkspace)).toBe(false);
});
it("ClickUp connection ciphertext and legacy markers cannot be read or forged by browser roles", async () => {
  await actor(
    (tx) =>
      tx`insert into clickup_import_connections(workspace_id,key_ciphertext,key_last4,legacy_key,updated_by) values(${W},'fixture-cipher','abcd',false,${U})`,
    { service: true },
  );
  expect(
    await actor((tx) => tx`select workspace_id,key_last4 from clickup_import_connections`),
  ).toHaveLength(1);
  await expect(
    actor((tx) => tx`select key_ciphertext from clickup_import_connections`),
  ).rejects.toThrow(/permission denied/);
  await expect(
    actor(
      (tx) => tx`insert into clickup_import_connections(workspace_id,legacy_key) values(${B},true)`,
    ),
  ).rejects.toThrow(/permission denied/);
  await expect(
    actor(
      (tx) => tx`update clickup_import_connections set legacy_key=true where workspace_id=${W}`,
    ),
  ).rejects.toThrow(/permission denied/);
  expect(
    await actor((tx) => tx`select workspace_id,key_last4 from clickup_import_connections`, {
      user: V,
    }),
  ).toHaveLength(0);
});

it("source evidence history paginates beyond 1000 versions and decisions with RLS", async () => {
  const file = "tests/fixtures/import-evidence-pages-cases.sql";
  if (!existsSync(file)) throw new Error("Missing mandatory evidence pagination SQL cases.");
  await db.unsafe(readFileSync(file, "utf8"));
  expect(
    (
      await db`select count(*)::int n from project_import_records where external_id='evidence-many'`
    )[0]!.n,
  ).toBe(0);
});

async function legacyClickUpSnapshots(externalId: string, sameAsFresh?: postgres.JSONValue) {
  // Make the newest snapshot sort first by the deliberately non-chronological UUID cursor.
  const candidates = [randomUUID(), randomUUID()];
  const ordered =
    await db`select id from (values(${candidates[0]}::uuid),(${candidates[1]}::uuid)) x(id) order by md5(id::text||':'||${externalId})::uuid`;
  const newest = String(ordered[0]!.id),
    oldest = String(ordered[1]!.id);
  await db`insert into clickup_import_runs(id,workspace_id,requested_by,created_at,source_team_ids) values(${newest},${W},${U},'2025-12-01T00:00:00Z',array['11']),(${oldest},${W},${U},'2024-01-01T00:00:00Z',array['11'])`;
  await db`insert into clickup_import_groups(run_id,workspace_id,team_id,list_ext_id) values(${newest},${W},'11','22'),(${oldest},${W},'11','22')`;
  await db`insert into clickup_import_tasks values(${newest},${W},${externalId},'22',null,${db.json({ id: externalId, name: "Newest legacy" })}),(${oldest},${W},${externalId},'22',null,${db.json({ id: externalId, name: "Older legacy" })})`;
  if (sameAsFresh) {
    const repeated = randomUUID();
    await db`insert into clickup_import_runs(id,workspace_id,requested_by,created_at,source_team_ids) values(${repeated},${W},${U},'2025-06-01T00:00:00Z',array['11'])`;
    await db`insert into clickup_import_groups(run_id,workspace_id,team_id,list_ext_id) values(${repeated},${W},'11','22')`;
    await db`insert into clickup_import_tasks values(${repeated},${W},${externalId},'22',null,${db.json(sameAsFresh)})`;
  }
}
async function adoptLegacy(provider: Provider, limit = 1) {
  let cursor: string | null = null;
  for (let page = 0; page < 20; page++) {
    const result: { cursor: string | null; done: boolean } = await actor(
      async (tx) =>
        (
          await tx`select project_import_preserve_legacy_step(${W},${provider},${cursor},${limit},null) result`
        )[0]!.result,
    );
    if (result.done) return;
    cursor = result.cursor;
  }
  throw new Error("Legacy adoption did not terminate");
}
it("adopts every distinct legacy task snapshot and points to the newest source time instead of UUID order", async () => {
  await legacyClickUpSnapshots("legacy-many");
  await adoptLegacy("clickup");
  const current = (await db`select * from project_import_records`)[0]!;
  expect(current).toMatchObject({
    payload: { id: "legacy-many", name: "Newest legacy" },
    version_count: 2,
    current_version_number: 1,
    current_from_legacy: true,
  });
  expect(current.source_observed_at.toISOString()).toBe("2025-12-01T00:00:00.000Z");
  const versions = await db`select * from project_import_record_versions order by version_number`;
  expect(versions.map((v) => v.payload.name)).toEqual(["Newest legacy", "Older legacy"]);
  expect(versions.every((v) => v.from_legacy)).toBe(true);
  expect(versions[1]!.source_observed_at.toISOString()).toBe("2024-01-01T00:00:00.000Z");
  expect((await db`select count(*)::int n from project_import_record_receipts`)[0]!.n).toBe(2);
  await adoptLegacy("clickup");
  expect((await db`select count(*)::int n from project_import_record_versions`)[0]!.n).toBe(2);
  await expect(
    reviewRecord(
      current.id,
      "Historical evidence is not current",
      "review",
      null,
      null,
      null,
      versions[1]!.id,
    ),
  ).rejects.toThrow(/mudou|versão atual/);
  await reviewRecord(current.id, "Confirmed the current source snapshot");
  const page = await actor(
    async (tx) =>
      (await tx`select project_import_records_page(${W},'clickup',null,'',0) result`)[0]!.result,
  );
  expect(page.rows[0]).toMatchObject({
    version_count: 2,
    current_version_number: 1,
    current_from_legacy: true,
  });
});
it("appends legacy evidence after fresh originals without changing the current payload pointer or review authority", async () => {
  const payload = { name: "Fresh original", id: "fresh-with-legacy" };
  const fresh = { ...record(payload.id, payload, "received", []), entity: "task" };
  await preserve("clickup", [fresh]);
  const before = (await db`select * from project_import_records`)[0]!;
  const version = (await db`select id from project_import_record_versions`)[0]!.id;
  // Different property order / serialized hash must not duplicate the equal JSON snapshot.
  await legacyClickUpSnapshots(payload.id, { id: payload.id, name: payload.name });
  await adoptLegacy("clickup");
  const current = (await db`select * from project_import_records`)[0]!;
  expect(current).toMatchObject({
    payload,
    version_count: 3,
    current_version_number: 1,
    current_from_legacy: false,
    last_run_id: CU,
  });
  expect(current.source_observed_at).toEqual(before.source_observed_at);
  const historical = (
    await db`select id from project_import_record_versions where record_id=${current.id} and version_number=3`
  )[0]!.id;
  await expect(
    reviewRecord(
      current.id,
      "The last appended version is historical",
      "review",
      null,
      null,
      null,
      historical,
    ),
  ).rejects.toThrow(/mudou|versão atual/);
  await reviewRecord(
    current.id,
    "Current original remains authorized",
    "review",
    null,
    null,
    null,
    version,
  );
  await preserve("clickup", [fresh]);
  expect(
    (await db`select current_version_number,version_count from project_import_records`)[0],
  ).toEqual({ current_version_number: 1, version_count: 3 });
  await preserve("clickup", [{ ...fresh, payload: { ...payload, name: "Fresh changed" } }]);
  expect(
    (await db`select current_version_number,version_count from project_import_records`)[0],
  ).toEqual({ current_version_number: 4, version_count: 4 });
});

it("replayed pages preserve intrinsic source changes without turning native review reasons into permanent source errors", async () => {
  const payload = {
    id: "replayed-page",
    timeInterval: { start: "2026-01-01T10:00:00Z", end: "2026-01-01T11:00:00Z" },
  };
  const row = record(payload.id, payload, "received", []);
  await preserve("clockify", [row]);
  await db`insert into clockify_staging_records(workspace_id,source_workspace_id,entity_type,external_id,payload,last_run_id,status,reason_code) values(${W},${source("clockify")},'time_entry',${payload.id},${db.json(payload)},${CK},'pending_review','unmapped_user')`;
  await preserve("clockify", [row]);
  expect((await db`select status,issues,source_issues from project_import_records`)[0]).toEqual({
    status: "pending",
    issues: ["unmapped_user"],
    source_issues: [],
  });
  await db`update clockify_staging_records set status='imported',reason_code=null where external_id=${payload.id}`;
  expect((await db`select status,issues from project_import_records`)[0]).toEqual({
    status: "ready",
    issues: [],
  });
  const changed = { ...row, payload: { ...payload, description: "Changed in source" } };
  await preserve("clockify", [changed]);
  await preserve("clockify", [changed]);
  await db`update clockify_staging_records set status='imported',reason_code=null where external_id=${payload.id}`;
  expect((await db`select status,source_issues from project_import_records`)[0]).toEqual({
    status: "pending",
    source_issues: ["source_changed"],
  });
});

for (const provider of providers)
  it(`${provider} classification and finalization require native completion and preserve source issues across all permission cases`, async () => {
    const begun = await actor(
      async (tx) =>
        (
          await tx`select project_import_journey_begin(${W},${provider},${source(provider)},'Acceptance source') result`
        )[0]!.result,
    );
    const claim = await actor(
      async (tx) =>
        (await tx`select project_import_journey_claim(${W},${begun.id},${provider}) result`)[0]!
          .result,
    );
    await db`update project_import_journeys set stage='apply',native_run_id=${run(provider)},coverage='{"complete":true}' where id=${begun.id}`;
    if (provider === "clockify")
      await db`update clockify_import_runs set kind='import',status='running' where id=${CK}`;
    else if (provider === "jibble")
      await db`update time_import_runs set kind='import',status='running' where id=${JB}`;
    else await db`update clickup_import_runs set status='applying' where id=${CU}`;
    await preserve(provider, [
      {
        ...record("ref", { id: "ref", name: "Valid reference" }, "received", []),
        entity: "project",
      },
      record(
        "intrinsic",
        {
          id: "intrinsic",
          timeInterval: { start: "2026-01-01T11:00:00Z", end: "2026-01-01T10:00:00Z" },
        },
        "received",
        ["negative_duration"],
      ),
    ]);
    const classify = (options: Parameters<typeof actor>[1] = {}) =>
      actor(
        async (tx) =>
          (await tx`select project_import_ready_step(${W},${begun.id},500) result`)[0]!.result,
        options,
      );
    const finish = () =>
      actor(
        async (tx) =>
          (
            await tx`select project_import_journey_checkpoint(${W},${begun.id},${claim.lease_token},'{"stage":"done","status":"complete","coverage":{"complete":true}}') result`
          )[0]!.result,
        { service: true },
      );
    await expect(classify()).rejects.toThrow(/ainda não terminou/);
    await expect(finish()).rejects.toThrow(/ainda não terminou/);
    if (provider === "clockify")
      await db`update clockify_import_runs set status='completed' where id=${CK}`;
    else if (provider === "jibble")
      await db`update time_import_runs set status='completed' where id=${JB}`;
    else await db`update clickup_import_runs set status='applied' where id=${CU}`;
    await expect(finish()).rejects.toThrow(/classificação/);
    // Missing keys, explicit deny, foreign active workspace and inactive membership all reject.
    await db`delete from grants where workspace_id=${W} and user_id=${U} and key in(${key(provider, "view")},${key(provider, "manage")})`;
    await expect(classify()).rejects.toThrow(/indisponível/);
    await expect(finish()).rejects.toThrow(/revogada/);
    for (const action of ["view", "manage"] as const)
      await db`insert into grants values(${U},${W},${key(provider, action)},'grant')`;
    await db`insert into grants values(${U},${W},${key(provider, "manage")},'deny')`;
    await expect(classify()).rejects.toThrow(/indisponível/);
    await expect(finish()).rejects.toThrow(/revogada/);
    await db`delete from grants where workspace_id=${W} and user_id=${U} and effect='deny'`;
    await expect(classify({ user: V })).rejects.toThrow(/indisponível/);
    await db`update workspace_members set status='inactive' where workspace_id=${W} and user_id=${U}`;
    await expect(classify()).rejects.toThrow(/indisponível/);
    await expect(finish()).rejects.toThrow(/revogada/);
    await db`update workspace_members set status='active' where workspace_id=${W} and user_id=${U}`;
    expect(await classify()).toEqual({ classified: 1, done: true });
    expect(
      (
        await db`select status,source_issues from project_import_records where external_id='intrinsic'`
      )[0],
    ).toMatchObject({
      status: "pending",
      source_issues: expect.arrayContaining(["negative_duration"]),
    });
    expect(await finish()).toBe(true);
    expect(
      (await db`select stage,status from project_import_journeys where id=${begun.id}`)[0],
    ).toEqual({ stage: "done", status: "complete" });
  });

it("removes inherited write and truncate grants from every new source table", async () => {
  const tables = [
    "project_import_records",
    "project_import_record_versions",
    "project_import_record_receipts",
    "project_import_record_events",
    "project_import_journeys",
    "clickup_import_list_targets",
    "clickup_import_connections",
    "clickup_import_source_bindings",
    "clickup_source_files",
    "jibble_source_files",
  ];
  for (const role of ["anon", "authenticated"])
    for (const table of tables)
      for (const privilege of ["INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"])
        expect(
          (
            await db`select has_table_privilege(${role},${`public.${table}`},${privilege}) allowed`
          )[0]!.allowed,
          `${role}: ${table}: ${privilege}`,
        ).toBe(false);
});
