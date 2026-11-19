import { beforeAll, afterAll, it, expect } from "vitest";
import postgres from "postgres";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, readdirSync, chownSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
// Never reads a configured URL. Native official PostgreSQL gets its own temporary Unix socket.
let root = "",
  started = false;
let db: ReturnType<typeof postgres>;
const W = "aaaaaaaa-0000-4000-8000-000000000001",
  B = "aaaaaaaa-0000-4000-8000-000000000002",
  U = "bbbbbbbb-0000-4000-8000-000000000001",
  A = "cccccccc-0000-4000-8000-000000000001",
  L = "dddddddd-0000-4000-8000-000000000001",
  C = "eeeeeeee-0000-4000-8000-000000000001";
const nixPg =
  process.platform === "linux"
    ? readdirSync("/nix/store").find((n) => /-postgresql-17\.\d+$/.test(n))
    : undefined;
const useNative =
  !!nixPg || (process.platform === "darwin" && process.env.TECHERP_NATIVE_PG === "1");
const pgBin = nixPg
  ? `/nix/store/${nixPg}/bin/`
  : "/Applications/Postgres.app/Contents/Versions/16/bin/";
function native(binary: string, args: string[]) {
  return nixPg
    ? execFileSync("runuser", ["-u", "nobody", "--", pgBin + binary, ...args], {
        stdio: "pipe",
        timeout: 30000,
      })
    : execFileSync(pgBin + binary, args, { stdio: "pipe", timeout: 30000 });
}
const docker =
  process.platform === "darwin"
    ? "/Applications/Docker.app/Contents/Resources/bin/docker"
    : "docker";
const image = "postgres@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b";
const container = "techerp-preparation-ci-" + randomUUID();
let endpoint = "";
const dockerRun = (...args: string[]) =>
  execFileSync(docker, ["--host", endpoint, ...args], {
    encoding: "utf8",
    timeout: 90000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
function body(path: string, name: string) {
  const sql = readFileSync(path, "utf8");
  const start = sql.indexOf("CREATE OR REPLACE FUNCTION " + name);
  if (start < 0) throw Error("Missing resolver " + name);
  const tail = sql.slice(start);
  const delimiter = tail.match(/AS\s+(\$[a-zA-Z_]*\$)/i)?.[1] ?? tail.match(/(\$\$)/)?.[1];
  if (!delimiter) throw Error("Missing body");
  const first = tail.indexOf(delimiter),
    end = tail.indexOf(delimiter, first + delimiter.length);
  return tail.slice(0, tail.indexOf(";", end) + 1);
}
beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "hiring-approval-pg-"));
  if (nixPg) chownSync(root, 65534, 65534);
  if (useNative) {
    native("initdb", [
      "-D",
      join(root, "data"),
      "-U",
      "postgres",
      "--auth-local=trust",
      "--auth-host=reject",
      "--no-locale",
      "--encoding=UTF8",
    ]);
    native("pg_ctl", [
      "-D",
      join(root, "data"),
      "-l",
      join(root, "server.log"),
      "-o",
      `-k ${root} -h '' -p 55437 -F`,
      "-w",
      "start",
    ]);
    started = true;
    db = postgres({
      host: root,
      port: 55437,
      username: "postgres",
      database: "postgres",
      max: 4,
      onnotice: () => {},
    });
  } else {
    endpoint = execFileSync(
      docker,
      ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"],
      { encoding: "utf8", timeout: 10000 },
    ).trim();
    if (!endpoint.startsWith("unix://")) throw Error("Only a local Unix Docker socket is allowed.");
    const password = randomUUID() + randomUUID(),
      envFile = join(root, "postgres.env");
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
      username: "postgres",
      password,
      database: "techerp_permission_ci",
      max: 4,
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
  }
  // Create introspection function after resolver dependencies to satisfy SQL-language validation.
  const fixture = readFileSync("tests/fixtures/hiring-preparation.sql", "utf8");
  const permission = fixture.match(/CREATE FUNCTION user_has_permission[^\n]+/)?.[0];
  if (!permission) throw Error("resolver missing");
  await db.unsafe(fixture.replace(permission, ""));
  await db.unsafe(
    body(
      "drizzle/migrations/0031_workspace_members_status_inactive.sql",
      "public.is_workspace_member",
    ),
  );
  await db.unsafe(
    body("drizzle/migrations/0046_view_as_role_only_readonly.sql", "public.is_read_only_view"),
  );
  await db.unsafe(
    body(
      "drizzle/migrations/0315_hiring_role_restrictions.sql",
      "techerp_api.effective_permissions_unchecked",
    ),
  );
  await db.unsafe(
    body(
      "drizzle/migrations/0249_permission_introspection_boundary.sql",
      "public.permission_metadata_access",
    ),
  );
  await db.unsafe(
    body(
      "drizzle/migrations/0249_permission_introspection_boundary.sql",
      "public.user_effective_permissions",
    ),
  );
  await db.unsafe(permission);
  // Supabase migrations use a non-superuser with CREATEROLE, not PostgreSQL superuser.
  await db.unsafe(`CREATE ROLE preparation_migrator NOLOGIN CREATEROLE INHERIT;
    GRANT authenticated TO preparation_migrator WITH ADMIN OPTION;
    GRANT USAGE,CREATE ON SCHEMA public TO preparation_migrator WITH GRANT OPTION;
    GRANT USAGE ON SCHEMA auth TO preparation_migrator WITH GRANT OPTION;
    GRANT SELECT,INSERT ON permissions TO preparation_migrator;
    GRANT REFERENCES ON workspaces,user_groups,legal_entities,people,companies,contacts,deals,projects,contracts TO preparation_migrator;
    ALTER DEFAULT PRIVILEGES FOR ROLE preparation_migrator IN SCHEMA public GRANT ALL ON TABLES TO authenticated,anon;
    ALTER DEFAULT PRIVILEGES FOR ROLE preparation_migrator IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated,anon;
    SET ROLE preparation_migrator;`);
  await db.unsafe(readFileSync("drizzle/migrations/0373_hiring_requests.sql", "utf8"));
  await db.unsafe(
    readFileSync("drizzle/migrations/0374_hiring_preparation_conditions.sql", "utf8"),
  );
  await db.unsafe("RESET ROLE");
  await db.unsafe(`CREATE TABLE hiring_area_policies(workspace_id uuid,area_id uuid PRIMARY KEY,manager_id uuid,ceo_id uuid,manager_delegate_id uuid,ceo_delegate_id uuid,revision integer DEFAULT 1,updated_by uuid,updated_at timestamptz DEFAULT now());
    CREATE TABLE notifications(id uuid DEFAULT gen_random_uuid(),workspace_id uuid,owner_id uuid,user_id uuid,type text,title text,body text,link text,entity text,entity_id uuid,dedupe_key text);
    CREATE UNIQUE INDEX notification_dedupe ON notifications(dedupe_key) WHERE dedupe_key IS NOT NULL;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated,anon,techerp_request_writer;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated,anon,service_role,techerp_request_writer;`);
  await db.begin(async (tx) => {
    await tx.unsafe(
      readFileSync(
        "docs/architecture/prepared-migrations/0375_hiring_preparation_approvals.sql",
        "utf8",
      )
        .replace(/^BEGIN;$/m, "")
        .replace(/^COMMIT;$/m, ""),
    );
  });

  for (const table of [
    "user_groups",
    "legal_entities",
    "people",
    "companies",
    "contacts",
    "deals",
    "projects",
    "contracts",
  ]) {
    await db.unsafe(
      `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; CREATE POLICY fixture_entity_read ON ${table} FOR SELECT TO authenticated USING(workspace_id=(SELECT active_workspace_id FROM profiles WHERE id=auth.uid()) AND is_workspace_member(workspace_id,auth.uid()));`,
    );
  }
}, 120000);
afterAll(async () => {
  if (db) await db.end();
  if (started && useNative)
    native("pg_ctl", ["-D", join(root, "data"), "-m", "fast", "-w", "stop"]);
  if (started && !useNative) dockerRun("rm", "-f", container);
  if (root) rmSync(root, { recursive: true, force: true });
});
const M = "bbbbbbbb-0000-4000-8000-000000000002",
  CEO = "bbbbbbbb-0000-4000-8000-000000000003",
  D = "bbbbbbbb-0000-4000-8000-000000000004";
const prefix = (kind: string) =>
  kind === "professional" ? "techpeople.hiring_requests" : "techcontracts.supplier_requests";
async function reset() {
  await db.unsafe(
    "TRUNCATE hiring_preparation_approval_events,hiring_preparation_approvals,hiring_preparation_reference_events,hiring_preparation_reference_values,hiring_preparation_events,hiring_preparation_requests,notifications,hiring_area_policies,workspaces,profiles,workspace_members,user_job_roles,job_roles,job_role_permission_overrides,user_permission_sets,permission_sets,permission_set_items,user_groups,legal_entities,people,companies,contacts,deals,projects,contracts CASCADE",
  );
  await db`insert into workspaces(id) values(${W}),(${B})`;
  for (const u of [U, M, CEO, D]) {
    await db`insert into profiles values(${u},${W})`;
    await db`insert into workspace_members(workspace_id,user_id) values(${W},${u})`;
    await db`insert into job_roles values(${u},${W})`;
    await db`insert into user_job_roles values(${u},${u},${W},null)`;
    await db`insert into job_role_permission_overrides select ${W},${u},key,'grant' from permissions`;
  }
  await db`insert into user_groups values(${A},${W},'Área de fixture')`;
  await db`insert into legal_entities(id,workspace_id,name) values(${L},${W},'WK fixture')`;
  await db`insert into companies(id,workspace_id,name) values(${C},${W},'Fornecedor fixture')`;
  await db`insert into hiring_area_policies(workspace_id,area_id,manager_id,ceo_id,manager_delegate_id,updated_by) values(${W},${A},${M},${CEO},${D},${U})`;
}
async function user<T>(u: string, fn: (tx: postgres.TransactionSql) => Promise<T>) {
  return db.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims',${JSON.stringify({ sub: u, role: "authenticated" })},true)`;
    await tx.unsafe("SET LOCAL ROLE authenticated");
    return fn(tx);
  });
}
const form = (kind: string) => ({
  title: "Pedido sintético",
  scope_text: "Escopo para revisão",
  purpose: "internal",
  area_id: A,
  legal_entity_id: L,
  regime: kind === "professional" ? "pj" : null,
  person_id: null,
  company_id: kind === "supplier" ? C : null,
  contact_id: null,
  deal_id: null,
  project_id: null,
  commercial_contract_id: null,
  status: "draft",
  selection_mode: "needs_selection",
  modality: "monthly",
  release_condition: kind === "supplier" ? "wk_acceptance_invoice" : null,
});
async function ready(kind = "professional") {
  const data = form(kind);
  const draft = await user(U, (tx) =>
    tx`select hiring_preparation_save(${W},${kind},null,0,${randomUUID()},${tx.json({ ...data, reference_value: 22000 })}) v`.then(
      (x) => x[0].v,
    ),
  );
  return user(U, (tx) =>
    tx`select hiring_preparation_save(${W},${kind},${draft.id},1,${randomUUID()},${tx.json({ ...data, status: "ready" })}) v`.then(
      (x) => x[0].v,
    ),
  );
}
const request = (r: { id: string; revision: number }, kind = "professional", u = U) =>
  user(u, (tx) =>
    tx`select hiring_preparation_approval_request(${W},${kind},${r.id},${r.revision}) v`.then(
      (x) => x[0].v as string,
    ),
  );
const context = (id: string, u = U, kind = "professional") =>
  user(u, (tx) =>
    tx`select hiring_preparation_approval_context(${W},${kind},${id},0) v`.then((x) => x[0].v),
  );
const decide = (
  r: { id: string; revision: number },
  a: string,
  u = M,
  stage = "manager",
  decision = "approved",
  op = randomUUID(),
  kind = "professional",
  note = "Revisão conferida",
) =>
  user(u, (tx) =>
    tx`select hiring_preparation_approval_decide(${W},${kind},${r.id},${r.revision},${a},${stage},${decision},${note},${op}) v`.then(
      (x) => x[0].v,
    ),
  );

it("approval allows authorized active member", async () => {
  await reset();
  for (const kind of ["professional", "supplier"]) {
    const r = await ready(kind),
      a = await request(r, kind);
    await decide(r, a, M, "manager", "approved", randomUUID(), kind);
    expect((await context(r.id, CEO, kind)).can_decide).toBe(true);
    await decide(r, a, CEO, "ceo", "approved", randomUUID(), kind);
    expect((await context(r.id, U, kind)).status).toBe("approved");
    expect(
      (await db`select status from hiring_preparation_requests where id=${r.id}`)[0].status,
    ).toBe("ready");
  }
});
it("approval rejects missing permission", async () => {
  await reset();
  for (const kind of ["professional", "supplier"]) {
    const r = await ready(kind),
      a = await request(r, kind);
    await db`delete from job_role_permission_overrides where role_id=${U} and permission_key=${prefix(kind) + ".approval_request.create.workspace"}`;
    await expect(request(r, kind)).rejects.toThrow("Sem permissão");
    await db`delete from job_role_permission_overrides where role_id=${M} and permission_key=${prefix(kind) + ".approval.approve.workspace"}`;
    await expect(decide(r, a, M, "manager", "approved", randomUUID(), kind)).rejects.toThrow(
      "Sem permissão",
    );
  }
});
it("approval rejects explicit deny", async () => {
  await reset();
  const r = await ready(),
    a = await request(r);
  await db`insert into job_role_permission_overrides values(${W},${U},'techpeople.hiring_requests.approval_request.create.workspace','deny'),(${W},${M},'techpeople.hiring_requests.approval.approve.workspace','deny')`;
  await expect(request(r)).rejects.toThrow("Sem permissão");
  await expect(decide(r, a)).rejects.toThrow("Sem permissão");
  expect((await context(r.id)).problem).toContain("sem acesso");
});
it("approval rejects foreign workspace", async () => {
  await reset();
  const r = await ready(),
    a = await request(r);
  await db`update profiles set active_workspace_id=${B} where id in (${U},${M})`;
  await expect(request(r)).rejects.toThrow("Sem permissão");
  await expect(decide(r, a)).rejects.toThrow("Sem permissão");
  await expect(context(r.id)).rejects.toThrow("Sem acesso");
  await user(U, async (tx) =>
    expect((await tx`select count(*)::int n from hiring_preparation_approvals`)[0].n).toBe(0),
  );
});
it("approval rejects inactive member", async () => {
  await reset();
  const r = await ready(),
    a = await request(r);
  await db`update workspace_members set status='inactive' where user_id in (${U},${M})`;
  await expect(request(r)).rejects.toThrow("Sem permissão");
  await expect(decide(r, a)).rejects.toThrow("Sem permissão");
  await expect(context(r.id)).rejects.toThrow("Sem acesso");
});
it("approval never falls back for area without approver", async () => {
  await reset();
  const r = await ready();
  await db`delete from hiring_area_policies`;
  expect((await context(r.id)).can_request).toBe(false);
  await expect(request(r)).rejects.toThrow("Área sem alçada");
  expect((await db`select count(*)::int n from hiring_preparation_approvals`)[0].n).toBe(0);
});
it("approval blocks creator and requester and uses only explicit substitute", async () => {
  await reset();
  const r = await ready();
  await db`update hiring_area_policies set manager_id=${U}`;
  const a = await request(r);
  expect((await context(r.id)).manager_id).toBe(D);
  await expect(decide(r, a, U)).rejects.toThrow("autoaprovação");
  await decide(r, a, D);
  expect((await context(r.id)).stage).toBe("ceo");
  const second = await ready();
  await db`update hiring_area_policies set manager_delegate_id=null`;
  await expect(request(second)).rejects.toThrow("substituto");
});
it("approval enforces manager then CEO even for same person", async () => {
  await reset();
  const r = await ready(),
    a = await request(r);
  await expect(decide(r, a, CEO, "ceo")).rejects.toThrow("etapa anterior");
  await decide(r, a);
  expect((await context(r.id)).status).toBe("pending");
  await reset();
  await db`update hiring_area_policies set ceo_id=${M}`;
  const r2 = await ready(),
    a2 = await request(r2);
  await decide(r2, a2);
  expect((await context(r2.id)).status).toBe("pending");
  await decide(r2, a2, M, "ceo");
  expect((await context(r2.id)).status).toBe("approved");
});
it("approval invalidates on material edit reference and canonical policy", async () => {
  for (const change of ["material", "reference", "policy"]) {
    await reset();
    const r = await ready(),
      a = await request(r);
    await decide(r, a);
    if (change === "policy")
      await db`update hiring_area_policies set manager_id=${D},revision=revision+1`;
    else
      await user(
        U,
        (tx) =>
          tx`select hiring_preparation_save(${W},'professional',${r.id},${r.revision},${randomUUID()},${tx.json({ ...form("professional"), status: "ready", ...(change === "reference" ? { reference_value: 33000 } : { title: "Escopo alterado" }) })})`,
      );
    expect((await context(r.id)).status).toBe("superseded");
    await expect(decide(r, a, CEO, "ceo")).rejects.toThrow("REVISION_CONFLICT");
    expect(
      (
        await db`select count(*)::int n from hiring_preparation_approval_events where approval_id=${a} and kind='superseded'`
      )[0].n,
    ).toBe(1);
  }
});
it("approval reference cannot leak in events list context or notifications", async () => {
  await reset();
  const r = await ready(),
    a = await request(r);
  await db`delete from job_role_permission_overrides where role_id=${U} and permission_key like '%.reference.%'`;
  expect(JSON.stringify(await context(r.id))).not.toContain("22000");
  expect(JSON.stringify(await db`select * from hiring_preparation_approval_events`)).not.toContain(
    "22000",
  );
  expect(JSON.stringify(await db`select * from notifications`)).not.toContain("22000");
  expect((await context(r.id)).approval_id).toBe(a);
  await user(U, async (tx) =>
    expect(
      JSON.stringify(await tx`select hiring_preparation_page(${W},'professional','',0)`),
    ).not.toContain("22000"),
  );
});
it("approval denies decision without reference permission", async () => {
  await reset();
  const r = await ready(),
    a = await request(r);
  await db`delete from job_role_permission_overrides where role_id=${M} and permission_key='techpeople.hiring_requests.reference.view.workspace'`;
  await expect(decide(r, a)).rejects.toThrow("condições");
  expect((await context(r.id, M)).can_decide).toBe(false);
});
it("approval concurrent request and retry notify exactly once", async () => {
  await reset();
  const r = await ready();
  const [a, b] = await Promise.all([request(r), request(r)]);
  expect(a).toBe(b);
  expect((await db`select count(*)::int n from notifications`)[0].n).toBe(1);
  const op = randomUUID();
  await Promise.all([
    decide(r, a, M, "manager", "approved", op),
    decide(r, a, M, "manager", "approved", op),
  ]);
  expect((await db`select count(*)::int n from notifications`)[0].n).toBe(2);
  expect((await db`select link from notifications where user_id=${CEO}`)[0].link).toBe(
    `/people/hiring-requests?request=${r.id}`,
  );
  await expect(decide(r, a, M, "manager", "rejected", op)).rejects.toThrow("idempotente");
});
it("approval concurrent conflicting decisions allow one winner", async () => {
  await reset();
  const r = await ready(),
    a = await request(r);
  const result = await Promise.allSettled([decide(r, a), decide(r, a, M, "manager", "rejected")]);
  expect(result.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  expect(
    (
      await db`select count(*)::int n from hiring_preparation_approval_events where approval_id=${a} and stage='manager'`
    )[0].n,
  ).toBe(1);
});
it("approval rejects direct writes and inherited default ACL and immutable history", async () => {
  await reset();
  const r = await ready();
  await request(r);
  await expect(
    user(U, (tx) => tx`update hiring_preparation_approvals set status='approved'`),
  ).rejects.toThrow("permission denied");
  await expect(db`update hiring_preparation_approval_events set note='forged'`).rejects.toThrow(
    "imutável",
  );
  for (const role of ["anon", "service_role", "techerp_request_writer"]) {
    expect(
      (
        await db`select has_function_privilege(${role},'hiring_preparation_approval_route(uuid,uuid)','EXECUTE') v`
      )[0].v,
    ).toBe(false);
    expect(
      (
        await db`select has_function_privilege(${role},'hiring_preparation_approval_request(uuid,text,uuid,integer)','EXECUTE') v`
      )[0].v,
    ).toBe(role === "techerp_request_writer");
  }
  expect(
    (await db`select has_table_privilege('anon','hiring_preparation_approvals','SELECT') v`)[0].v,
  ).toBe(false);
  expect(
    (
      await db`select has_table_privilege('authenticated','hiring_preparation_approvals','UPDATE') v`
    )[0].v,
  ).toBe(false);
});
it("approval rejection requires reason and a new saved revision", async () => {
  await reset();
  const r = await ready(),
    a = await request(r);
  await expect(
    decide(r, a, M, "manager", "rejected", randomUUID(), "professional", ""),
  ).rejects.toThrow("motivo");
  await decide(r, a, M, "manager", "rejected");
  expect((await context(r.id)).status).toBe("rejected");
  await expect(request(r)).rejects.toThrow("nova revisão");
});
it("approval completed cycle is invalidated and a new revision can be requested", async () => {
  await reset();
  const r = await ready(),
    a = await request(r);
  await decide(r, a);
  await decide(r, a, CEO, "ceo");
  const next = await user(U, (tx) =>
    tx`select hiring_preparation_save(${W},'professional',${r.id},${r.revision},${randomUUID()},${tx.json({ ...form("professional"), status: "ready", reference_value: 33000 })}) v`.then(
      (x) => x[0].v,
    ),
  );
  expect((await context(r.id)).status).toBe("superseded");
  const second = await request(next);
  expect(second).not.toBe(a);
  expect((await context(r.id)).status).toBe("pending");
});
it("approval foreign request id is denied even with own workspace keys", async () => {
  await reset();
  const r = await ready();
  await db`update profiles set active_workspace_id=${B} where id=${U}`;
  await db`insert into workspace_members(workspace_id,user_id) values(${B},${U})`;
  const foreignRole = randomUUID();
  await db`insert into job_roles values(${foreignRole},${B})`;
  await db`insert into user_job_roles values(${foreignRole},${U},${B},null)`;
  await db`insert into job_role_permission_overrides select ${B},${foreignRole},key,'grant' from permissions`;
  expect(
    await user(U, (tx) =>
      tx`select hiring_preparation_approval_access(${B},'professional','view') v`.then(
        (x) => x[0].v,
      ),
    ),
  ).toBe(true);
  await expect(
    user(U, (tx) => tx`select hiring_preparation_approval_context(${B},'professional',${r.id},0)`),
  ).rejects.toThrow("indisponível");
});
it("approval concurrent material edit and decision never retains stale approval", async () => {
  await reset();
  const r = await ready(),
    a = await request(r);
  await Promise.allSettled([
    decide(r, a),
    user(
      U,
      (tx) =>
        tx`select hiring_preparation_save(${W},'professional',${r.id},${r.revision},${randomUUID()},${tx.json({ ...form("professional"), status: "ready", title: "Nova revisão" })})`,
    ),
  ]);
  expect((await context(r.id)).status).toBe("superseded");
  await expect(decide(r, a, CEO, "ceo")).rejects.toThrow("REVISION_CONFLICT");
});
