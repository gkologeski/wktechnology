import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import postgres from "postgres";
import type { SupabaseClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { disposablePostgresStorageArgs } from "../../../tests/fixtures/disposable-postgres-storage";
import { loadNotificationBusinessFunction as loadFunction } from "../../../tests/fixtures/notification-business-events";

const engineBoundary = vi.hoisted(() => ({
  authorize: vi.fn(),
  hydrate: vi.fn(),
  lineItems: vi.fn(),
  actions: vi.fn(),
}));
vi.mock("./engine/authorization.server", async () => ({
  ...(await vi.importActual<typeof import("./engine/authorization.server")>(
    "./engine/authorization.server",
  )),
  authorizeWorkflowStep: engineBoundary.authorize,
}));
vi.mock("./hydrate-associations.server", () => ({
  hydrateTriggerAssociations: engineBoundary.hydrate,
}));
vi.mock("./line-items.server", () => ({ hydrateDealLineItems: engineBoundary.lineItems }));
vi.mock("./engine-actions.server", () => ({ runActions: engineBoundary.actions }));
import { processEvent, type EventRow } from "./engine-runtime.server";

// Actual producer/backfill SQL in a fresh local PostgreSQL. There are no configured
// database URLs, real users, provider calls or production writes. The two engine
// cases mock authorization/hydration and replace external actions with a SQL-only
// synthetic effect. They verify enrollment/idempotency, never application RBAC.
const docker =
  process.platform === "darwin"
    ? "/Applications/Docker.app/Contents/Resources/bin/docker"
    : "docker";
const image = "postgres@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b";
const container = "techerp-workflow-foundation-ci-" + randomUUID();
const migration = readFileSync("drizzle/migrations/0404_workflow_event_foundation.sql", "utf8");
const legacyMigration =
  "supabase/migrations/20260519142118_ff1c3148-ad37-4003-b212-f1e9ae1ae778.sql";
const canonicalMigration =
  "supabase/migrations/20260519165357_5278b800-678a-4926-b3cc-f9ca77e0ecf3.sql";
const crm = ["leads", "contacts", "companies", "deals"] as const;
const W = "184b9435-0a9b-4334-9e89-8854dc883f5d";
const B = "a2000000-0000-4000-8000-000000000002";
const U = "b2000000-0000-4000-8000-000000000001";
const V = "b2000000-0000-4000-8000-000000000002";
const row = "c2000000-0000-4000-8000-000000000001";
let endpoint = "",
  temporary = "",
  started = false;
let db: ReturnType<typeof postgres>;
let doubleEventBaseline = 0;
let originalFunction: Record<string, unknown>;
const dockerRun = (...args: string[]) =>
  execFileSync(docker, ["--host", endpoint, ...args], {
    encoding: "utf8",
    timeout: 90000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
function sourceTrigger(file: string, name: string) {
  const source = readFileSync(file, "utf8");
  const match = new RegExp(`create\\s+trigger\\s+${name}\\s[^;]+;`, "i").exec(source);
  if (!match) throw Error("Missing production trigger " + name);
  return match[0];
}
const functionMetadata = () =>
  db`select oid,proowner,proacl,prosecdef,proconfig from pg_proc
     where oid='public.enqueue_workflow_event()'::regprocedure`;

/** Minimal Supabase shape backed by real SQL, including the enrollment join and
 * the physical run uniqueness constraint. Unsupported operations fail loudly. */
function engineDatabase(): SupabaseClient {
  type Row = Record<string, unknown>;
  const tables = new Set(["workflows", "workflow_runs", "workflow_events"]);
  const jsonFields = new Set(["trigger", "actions", "goal_filters", "before", "after", "log"]);
  const identifier = (name: string) => {
    if (!/^[a-z_]+$/.test(name)) throw Error("Unexpected engine fixture column " + name);
    return '"' + name + '"';
  };
  return {
    from(table: string) {
      if (!tables.has(table)) throw Error("Unexpected engine fixture table " + table);
      let operation = "select",
        columns = "",
        payload: Row = {},
        maxRows: number | undefined;
      const filters: Array<[string, unknown]> = [];
      let pending:
        | Promise<{ data: Row[] | null; error: { code: string; message: string } | null }>
        | undefined;
      const execute = () => {
        pending ??= (async () => {
          const params: Array<string | number | boolean | null> = [];
          const parameter = (value: unknown, field: string) => {
            params.push(
              value === null
                ? null
                : jsonFields.has(field)
                  ? JSON.stringify(value)
                  : (value as string | number | boolean),
            );
            return "$" + params.length + (jsonFields.has(field) ? "::jsonb" : "");
          };
          const joined = columns.includes("workflow_events!inner");
          if (joined && table !== "workflow_runs") throw Error("Unexpected engine fixture join");
          const where = () =>
            filters.length
              ? " WHERE " +
                filters
                  .map(([field, value]) => {
                    const [prefix, nested] = field.split(".");
                    const name = nested ?? prefix;
                    if (nested && (!joined || prefix !== "workflow_events"))
                      throw Error("Unexpected engine fixture relation " + field);
                    return (nested ? "e." : "r.") + identifier(name) + "=" + parameter(value, name);
                  })
                  .join(" AND ")
              : "";
          let query: string;
          if (operation === "select") {
            query =
              "SELECT r.* FROM public." +
              identifier(table) +
              " r" +
              (joined ? " JOIN public.workflow_events e ON e.id=r.event_id" : "") +
              where() +
              (maxRows === undefined ? "" : " LIMIT " + maxRows);
          } else if (operation === "insert") {
            const fields = Object.keys(payload);
            query =
              "INSERT INTO public." +
              identifier(table) +
              " (" +
              fields.map(identifier).join(",") +
              ") VALUES (" +
              fields.map((field) => parameter(payload[field], field)).join(",") +
              ") RETURNING *";
          } else {
            query =
              "UPDATE public." +
              identifier(table) +
              " r SET " +
              Object.entries(payload)
                .map(([field, value]) => identifier(field) + "=" + parameter(value, field))
                .join(",") +
              where() +
              " RETURNING r.*";
          }
          try {
            return { data: [...(await db.unsafe(query, params))] as Row[], error: null };
          } catch (error) {
            const failure = error as { code?: string; message: string };
            if (failure.code !== "23505") throw error;
            return { data: null, error: { code: failure.code, message: failure.message } };
          }
        })();
        return pending;
      };
      const query = {
        select(value: string) {
          columns = value;
          return query;
        },
        eq(field: string, value: unknown) {
          filters.push([field, value]);
          return query;
        },
        limit(value: number) {
          if (!Number.isSafeInteger(value) || value < 1) throw Error("Invalid fixture limit");
          maxRows = value;
          return query;
        },
        insert(value: Row) {
          operation = "insert";
          payload = value;
          return query;
        },
        update(value: Row) {
          operation = "update";
          payload = value;
          return query;
        },
        async single() {
          const result = await execute();
          return { ...result, data: result.data?.[0] ?? null };
        },
        then(
          resolve: (value: Awaited<ReturnType<typeof execute>>) => unknown,
          reject: (reason: unknown) => unknown,
        ) {
          return execute().then(resolve, reject);
        },
      };
      return query;
    },
  } as unknown as SupabaseClient;
}

beforeAll(async () => {
  if (process.platform === "darwin" && !existsSync(docker))
    throw Error("Docker Desktop is required for mandatory Workflow SQL tests.");
  endpoint = execFileSync(
    docker,
    ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"],
    { encoding: "utf8", timeout: 10000 },
  ).trim();
  if (!endpoint.startsWith("unix://")) throw Error("Only a local Unix Docker socket is allowed.");
  temporary = mkdtempSync(join(tmpdir(), "techerp-workflow-foundation-ci-"));
  const password = randomUUID() + randomUUID();
  const envFile = join(temporary, "postgres.env");
  writeFileSync(envFile, "POSTGRES_DB=techerp_workflow_ci\nPOSTGRES_PASSWORD=" + password + "\n", {
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
    ...disposablePostgresStorageArgs,
    "-p",
    "127.0.0.1::5432",
    image,
    "-c",
    "fsync=off",
  );
  started = true;
  const mapped = dockerRun("port", container, "5432/tcp");
  if (!/^127\.0\.0\.1:\d+$/.test(mapped)) throw Error("Unexpected disposable PostgreSQL binding");
  db = postgres({
    host: "127.0.0.1",
    port: Number(mapped.split(":")[1]),
    database: "techerp_workflow_ci",
    username: "postgres",
    password,
    max: 2,
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
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  if (!ready) throw Error("Disposable PostgreSQL did not become ready");
  await db.unsafe(readFileSync("tests/fixtures/workflow-event-foundation.sql", "utf8"));
  await loadFunction(
    db,
    "drizzle/migrations/0142_crm_cargo_porte_derivation.sql",
    "crm_is_derivation_backfill",
  );
  await loadFunction(
    db,
    "drizzle/migrations/0169_techprojects_cycle1_reconciliation.sql",
    "project_is_link_backfill",
  );
  await loadFunction(
    db,
    "drizzle/migrations/0169_techprojects_cycle1_reconciliation.sql",
    "enqueue_workflow_event",
  );
  // Deliberately non-default ACL verifies the replacement preserves the existing
  // function boundary instead of silently expanding it through re-creation.
  await db.unsafe(
    "REVOKE ALL ON FUNCTION public.enqueue_workflow_event() FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.enqueue_workflow_event() TO service_role;",
  );
  for (const table of crm) {
    await db.unsafe(sourceTrigger(legacyMigration, table + "_wf_event"));
    await db.unsafe(sourceTrigger(canonicalMigration, "trg_wf_events_" + table));
  }
  for (const table of [
    "project_tasks",
    "projects",
    "project_milestones",
    "ats_applications",
    "tickets",
    "recurring_plans",
  ])
    await db.unsafe(
      `CREATE TRIGGER trg_wf_events_${table} AFTER INSERT OR UPDATE ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.enqueue_workflow_event('${table}')`,
    );
  await db`insert into workspaces(id,created_by) values(${W},${U}),(${B},${V})`;
  await db`insert into leads(id,workspace_id,owner_id) values(${row},${W},${U})`;
  doubleEventBaseline = (await db`select count(*)::int n from workflow_events`)[0].n;
  await db`truncate workflow_events,leads`;
  [originalFunction] = await functionMetadata();
  await db.begin((tx) => tx.unsafe(migration));
}, 60000);

afterAll(async () => {
  if (db) await db.end();
  if (started) dockerRun("rm", "-f", "-v", container);
  if (temporary) rmSync(temporary, { recursive: true, force: true });
});
beforeEach(async () => {
  vi.clearAllMocks();
  engineBoundary.authorize.mockResolvedValue(undefined);
  engineBoundary.hydrate.mockImplementation(async (_db, _entity, after) => after);
  engineBoundary.lineItems.mockImplementation(async (_db, _entity, after) => after);
  await db`truncate workflow_test_effects,workflow_runs,workflows,workflow_events,leads,contacts,companies,deals,project_tasks,projects,project_milestones,ats_applications,tickets,recurring_plans`;
});

it("reproduces the historical duplicate emitter and leaves one canonical active trigger on each CRM source", async () => {
  expect(doubleEventBaseline).toBe(2);
  const triggers =
    await db`select c.relname,t.tgname from pg_trigger t join pg_class c on c.oid=t.tgrelid
    where t.tgfoid='public.enqueue_workflow_event()'::regprocedure and c.relname=any(${crm})
      and not t.tgisinternal and t.tgenabled<>'D' order by c.relname`;
  expect(triggers).toEqual(
    [...crm].sort().map((table) => ({ relname: table, tgname: "trg_wf_events_" + table })),
  );
});

it("emits exactly one created or updated event for each of the four CRM row mutations", async () => {
  for (const table of crm) {
    const id = randomUUID();
    await db.unsafe(
      `insert into public.${table}(id,workspace_id,owner_id,title) values($1,$2,$3,'Initial')`,
      [id, W, U],
    );
    await db.unsafe(`update public.${table} set title='Edited' where id=$1`, [id]);
    const events =
      await db`select event_type,before,after,workspace_id,owner_id,entity from workflow_events where entity_id=${id} order by event_type`;
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      event_type: "created",
      before: null,
      after: { id, title: "Initial" },
      workspace_id: W,
      owner_id: U,
      entity: table,
    });
    expect(events[1]).toMatchObject({
      event_type: "updated",
      before: { title: "Initial" },
      after: { title: "Edited" },
      workspace_id: W,
    });
  }
});

it.each([false, true])(
  "runs one synthetic engine effect per real event and honors reenrollment=%s",
  async (reenroll) => {
    const workflowId = randomUUID();
    await db`insert into workflows(id,workspace_id,owner_id,entity,enabled,status,trigger,actions)
      values(${workflowId},${W},${U},'leads',true,'published',
        ${db.json({ filters: [], reenroll: { enabled: reenroll, events: ["created", "updated"] } })},
        '[{"type":"send_notification","title":"Synthetic effect; no send"}]')`;
    engineBoundary.actions.mockImplementation(async (_client, _actions, context) => {
      await db`insert into workflow_test_effects(run_id,workflow_id,workspace_id,entity_id,snapshot)
        values(${context.runId},${context.workflowId},${context.workspaceId},${context.entityId},${db.json(context.after)})`;
      return { log: [], hadError: false };
    });
    const client = engineDatabase();
    await db`insert into leads(id,workspace_id,owner_id,title) values(${row},${W},${U},'Initial')`;
    const [created] = await db`select * from workflow_events where entity_id=${row}`;
    expect(created.event_type).toBe("created");
    await processEvent(client, created as EventRow);
    // Same persisted delivery must not run the synthetic action a second time.
    // With reenroll=true this reaches the actual unique(workflow_id,event_id).
    await processEvent(client, created as EventRow);
    expect(await db`select id from workflow_test_effects`).toHaveLength(1);
    expect(await db`select status,finished_at is not null as finished from workflow_runs`).toEqual([
      { status: "success", finished: true },
    ]);

    await db`update leads set title='Edited' where id=${row}`;
    const [updated] =
      await db`select * from workflow_events where entity_id=${row} and event_type='updated'`;
    expect(updated.id).not.toBe(created.id);
    await processEvent(client, updated as EventRow);
    await processEvent(client, updated as EventRow);
    const expected = reenroll ? 2 : 1;
    expect(await db`select id from workflow_runs`).toHaveLength(expected);
    expect(await db`select id from workflow_test_effects`).toHaveLength(expected);
    expect(engineBoundary.actions).toHaveBeenCalledTimes(expected);
    expect(
      await db`select count(*)::int n from workflow_events where processed_at is not null`,
    ).toEqual([{ n: 2 }]);
    expect(
      await db`select workspace_id,entity_id,snapshot->>'title' title from workflow_test_effects order by snapshot->>'title'`,
    ).toEqual(
      reenroll
        ? [
            { workspace_id: W, entity_id: row, title: "Edited" },
            { workspace_id: W, entity_id: row, title: "Initial" },
          ]
        : [{ workspace_id: W, entity_id: row, title: "Initial" }],
    );
  },
);

it("classifies both real task status and custom status transitions as a single stage change", async () => {
  const status = randomUUID();
  expect(
    await db`select attname from pg_attribute where attrelid='project_tasks'::regclass and attname='status_id'`,
  ).toHaveLength(0);
  await db`insert into project_tasks(id,workspace_id,owner_id) values(${row},${W},${U})`;
  await db`update project_tasks set status='in_progress' where id=${row}`;
  await db`update project_tasks set custom_status_id=${status} where id=${row}`;
  await db`update project_tasks set custom_status_id=null,status='done' where id=${row}`;
  const stages =
    await db`select before,after from workflow_events where entity_id=${row} and event_type='stage_changed'`;
  expect(stages).toHaveLength(3);
  expect(stages).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        before: expect.objectContaining({ status: "todo" }),
        after: expect.objectContaining({ status: "in_progress" }),
      }),
      expect.objectContaining({
        before: expect.objectContaining({ custom_status_id: null }),
        after: expect.objectContaining({ custom_status_id: status }),
      }),
      expect.objectContaining({
        before: expect.objectContaining({ custom_status_id: status }),
        after: expect.objectContaining({ custom_status_id: null, status: "done" }),
      }),
    ]),
  );
  expect(await db`select id from workflow_events where entity_id=${row}`).toHaveLength(4);
});

it("keeps title-only and no-op task updates as ordinary updates without inventing stage transitions", async () => {
  await db`insert into project_tasks(id,workspace_id,owner_id) values(${row},${W},${U})`;
  await db`update project_tasks set title='Other text' where id=${row}`;
  await db`update project_tasks set status=status,custom_status_id=custom_status_id where id=${row}`;
  expect(await db`select id from workflow_events where event_type='stage_changed'`).toHaveLength(0);
  expect(await db`select id from workflow_events where event_type='updated'`).toHaveLength(2);
});

it("preserves generic stage semantics on deals, projects, milestones, ATS applications, tickets and recurring plans", async () => {
  const cases = [
    ["deals", "stage", "won"],
    ["projects", "status", "active"],
    ["project_milestones", "status", "completed"],
    ["ats_applications", "stage_value", "interview"],
    ["tickets", "status", "resolved"],
    ["recurring_plans", "active", false],
  ] as const;
  for (const [table, field, value] of cases) {
    const id = randomUUID();
    await db.unsafe(`insert into public.${table}(id,workspace_id,owner_id) values($1,$2,$3)`, [
      id,
      W,
      U,
    ]);
    await db.unsafe(`update public.${table} set ${field}=$1 where id=$2`, [value, id]);
    expect(
      await db`select event_type from workflow_events where entity_id=${id} and event_type='stage_changed'`,
    ).toEqual([{ event_type: "stage_changed" }]);
  }
});

it("preserves workspace and owner payloads across tenants and keeps workspace-creator fallback", async () => {
  const foreign = randomUUID();
  await db`insert into contacts(id,workspace_id,owner_id) values(${row},${W},${U}),(${foreign},${B},null)`;
  const events =
    await db`select workspace_id,owner_id,after->>'workspace_id' as payload_workspace from workflow_events order by workspace_id`;
  expect(events).toEqual(
    expect.arrayContaining([
      { workspace_id: W, owner_id: U, payload_workspace: W },
      { workspace_id: B, owner_id: V, payload_workspace: B },
    ]),
  );
  await db`insert into contacts(workspace_id,owner_id) values(null,null)`;
  expect(await db`select id from workflow_events`).toHaveLength(2);
});

it("preserves the narrow CRM derivation-backfill suppression without suppressing real user or business edits", async () => {
  await db`insert into leads(id,workspace_id,owner_id,title) values(${row},${W},${U},'Initial')`;
  await db`truncate workflow_events`;
  await db.begin(async (tx) => {
    await tx`select set_config('app.crm_derivation_backfill','wk-2026-10-16',true)`;
    await tx`update leads set job_title='Derived' where id=${row}`;
    expect(await tx`select id from workflow_events`).toHaveLength(0);
    await tx`update leads set title='Real business edit' where id=${row}`;
    expect(await tx`select id from workflow_events`).toHaveLength(1);
    await tx`select set_config('request.jwt.claim.sub',${U},true)`;
    await tx`update leads set job_title='User edit' where id=${row}`;
    expect(await tx`select id from workflow_events`).toHaveLength(2);
  });
});

it("preserves the project-link backfill guard while emitting a simultaneous project status change", async () => {
  await db`insert into projects(id,workspace_id,owner_id,status) values(${row},${W},${U},'planning')`;
  await db`truncate workflow_events`;
  await db.begin(async (tx) => {
    await tx`select set_config('app.project_link_backfill','on',true)`;
    await tx`update projects set company_id=${randomUUID()} where id=${row}`;
    expect(await tx`select id from workflow_events`).toHaveLength(0);
    await tx`update projects set company_id=${randomUUID()},status='active' where id=${row}`;
    expect(await tx`select event_type from workflow_events`).toEqual([
      { event_type: "stage_changed" },
    ]);
  });
});

it("preserves function OID, owner, SECURITY DEFINER configuration and pre-existing execute ACL", async () => {
  expect((await functionMetadata())[0]).toEqual(originalFunction);
  expect(
    await db`select has_function_privilege('authenticated','public.enqueue_workflow_event()','EXECUTE') as allowed`,
  ).toEqual([{ allowed: false }]);
  expect(
    await db`select has_function_privilege('service_role','public.enqueue_workflow_event()','EXECUTE') as allowed`,
  ).toEqual([{ allowed: true }]);
});

it("does not rewrite historical events or runs and is safe to apply to already consolidated trigger metadata", async () => {
  await db`insert into leads(id,workspace_id,owner_id) values(${row},${W},${U})`;
  const [event] = await db`select * from workflow_events`;
  await db`insert into workflow_runs(event_id,status,log) values(${event.id},'finished','[{"effect":"already done"}]')`;
  const runs = await db`select * from workflow_runs`;
  await db.begin((tx) => tx.unsafe(migration));
  expect(await db`select * from workflow_events`).toEqual([event]);
  expect(await db`select * from workflow_runs`).toEqual(runs);
});

it("renames a single known legacy producer instead of creating a duplicate or losing events", async () => {
  await db.unsafe("ALTER TRIGGER trg_wf_events_leads ON public.leads RENAME TO leads_wf_event");
  await db.begin((tx) => tx.unsafe(migration));
  await db`insert into leads(id,workspace_id,owner_id) values(${row},${W},${U})`;
  expect(await db`select event_type from workflow_events`).toEqual([{ event_type: "created" }]);
  expect(
    await db`select tgname from pg_trigger where tgrelid='leads'::regclass and tgfoid='enqueue_workflow_event()'::regprocedure`,
  ).toEqual([{ tgname: "trg_wf_events_leads" }]);
});

it("refuses an unknown emitter instead of silently dropping unrelated trigger configuration", async () => {
  await expect(
    db.begin(async (tx) => {
      await tx.unsafe(
        "CREATE TRIGGER custom_wf_event AFTER INSERT OR UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.enqueue_workflow_event('contacts')",
      );
      await tx.unsafe(migration);
    }),
  ).rejects.toMatchObject({ code: "P0001" });
  expect(
    await db`select tgname from pg_trigger where tgrelid='contacts'::regclass and tgfoid='enqueue_workflow_event()'::regprocedure`,
  ).toEqual([{ tgname: "trg_wf_events_contacts" }]);
});

it("refuses disabled or altered canonical producers instead of broadening their firing boundary", async () => {
  await expect(
    db.begin(async (tx) => {
      await tx.unsafe("ALTER TABLE public.leads DISABLE TRIGGER trg_wf_events_leads");
      await tx.unsafe(migration);
    }),
  ).rejects.toMatchObject({ code: "P0001" });
  await expect(
    db.begin(async (tx) => {
      await tx.unsafe(
        "DROP TRIGGER trg_wf_events_leads ON public.leads; CREATE TRIGGER trg_wf_events_leads AFTER INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION public.enqueue_workflow_event('leads')",
      );
      await tx.unsafe(migration);
    }),
  ).rejects.toMatchObject({ code: "P0001" });
  await db`insert into leads(id,workspace_id,owner_id) values(${row},${W},${U})`;
  expect(await db`select id from workflow_events`).toHaveLength(1);
});
