import { beforeAll, afterAll, it, expect } from "vitest";
import postgres from "postgres";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
const useNative = process.platform === "darwin" && process.env.TECHERP_NATIVE_PG === "1";
const pgBin = "/Applications/Postgres.app/Contents/Versions/16/bin/";
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
  root = mkdtempSync(join(tmpdir(), "hiring-preparation-pg-"));
  if (useNative) {
    execFileSync(
      pgBin + "initdb",
      [
        "-D",
        join(root, "data"),
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
        join(root, "data"),
        "-l",
        join(root, "server.log"),
        "-o",
        `-k ${root} -h '' -F`,
        "-w",
        "start",
      ],
      { stdio: "pipe", timeout: 30000 },
    );
    started = true;
    db = postgres({
      host: root,
      port: 5432,
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
    execFileSync(pgBin + "pg_ctl", ["-D", join(root, "data"), "-m", "fast", "-w", "stop"], {
      stdio: "pipe",
      timeout: 15000,
    });
  if (started && !useNative) dockerRun("rm", "-f", container);
  if (root) rmSync(root, { recursive: true, force: true });
});
async function reset() {
  await db.unsafe(
    "TRUNCATE hiring_preparation_reference_events,hiring_preparation_reference_values,hiring_preparation_events,hiring_preparation_requests,workspaces,profiles,workspace_members,user_job_roles,job_roles,job_role_permission_overrides,user_permission_sets,permission_sets,permission_set_items,user_groups,legal_entities,people,companies,contacts,deals,projects,contracts CASCADE",
  );
  await db`insert into workspaces(id) values(${W}),(${B})`;
  await db`insert into profiles values(${U},${W})`;
  await db`insert into workspace_members(workspace_id,user_id) values(${W},${U})`;
  await db`insert into job_roles values(${A},${W})`;
  await db`insert into user_job_roles values(${A},${U},${W},null)`;
  await db`insert into job_role_permission_overrides select ${W},${A},key,'grant' from permissions`;
  await db`insert into user_groups values(${A},${W},'Área Técnica')`;
  await db`insert into legal_entities(id,workspace_id,name) values(${L},${W},'WK fixture')`;
  await db`insert into companies(id,workspace_id,name) values(${C},${W},'Fornecedor fixture')`;
}
async function user<T>(fn: (tx: postgres.TransactionSql) => Promise<T>) {
  return db.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims',${JSON.stringify({ sub: U, role: "authenticated" })},true)`;
    await tx.unsafe("SET LOCAL ROLE authenticated");
    return fn(tx);
  });
}
const form = (kind = "professional") => ({
  title: "Preparação fixture",
  scope_text: "Escopo aprovado para revisão",
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
  modality: "delivery",
  release_condition: kind === "supplier" ? "wk_acceptance_invoice" : null,
});
const save = (
  tx: postgres.TransactionSql,
  kind: string,
  data: object,
  id: string | null = null,
  revision = 0,
  op = randomUUID(),
) =>
  tx`select hiring_preparation_save(${W},${kind},${id},${revision},${op},${tx.json(data as postgres.JSONValue)}) as result`.then(
    (rows) => rows[0].result,
  );
async function blocked() {
  for (const kind of ["professional", "supplier"]) {
    await expect(user((tx) => save(tx, kind, form(kind)))).rejects.toThrow();
    await expect(
      user((tx) => tx`select hiring_preparation_page(${W},${kind},'',0)`),
    ).rejects.toThrow();
    await user(async (tx) => {
      expect((await tx`select count(*)::int as n from hiring_preparation_requests`)[0].n).toBe(0);
    });
  }
}
it("preparation allows authorized active member", async () => {
  await reset();
  for (const kind of ["professional", "supplier"]) {
    const r = await user((tx) => save(tx, kind, form(kind)));
    expect(r.status).toBe("draft");
    expect(r.revision).toBe(1);
    expect(
      await user((tx) =>
        tx`select hiring_preparation_page(${W},${kind},'',0) as rows`.then((v) => v[0].rows),
      ),
    ).toHaveLength(1);
  }
});
it("preparation rejects missing permission", async () => {
  await reset();
  await db`delete from job_role_permission_overrides`;
  expect((await db`select count(*)::int n from job_role_permission_overrides`)[0].n).toBe(0);
  await blocked();
});
it("preparation rejects explicit deny", async () => {
  await reset();
  await db`insert into job_role_permission_overrides select ${W},${A},key,'deny' from permissions`;
  expect(
    (await db`select count(*)::int n from job_role_permission_overrides where effect='deny'`)[0].n,
  ).toBe(12);
  await blocked();
});
it("preparation rejects foreign workspace", async () => {
  await reset();
  await db`update profiles set active_workspace_id=${B} where id=${U}`;
  expect(
    (await db`select active_workspace_id from profiles where id=${U}`)[0].active_workspace_id,
  ).toBe(B);
  await blocked();
});
it("preparation rejects inactive member", async () => {
  await reset();
  await db`update workspace_members set status='inactive' where user_id=${U}`;
  expect((await db`select status from workspace_members where user_id=${U}`)[0].status).toBe(
    "inactive",
  );
  await blocked();
});
it("preparation transitions draft ready draft cancelled without approval", async () => {
  await reset();
  let r = await user((tx) => save(tx, "professional", form()));
  for (const status of ["ready", "draft", "cancelled"]) {
    r = await user((tx) => save(tx, "professional", { ...form(), status }, r.id, r.revision));
    expect(r.status).toBe(status);
  }
  await expect(user((tx) => save(tx, "professional", form(), r.id, r.revision))).rejects.toThrow(
    "cancelada",
  );
  expect((await db`select count(*)::int n from hiring_preparation_events`)[0].n).toBe(4);
});
it("preparation rejects incomplete ready and approval statuses", async () => {
  await reset();
  const r = await user((tx) => save(tx, "professional", form()));
  await expect(
    user((tx) => save(tx, "professional", { ...form(), area_id: null, status: "ready" }, r.id, 1)),
  ).rejects.toThrow();
  await expect(
    user((tx) => save(tx, "professional", { ...form(), status: "approved" }, r.id, 1)),
  ).rejects.toThrow();
});
it("preparation retries idempotently and rejects reused payload", async () => {
  await reset();
  const op = randomUUID();
  const a = await user((tx) => save(tx, "professional", form(), null, 0, op));
  const b = await user((tx) => save(tx, "professional", form(), null, 0, op));
  expect(b.id).toBe(a.id);
  expect((await db`select count(*)::int n from hiring_preparation_events`)[0].n).toBe(1);
  await expect(
    user((tx) => save(tx, "professional", { ...form(), title: "Other" }, null, 0, op)),
  ).rejects.toThrow("idempotente");
});
it("preparation concurrent edits permit exactly one revision", async () => {
  await reset();
  const r = await user((tx) => save(tx, "professional", form()));
  const results = await Promise.allSettled([
    user((tx) => save(tx, "professional", { ...form(), title: "A" }, r.id, 1)),
    user((tx) => save(tx, "professional", { ...form(), title: "B" }, r.id, 1)),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  expect((await db`select revision from hiring_preparation_requests`)[0].revision).toBe(2);
});
it("preparation concurrent same operation creates exactly once", async () => {
  await reset();
  const op = randomUUID();
  const results = await Promise.all([
    user((tx) => save(tx, "professional", form(), null, 0, op)),
    user((tx) => save(tx, "professional", form(), null, 0, op)),
  ]);
  expect(results[0].id).toBe(results[1].id);
  expect((await db`select count(*)::int n from hiring_preparation_requests`)[0].n).toBe(1);
});
it("preparation denies direct writes public RPC and immutable history edits", async () => {
  await reset();
  const r = await user((tx) => save(tx, "professional", form()));
  await expect(
    user((tx) => tx`update hiring_preparation_requests set title='forged' where id=${r.id}`),
  ).rejects.toThrow("permission denied");
  await expect(db`update hiring_preparation_events set snapshot='{}'`).rejects.toThrow("imutável");
  expect(
    (
      await db`select has_function_privilege('anon','hiring_preparation_save(uuid,text,uuid,integer,uuid,jsonb)','execute') as v`
    )[0].v,
  ).toBe(false);
  expect(
    (
      await db`select rolbypassrls,rolcanlogin from pg_roles where rolname='techerp_request_writer'`
    )[0],
  ).toEqual({ rolbypassrls: false, rolcanlogin: false });
});
it("preparation rejects foreign references and divergent client legal entity", async () => {
  await reset();
  const foreign = randomUUID(),
    deal = randomUUID();
  await db`insert into companies(id,workspace_id,name) values(${foreign},${B},'Foreign')`;
  await expect(
    user((tx) => save(tx, "supplier", { ...form("supplier"), company_id: foreign })),
  ).rejects.toThrow("Empresa");
  await db`insert into deals(id,workspace_id,name,legal_entity_id) values(${deal},${W},'Origem',${foreign})`;
  await expect(
    user((tx) => save(tx, "professional", { ...form(), purpose: "client", deal_id: deal })),
  ).rejects.toThrow("diverge");
});
it("preparation never returns or accepts financial fields", async () => {
  await reset();
  const r = await user((tx) => save(tx, "professional", form()));
  expect(Object.keys(r)).not.toContain("salary");
  expect(Object.keys(r)).not.toContain("budget");
  await expect(user((tx) => save(tx, "professional", { ...form(), salary: 1000 }))).rejects.toThrow(
    "sensíveis",
  );
});
it("preparation cancellation cannot change title with cancel-only permission", async () => {
  await reset();
  const r = await user((tx) => save(tx, "professional", form()));
  await db`delete from job_role_permission_overrides where permission_key='techpeople.hiring_requests.update.workspace'`;
  await expect(
    user((tx) =>
      save(tx, "professional", { ...form(), status: "cancelled", title: "forged" }, r.id, 1),
    ),
  ).rejects.toThrow("outros campos");
  const cancelled = await user((tx) =>
    save(tx, "professional", { ...form(), status: "cancelled" }, r.id, 1),
  );
  expect(cancelled.status).toBe("cancelled");
});
it("preparation requires a commercial origin before ready for a client", async () => {
  await reset();
  for (const kind of ["professional", "supplier"]) {
    const data = { ...form(kind), purpose: "client" };
    const r = await user((tx) => save(tx, kind, data));
    await expect(
      user((tx) => save(tx, kind, { ...data, status: "ready" }, r.id, r.revision)),
    ).rejects.toThrow("Associe");
    const deal = randomUUID();
    await db`insert into deals(id,workspace_id,name,legal_entity_id) values(${deal},${W},'Origem teste',${L})`;
    const ready = await user((tx) =>
      save(tx, kind, { ...data, status: "ready", deal_id: deal }, r.id, r.revision),
    );
    expect(ready.status).toBe("ready");
  }
});
it("preparation registers canonical permission modules and revokes writer schema creation", async () => {
  expect(
    (
      await db`select count(*)::int n from permissions where key like 'techpeople.hiring_requests.%' and module='techpeople' and resource in ('hiring_requests','hiring_requests.cancel')`
    )[0].n,
  ).toBe(4);
  expect(
    (
      await db`select count(*)::int n from permissions where key like 'techcontracts.supplier_requests.%' and module='techcontracts' and resource in ('supplier_requests','supplier_requests.cancel')`
    )[0].n,
  ).toBe(4);
  expect(
    (await db`select has_schema_privilege('techerp_request_writer','public','CREATE') as v`)[0].v,
  ).toBe(false);
});

it("preparation reference is absent from list history save and direct tables", async () => {
  await reset();
  const r = await user((tx) =>
    save(tx, "supplier", { ...form("supplier"), reference_value: 12345.67 }),
  );
  expect(r).not.toHaveProperty("reference_value");
  const amount = await user(
    (tx) => tx`select hiring_preparation_reference(${W},'supplier',${r.id}) as v`,
  );
  expect(amount[0].v.reference_value).toBe(12345.67);
  const page = await user((tx) => tx`select hiring_preparation_page(${W},'supplier','',0) as v`);
  expect(JSON.stringify(page)).not.toContain("12345.67");
  const history = await user(
    (tx) => tx`select hiring_preparation_history(${W},'supplier',${r.id},0) as v`,
  );
  expect(JSON.stringify(history)).not.toContain("12345.67");
  await expect(user((tx) => tx`select * from hiring_preparation_reference_values`)).rejects.toThrow(
    "permission denied",
  );
  await user(async (tx) => {
    const events = await tx`select payload,snapshot from hiring_preparation_events`;
    expect(JSON.stringify(events)).not.toContain("12345.67");
  });
});
it("preparation reference denies missing specific permission and preserves amount on ordinary edit", async () => {
  await reset();
  const r = await user((tx) => save(tx, "professional", { ...form(), reference_value: 22000 }));
  await db`delete from job_role_permission_overrides where permission_key like '%.reference.%'`;
  await expect(
    user((tx) => tx`select hiring_preparation_reference(${W},'professional',${r.id})`),
  ).rejects.toThrow("Sem permissão");
  await expect(
    user((tx) => save(tx, "professional", { ...form(), reference_value: 1 }, r.id, 1)),
  ).rejects.toThrow("Sem permissão");
  await user((tx) => save(tx, "professional", { ...form(), title: "Edited" }, r.id, 1));
  expect(
    (await db`select reference_value from hiring_preparation_reference_values`)[0].reference_value,
  ).toBe("22000.00");
});
it("reference rejects explicit deny", async () => {
  await reset();
  const r = await user((tx) => save(tx, "professional", { ...form(), reference_value: 100 }));
  await db`insert into job_role_permission_overrides values(${W},${A},'techpeople.hiring_requests.reference.view.workspace','deny')`;
  await expect(
    user((tx) => tx`select hiring_preparation_reference(${W},'professional',${r.id})`),
  ).rejects.toThrow("Sem permissão");
});
it("reference rejects foreign workspace", async () => {
  await reset();
  const r = await user((tx) => save(tx, "professional", { ...form(), reference_value: 100 }));
  await db`update profiles set active_workspace_id=${B}`;
  await expect(
    user((tx) => tx`select hiring_preparation_reference(${W},'professional',${r.id})`),
  ).rejects.toThrow("Sem permissão");
});
it("reference rejects inactive member", async () => {
  await reset();
  const r = await user((tx) => save(tx, "professional", { ...form(), reference_value: 100 }));
  await db`update workspace_members set status='inactive'`;
  await expect(
    user((tx) => tx`select hiring_preparation_reference(${W},'professional',${r.id})`),
  ).rejects.toThrow("Sem permissão");
});
it("preparation selection defined requires real person and never opens recruitment", async () => {
  await reset();
  const r = await user((tx) => save(tx, "professional", form()));
  await expect(
    user((tx) =>
      save(tx, "professional", { ...form(), selection_mode: "defined", status: "ready" }, r.id, 1),
    ),
  ).rejects.toThrow("pessoa real");
  const ready = await user((tx) =>
    save(tx, "professional", { ...form(), status: "ready" }, r.id, 1),
  );
  expect(ready.selection_mode).toBe("needs_selection");
  expect(ready.status).toBe("ready");
});
it("preparation accepts four modalities and supplier release conditions only as draft terms", async () => {
  await reset();
  let r = await user((tx) => save(tx, "supplier", form("supplier")));
  for (const modality of ["delivery", "hourly", "monthly", "mixed"]) {
    r = await user((tx) =>
      save(
        tx,
        "supplier",
        { ...form("supplier"), modality, release_condition: "also_client_acceptance" },
        r.id,
        r.revision,
      ),
    );
    expect(r.modality).toBe(modality);
    expect(r.release_condition).toBe("also_client_acceptance");
    expect(r.status).toBe("draft");
  }
});
it("preparation sensitive idempotency rejects changed amount and immutable input cannot be edited", async () => {
  await reset();
  const operation = randomUUID();
  const a = await user((tx) =>
    save(tx, "professional", { ...form(), reference_value: 50 }, null, 0, operation),
  );
  const b = await user((tx) =>
    save(tx, "professional", { ...form(), reference_value: 50 }, null, 0, operation),
  );
  expect(a.id).toBe(b.id);
  await expect(
    user((tx) => save(tx, "professional", { ...form(), reference_value: 60 }, null, 0, operation)),
  ).rejects.toThrow("valor diferente");
  await expect(db`update hiring_preparation_reference_events set input='{}'`).rejects.toThrow(
    "imutável",
  );
});

it("preparation keeps exceptional supplier release conditions as draft", async () => {
  await reset();
  const data = { ...form("supplier"), release_condition: "also_client_acceptance" };
  const r = await user((tx) => save(tx, "supplier", data));
  expect(r.status).toBe("draft");
  await expect(
    user((tx) => save(tx, "supplier", { ...data, status: "ready" }, r.id, r.revision)),
  ).rejects.toThrow("Condição especial");
});

it("preparation revokes inherited default table grants from anonymous and authenticated roles", async () => {
  for (const table of [
    "hiring_preparation_requests",
    "hiring_preparation_events",
    "hiring_preparation_reference_values",
    "hiring_preparation_reference_events",
  ]) {
    expect((await db`select has_table_privilege('anon',${table},'SELECT') as v`)[0].v).toBe(false);
    expect(
      (await db`select has_table_privilege('authenticated',${table},'INSERT') as v`)[0].v,
    ).toBe(false);
    expect(
      (await db`select has_table_privilege('authenticated',${table},'UPDATE') as v`)[0].v,
    ).toBe(false);
  }
  expect(
    (
      await db`select has_table_privilege('authenticated','hiring_preparation_reference_values','SELECT') as v`
    )[0].v,
  ).toBe(false);
});
