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
const container = "techerp-review-ci-" + randomUUID();
const W = "aaaaaaaa-0000-4000-8000-00000000000a",
  B = "aaaaaaaa-0000-4000-8000-00000000000b";
const U = "10000000-0000-4000-8000-000000000002",
  O = "10000000-0000-4000-8000-000000000001",
  P = "10000000-0000-4000-8000-000000000003";

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
  await db.unsafe(`
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$SELECT current_user::text$$;
    CREATE FUNCTION current_user_workspaces() RETURNS SETOF uuid LANGUAGE sql STABLE AS $$SELECT active_workspace_id FROM profiles WHERE id=auth.uid()$$;
    CREATE FUNCTION is_active_workspace_admin(w uuid,u uuid) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=w AND user_id=u AND status='active' AND role IN ('owner','admin'))$$;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);
    CREATE TABLE companies(id uuid PRIMARY KEY,workspace_id uuid,name text,deleted_at timestamptz);
    CREATE TABLE people(id uuid PRIMARY KEY,workspace_id uuid,full_name text,email text,profile_id uuid,archived boolean DEFAULT false);
    CREATE TABLE projects(id uuid PRIMARY KEY,workspace_id uuid,name text,company_id uuid,metadata jsonb DEFAULT '{}',updated_at timestamptz DEFAULT now());
    CREATE TABLE project_time_entries(id uuid PRIMARY KEY,workspace_id uuid,project_id uuid,user_id uuid,person_id uuid,allocation_id uuid,entry_date date,status text DEFAULT 'locked_import',duration_minutes int DEFAULT 60,updated_at timestamptz DEFAULT now());
    CREATE TABLE people_allocations(id uuid PRIMARY KEY,workspace_id uuid,person_id uuid,project_id uuid,starts_at date,ends_at date);
    CREATE TABLE clockify_mappings(workspace_id uuid,entity_type text,external_id text,target_id uuid);
    CREATE TABLE time_import_mappings(LIKE clockify_mappings);
    CREATE TABLE project_link_batches(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,kind text,actor uuid,counts jsonb,created_at timestamptz DEFAULT now());
    CREATE TABLE project_link_changes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,batch_id uuid,target_table text,target_id uuid,field text,subject_id uuid,old_value uuid,new_value uuid,criterion text,provider text,evidence jsonb,actor uuid,created_at timestamptz DEFAULT now(),reverted_at timestamptz,reverted_by uuid,revert_batch_id uuid);
  `);
  await db.unsafe(
    sourceFunction(
      "drizzle/migrations/0219_order3_completion_activate.sql",
      "project_recon_assert_admin",
    ),
  );
  await db.unsafe(
    sourceFunction(
      "drizzle/migrations/0169_techprojects_cycle1_reconciliation.sql",
      "project_links_revert",
    ),
  );
  await db.unsafe(
    readFileSync("drizzle/migrations/0328_hiring_assisted_reconciliation.sql", "utf8"),
  );
}, 120000);
afterAll(async () => {
  if (competitor) await competitor.end();
  if (db) await db.end();
  if (started) dockerRun("rm", "-f", container);
  if (temporary) rmSync(temporary, { recursive: true, force: true });
});

const project = "20000000-0000-4000-8000-000000000001",
  company = "20000000-0000-4000-8000-000000000002",
  person = "20000000-0000-4000-8000-000000000003",
  entry = "20000000-0000-4000-8000-000000000004",
  alloc = "20000000-0000-4000-8000-000000000005";
const viewKey = "techprojects.reconciliation.view.workspace",
  manageKey = "techprojects.reconciliation.manage.workspace";
async function seed() {
  await db`truncate project_link_changes,project_link_review_rows,project_link_batches,projects,people,people_allocations,project_time_entries,workspace_members,grants,profiles,auth.users,workspaces cascade`;
  await db`insert into workspaces values(${W}),(${B})`;
  await db`insert into profiles(id,active_workspace_id) values(${U},${W}),(${O},${W}),(${P},${W})`;
  await db`insert into workspace_members(workspace_id,user_id,status,role) values(${W},${U},'active','admin'),(${W},${O},'active','admin'),(${W},${P},'active','member')`;
  await db`insert into grants values(${U},${viewKey},'grant'),(${U},${manageKey},'grant')`;
  await db`insert into auth.users values(${P},'person@wk.example')`;
  await db`insert into companies values(${company},${W},'Example',null) on conflict(id) do nothing`;
  await db`insert into projects(id,workspace_id,name,metadata) values(${project},${W},'Historical',${db.json({ clockify: { company_id: company, client_id: "client" } })})`;
  await db`insert into people(id,workspace_id,full_name,email) values(${person},${W},'Person','person@wk.example')`;
  await db`insert into people_allocations values(${alloc},${W},${person},${project},'2026-01-01','2026-12-31')`;
  await db`insert into project_time_entries(id,workspace_id,project_id,user_id,entry_date) values(${entry},${W},${project},${P},'2026-06-15')`;
}
async function actor<T>(fn: (tx: postgres.TransactionSql) => Promise<T>, user = U) {
  return db.begin(async (tx) => {
    await tx`select set_config('request.uid',${user},true)`;
    await tx.unsafe("SET LOCAL ROLE authenticated");
    return fn(tx);
  });
}
async function preview(kind = "time") {
  return actor(
    async (tx) =>
      (
        await tx`select project_link_review_preview(${W},${kind},'2026-06-01','2026-06-30',null) value`
      )[0].value,
  );
}
it("review allowed active admin applies explicit exact rows and idempotent batch", async () => {
  await seed();
  const page = await preview(),
    batch = randomUUID();
  expect(page.rows).toHaveLength(1);
  const first = await actor(
    async (tx) =>
      (await tx`select project_link_review_apply(${W},${batch},${tx.json(page.rows)}) value`)[0]
        .value,
  );
  expect(first.changed).toBe(1);
  expect(
    (
      await actor(
        async (tx) =>
          (await tx`select project_link_review_apply(${W},${batch},${tx.json(page.rows)}) value`)[0]
            .value,
      )
    ).changed,
  ).toBe(1);
  const result = (
    await db`select person_id,allocation_id,status,duration_minutes from project_time_entries where id=${entry}`
  )[0];
  expect(result).toEqual({
    person_id: person,
    allocation_id: alloc,
    status: "locked_import",
    duration_minutes: 60,
  });
});
it("review missing key is denied in database RPC", async () => {
  await seed();
  await db`delete from grants where key=${viewKey}`;
  await expect(preview()).rejects.toThrow(/permissão/);
});
it("review explicit deny wins in database RPC", async () => {
  await seed();
  await db`insert into grants values(${U},${viewKey},'deny')`;
  await expect(preview()).rejects.toThrow(/permissão/);
});
it("review foreign workspace is denied in database RPC", async () => {
  await seed();
  await expect(
    actor(
      (tx) => tx`select project_link_review_preview(${B},'time','2026-06-01','2026-06-30',null)`,
    ),
  ).rejects.toThrow(/permissão/);
});
it("review inactive member is denied in database RPC", async () => {
  await seed();
  await db`update workspace_members set status='inactive' where user_id=${U}`;
  await expect(preview()).rejects.toThrow(/permissão/);
});
it("review changed preview rolls back and preserves imported history", async () => {
  await seed();
  const page = await preview();
  await db`update project_time_entries set duration_minutes=61 where id=${entry}`;
  await expect(
    actor((tx) => tx`select project_link_review_apply(${W},${randomUUID()},${tx.json(page.rows)})`),
  ).rejects.toThrow(/desatualizada/);
  expect((await db`select person_id,duration_minutes from project_time_entries`)[0]).toEqual({
    person_id: null,
    duration_minutes: 61,
  });
  expect((await db`select count(*) n from project_link_batches`)[0].n).toBe("0");
});
it("review ambiguous email stays unlinked", async () => {
  await seed();
  await db`insert into people(id,workspace_id,full_name,email) values(${randomUUID()},${W},'Duplicate','PERSON@WK.EXAMPLE')`;
  expect((await preview()).rows).toEqual([]);
});
it("review company source evidence and grouped reversal preserve original timestamps", async () => {
  await seed();
  const original = (await db`select updated_at from projects`)[0].updated_at,
    page = await preview("company"),
    batch = randomUUID();
  await actor((tx) => tx`select project_link_review_apply(${W},${batch},${tx.json(page.rows)})`);
  expect((await db`select company_id,updated_at from projects`)[0]).toEqual({
    company_id: company,
    updated_at: original,
  });
  const result = await actor(
    async (tx) => (await tx`select project_link_review_revert(${W},${batch}) value`)[0].value,
  );
  expect(result.reverted).toBe(1);
  expect((await db`select company_id from projects`)[0].company_id).toBeNull();
});
it("review reversal detects later edit including ABA and legacy bypass", async () => {
  await seed();
  const page = await preview(),
    batch = randomUUID();
  await actor((tx) => tx`select project_link_review_apply(${W},${batch},${tx.json(page.rows)})`);
  await db`update project_time_entries set duration_minutes=61 where id=${entry}`;
  await db`update project_time_entries set duration_minutes=60 where id=${entry}`;
  const result = await actor(
    async (tx) =>
      (await tx`select project_links_revert(${W},'batch',array[]::uuid[],${batch}) value`)[0].value,
  );
  expect(result.skipped_changed_since).toBe(1);
  expect((await db`select person_id from project_time_entries`)[0].person_id).toBe(person);
  await expect(
    actor((tx) => tx`select project_links_revert(${W},'person',array[${P}::uuid],null)`),
  ).rejects.toThrow(/individualmente/);
});
it("review write requires manage and no direct journal writes", async () => {
  await seed();
  const page = await preview();
  await db`delete from grants where key=${manageKey}`;
  await expect(
    actor((tx) => tx`select project_link_review_apply(${W},${randomUUID()},${tx.json(page.rows)})`),
  ).rejects.toThrow(/permissão/);
  await expect(actor((tx) => tx`select * from project_link_review_rows`)).rejects.toThrow(
    /permission denied/,
  );
});
it("review empty overlarge periods and forged candidates are rejected", async () => {
  await seed();
  await expect(
    actor(
      (tx) => tx`select project_link_review_preview(${W},'time','2020-01-01','2026-06-30',null)`,
    ),
  ).rejects.toThrow(/94 dias/);
  const page = await preview();
  page.rows[0].after.person_id = randomUUID();
  await expect(
    actor((tx) => tx`select project_link_review_apply(${W},${randomUUID()},${tx.json(page.rows)})`),
  ).rejects.toThrow(/desatualizada/);
});
it("review concurrent same batch produces exactly one journal", async () => {
  await seed();
  const page = await preview(),
    batch = randomUUID();
  const requests = [db, competitor].map((conn) =>
    conn.begin(async (tx) => {
      await tx`select set_config('request.uid',${U},true)`;
      await tx.unsafe("SET LOCAL ROLE authenticated");
      return tx`select project_link_review_apply(${W},${batch},${tx.json(page.rows)}) value`;
    }),
  );
  const results = await Promise.all(requests);
  expect(results.map((r) => r[0].value.changed)).toEqual([1, 1]);
  expect((await db`select count(*) n from project_link_review_rows`)[0].n).toBe("1");
});
it("review grouped time reversal removes both links once and preserves hours", async () => {
  await seed();
  const page = await preview(),
    batch = randomUUID();
  await actor((tx) => tx`select project_link_review_apply(${W},${batch},${tx.json(page.rows)})`);
  const result = await actor(
    async (tx) => (await tx`select project_link_review_revert(${W},${batch}) value`)[0].value,
  );
  expect(result.reverted).toBe(1);
  expect(
    (await db`select person_id,allocation_id,status,duration_minutes from project_time_entries`)[0],
  ).toEqual({
    person_id: null,
    allocation_id: null,
    status: "locked_import",
    duration_minutes: 60,
  });
  expect(
    (
      await actor(
        async (tx) => (await tx`select project_link_review_revert(${W},${batch}) value`)[0].value,
      )
    ).reverted,
  ).toBe(0);
});
it("review rechecks identity evidence after preview and denies nonadmin", async () => {
  await seed();
  const page = await preview();
  await db`update people set email='changed@wk.example' where id=${person}`;
  await expect(
    actor((tx) => tx`select project_link_review_apply(${W},${randomUUID()},${tx.json(page.rows)})`),
  ).rejects.toThrow(/desatualizada/);
  await db`insert into grants values(${P},${viewKey},'grant')`;
  await expect(actor((tx) => tx`select project_link_review_history(${W})`, P)).rejects.toThrow(
    /administradores/,
  );
});
