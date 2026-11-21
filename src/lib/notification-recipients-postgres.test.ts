import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import postgres from "postgres";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHmac, randomBytes, randomUUID } from "node:crypto";

// Actual gateway, private RLS bridge and production permission predicates in a
// disposable PostgreSQL. HTTP cases use cryptographically verified synthetic JWTs
// in real PostgREST, not GoTrue login or any production credential.
const MIGRATION = "drizzle/migrations/0391_notification_recipients.sql";
const image = "postgres@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b";
const postgrestImage =
  "postgrest/postgrest@sha256:e9490aa503a5fb07d8e8c80da46e5c0c193894e583b59ed9077e74c4101ffae2";
const docker =
  process.platform === "darwin"
    ? "/Applications/Docker.app/Contents/Resources/bin/docker"
    : "docker";
const container = "techerp-notification-recipients-ci-" + randomUUID();
const apiContainer = container + "-rest";
const network = container + "-net";
let endpoint = "",
  temporary = "",
  started = false,
  networkStarted = false,
  apiStarted = false,
  httpBase = "",
  jwtSecret = "";
let db: ReturnType<typeof postgres>;
const W = "a1000000-0000-4000-8000-000000000001";
const B = "a1000000-0000-4000-8000-000000000002";
const A = "b1000000-0000-4000-8000-000000000001";
const U = "b1000000-0000-4000-8000-000000000002";
const C = "b1000000-0000-4000-8000-000000000003";
const D = "b1000000-0000-4000-8000-000000000004";
const N = "b1000000-0000-4000-8000-000000000005";
const F = "b1000000-0000-4000-8000-000000000006";
const CEO = "b1000000-0000-4000-8000-000000000007";
const ROLE = "c1000000-0000-4000-8000-000000000001";
const GROUP = "c1000000-0000-4000-8000-000000000002";
const AREA = "c1000000-0000-4000-8000-000000000003";
const X = "d1000000-0000-4000-8000-000000000001";
const MANAGER_PERSON = "d1000000-0000-4000-8000-000000000002";
const WF = "e1000000-0000-4000-8000-000000000001";
const RUN = "e1000000-0000-4000-8000-000000000002";
const EVENT = "e1000000-0000-4000-8000-000000000003";
const SESSION = "e1000000-0000-4000-8000-000000000004";
const GENERATION = "e1000000-0000-4000-8000-000000000005";
const sourceTables = [
  "leads",
  "contacts",
  "companies",
  "deals",
  "tickets",
  "activities",
  "ats_jobs",
  "ats_candidates",
  "ats_applications",
  "ats_interviews",
  "projects",
  "project_tasks",
  "project_milestones",
  "contracts",
  "financial_entries",
  "bank_payments",
  "quotes",
  "proposals",
  "services",
  "recurring_plans",
  "subscription_invoices",
  "customer_invoices",
  "people",
] as const;
const readKeys = [
  "techsales.deals.view.workspace",
  "techsales.leads.view.workspace",
  "techsales.contacts.view.workspace",
  "techsales.companies.view.workspace",
  "techsales.quotes.view.workspace",
  "techsales.proposals.view.workspace",
  "techsales.activities.view.workspace",
  "techsales.tickets.view.workspace",
  "techhire.jobs.view.workspace",
  "techhire.candidates.view.workspace",
  "techpeople.people.view.workspace",
  "techprojects.projects.view.workspace",
  "techprojects.tasks.view.workspace",
  "techprojects.milestones.view.workspace",
  "techcontracts.contracts.view.workspace",
  "techcontracts.approvals.view.workspace",
  "techcontracts.approvals.approve.workspace",
  "techfinance.entries.view.workspace",
  "techservice.services.view.workspace",
  "system.workflow_approvals.view.workspace",
  "system.workflow_approvals.manage.workspace",
];
const dockerRun = (...args: string[]) =>
  execFileSync(docker, ["--host", endpoint, ...args], {
    encoding: "utf8",
    timeout: 90000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
function productionFunction(file: string, name: string) {
  const source = readFileSync(file, "utf8");
  const start = source.lastIndexOf(
    "CREATE OR REPLACE FUNCTION " + (name.includes(".") ? name : "public." + name) + "(",
  );
  if (start < 0) throw Error("Missing production function " + name);
  const tail = source.slice(start),
    opening = /\bAS\s+(\$[a-z_]*\$)/i.exec(tail);
  if (!opening) throw Error("Missing production function body " + name);
  const end = tail.indexOf(opening[1], opening.index + opening[0].length);
  if (end < 0) throw Error("Incomplete production function " + name);
  return tail.slice(0, end + opening[1].length) + ";";
}
async function load(file: string, names: string[]) {
  for (const name of names) await db.unsafe(productionFunction(file, name));
}
beforeAll(async () => {
  if (process.platform === "darwin" && !existsSync(docker))
    throw Error("Docker Desktop is required for notification SQL tests.");
  endpoint = execFileSync(
    docker,
    ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"],
    { encoding: "utf8", timeout: 10000 },
  ).trim();
  if (!endpoint.startsWith("unix://")) throw Error("Only a local Unix Docker socket is allowed.");
  temporary = mkdtempSync(join(tmpdir(), "techerp-notification-recipients-ci-"));
  const password = randomUUID() + randomUUID(),
    envFile = join(temporary, "postgres.env");
  writeFileSync(
    envFile,
    "POSTGRES_DB=techerp_notification_ci\nPOSTGRES_PASSWORD=" + password + "\n",
    { mode: 0o600 },
  );
  // A dedicated bridge is required: Docker suppresses host port publishing on
  // --internal-only networks. Both published endpoints remain loopback-only.
  dockerRun("network", "create", network);
  networkStarted = true;
  dockerRun(
    "run",
    "-d",
    "--rm",
    "--name",
    container,
    "--network",
    network,
    "--network-alias",
    "notification-db",
    "--env-file",
    envFile,
    "-p",
    "127.0.0.1::5432",
    image,
    "-c",
    "fsync=off",
    "-c",
    "jit=off",
  );
  started = true;
  const mapped = dockerRun("port", container, "5432/tcp");
  if (!/^127\.0\.0\.1:\d+$/.test(mapped)) throw Error("Unexpected disposable PostgreSQL binding");
  db = postgres({
    host: "127.0.0.1",
    port: Number(mapped.split(":")[1]),
    database: "techerp_notification_ci",
    username: "postgres",
    password,
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
      await new Promise((done) => setTimeout(done, 100));
    }
  }
  if (!ready) throw Error("Disposable PostgreSQL did not become ready");
  await db.unsafe(readFileSync("tests/fixtures/permission-postgres-ci.sql", "utf8"));
  await db.unsafe(readFileSync("tests/fixtures/notification-recipients.sql", "utf8"));
  for (const table of sourceTables) {
    await db.unsafe(
      `CREATE TABLE IF NOT EXISTS public.${table}(id uuid PRIMARY KEY,workspace_id uuid,owner_id uuid)`,
    );
    for (const [column, type] of [
      ["assigned_to", "uuid"],
      ["created_by", "uuid"],
      ["profile_id", "uuid"],
      ["manager_id", "uuid"],
      ["hiring_manager_id", "uuid"],
      ["recruiter_id", "uuid"],
      ["interviewer_id", "uuid"],
      ["assignee_id", "uuid"],
      ["assignee_ids", "uuid[]"],
      ["project_id", "uuid"],
      ["hiring_area_id", "uuid"],
      ["hiring_revision", "integer DEFAULT 1"],
      ["type", "text"],
      ["area_id", "uuid"],
      ["archived", "boolean DEFAULT false"],
      ["deleted_at", "timestamptz"],
      ["status", "text"],
    ])
      await db.unsafe(`ALTER TABLE public.${table} ADD COLUMN IF NOT EXISTS ${column} ${type}`);
    await db.unsafe(
      `GRANT SELECT ON public.${table} TO authenticated;ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`,
    );
  }
  await load("drizzle/migrations/0031_workspace_members_status_inactive.sql", [
    "is_workspace_member",
  ]);
  await load("supabase/migrations/20260719232609_7f93d46f-e789-4bee-8545-3070c21bb549.sql", [
    "is_workspace_admin_v2",
  ]);
  await load("drizzle/migrations/0249_permission_introspection_boundary.sql", [
    "techerp_api.effective_permissions_unchecked",
    "permission_metadata_access",
    "user_effective_permissions",
    "user_data_scope",
  ]);
  await load("supabase/migrations/20260702201807_dbc392d9-6c74-4c4e-a34f-e3949206f95f.sql", [
    "user_has_permission",
  ]);
  await load("drizzle/migrations/0179_techprojects_cycle6_api_offline_ops.sql", [
    "current_user_workspaces",
    "techerp_api.leave",
  ]);
  await db.unsafe(
    "ALTER FUNCTION techerp_api.leave() OWNER TO techerp_api_subject; REVOKE ALL ON FUNCTION techerp_api.leave() FROM PUBLIC,anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION techerp_api.leave() TO techerp_api_subject",
  );
  await load("drizzle/migrations/0120_activities_team_scope_active_membership.sql", [
    "my_team_member_pairs",
  ]);
  await load("drizzle/migrations/0046_view_as_role_only_readonly.sql", ["is_read_only_view"]);
  await load("drizzle/migrations/0216_work_core_prepare.sql", ["work_access_context"]);
  await load("drizzle/migrations/0222_order4_sales_prepare.sql", [
    "sales_access_context",
    "sales_context_access",
    "sales_record_context_access",
    "sales_record_access",
    "sales_event_reference_access",
    "sales_approval_access",
    "techerp_api.sales_worker_check",
  ]);
  await db.unsafe(
    "ALTER FUNCTION techerp_api.sales_worker_check(text,uuid,uuid,uuid,jsonb) OWNER TO techerp_api_subject;REVOKE ALL ON FUNCTION techerp_api.sales_worker_check(text,uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION techerp_api.sales_worker_check(text,uuid,uuid,uuid,jsonb) TO postgres",
  );
  await load("drizzle/migrations/0258_service_agent_queue.sql", ["sales_worker_authorize"]);
  await load("drizzle/migrations/0222_order4_sales_prepare.sql", [
    "techerp_api.sales_approval_recipient_check",
    "sales_workflow_approval_recipient",
  ]);
  await db.unsafe(
    "ALTER FUNCTION techerp_api.sales_approval_recipient_check(uuid,uuid,text,uuid) OWNER TO techerp_api_subject;REVOKE ALL ON FUNCTION techerp_api.sales_approval_recipient_check(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION techerp_api.sales_approval_recipient_check(uuid,uuid,text,uuid) TO postgres;REVOKE ALL ON FUNCTION public.sales_workflow_approval_recipient(uuid,uuid,text,uuid,integer) FROM PUBLIC,anon,authenticated;GRANT EXECUTE ON FUNCTION public.sales_workflow_approval_recipient(uuid,uuid,text,uuid,integer) TO service_role",
  );
  await load("drizzle/migrations/0193_hr_action_scope_alignment.sql", ["hr_team_contains"]);
  await load("drizzle/migrations/0201_pipeline_action_scope.sql", ["hr_scope_permission"]);
  await load("drizzle/migrations/0193_hr_action_scope_alignment.sql", ["hr_people_access"]);
  await load("drizzle/migrations/0200_jobs_action_scope.sql", ["ats_job_action_access"]);
  await load("drizzle/migrations/0218_order3_completion_prepare.sql", [
    "work_action_prefix",
    "work_context_access",
    "work_record_context_access",
    "work_record_access",
    "work_row_access",
  ]);
  await load("drizzle/migrations/0210_finance_core_actions.sql", [
    "finance_access_context",
    "finance_context_access",
    "finance_context_entry_access",
    "finance_entry_access",
  ]);
  await load("drizzle/migrations/0122_rbac_wk_phase1_structural.sql", [
    "role_profile_resolve_leader",
  ]);
  // SELECT predicates below call the same production scope functions used by the
  // corresponding policies. The bootstrap omits unrelated business columns/triggers.
  for (const [table, resource, responsible] of [
    ["leads", "techsales.leads", "coalesce(assigned_to,owner_id)"],
    ["contacts", "techsales.contacts", "coalesce(assigned_to,owner_id)"],
    ["companies", "techsales.companies", "coalesce(assigned_to,owner_id)"],
    ["deals", "techsales.deals", "coalesce(assigned_to,owner_id)"],
    ["tickets", "techsales.tickets", "coalesce(assignee_id,owner_id)"],
    ["activities", "techsales.activities", "coalesce(assigned_to,owner_id)"],
    ["quotes", "techsales.quotes", "coalesce(assigned_to,owner_id)"],
    ["proposals", "techsales.proposals", "coalesce(assigned_to,owner_id)"],
    ["workflows", "system.workflows", "owner_id"],
  ]) {
    await db.unsafe(
      `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;GRANT SELECT ON public.${table} TO authenticated;CREATE POLICY source_read ON public.${table} FOR SELECT TO authenticated USING(public.sales_context_access((SELECT public.sales_access_context()),workspace_id,'${resource}','view',ARRAY[${responsible}]::uuid[]))`,
    );
  }
  await db.unsafe(`CREATE POLICY source_read ON people FOR SELECT TO authenticated USING(public.hr_people_access(workspace_id,'view',profile_id,manager_id,COALESCE(assigned_to,created_by,owner_id)));
    CREATE POLICY source_read ON ats_jobs FOR SELECT TO authenticated USING(public.ats_job_action_access(workspace_id,'view',owner_id,assigned_to,hiring_manager_id,recruiter_id));
    CREATE POLICY source_read ON ats_candidates FOR SELECT TO authenticated USING(public.hr_scope_permission(workspace_id,'techhire.candidates','view',COALESCE(assigned_to,owner_id)=auth.uid(),public.hr_team_contains(workspace_id,ARRAY[COALESCE(assigned_to,owner_id)])));
    CREATE POLICY source_read ON financial_entries FOR SELECT TO authenticated USING(public.finance_context_access((SELECT public.finance_access_context()),workspace_id,'entries','view',COALESCE(assigned_to,owner_id)));
    CREATE POLICY source_read ON contracts FOR SELECT TO authenticated USING(public.work_record_access('techcontracts.contracts',id,'view'));
    CREATE POLICY source_read ON projects FOR SELECT TO authenticated USING(public.work_record_access('techprojects.projects',id,'view'));
    CREATE POLICY source_read ON project_tasks FOR SELECT TO authenticated USING(public.work_record_access('techprojects.tasks',id,'view'));
    CREATE POLICY source_read ON project_milestones FOR SELECT TO authenticated USING(public.work_row_access('techprojects.milestones',to_jsonb(project_milestones),'view'));
    CREATE POLICY source_read ON services FOR SELECT TO authenticated USING(public.work_row_access('techservice.services',to_jsonb(services),'view'))`);
  await db.unsafe(`ALTER TABLE contract_approvals ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON contract_approvals TO authenticated;
    CREATE POLICY work_approval_view ON contract_approvals FOR SELECT TO authenticated USING(public.work_context_access((SELECT public.work_access_context()),workspace_id,'techcontracts.approvals','view',ARRAY[coalesce(approver_id,owner_id)]) AND public.work_record_access('techcontracts.contracts',contract_id,'view'))`);
  for (const table of ["deals", "projects", "people", "financial_entries", "ats_jobs", "contracts"])
    await db.unsafe(
      `CREATE POLICY extra_restriction ON ${table} AS RESTRICTIVE FOR SELECT TO authenticated USING(public.notification_fixture_restriction(id))`,
    );
  await db.unsafe(
    "REVOKE ALL ON FUNCTION techerp_api.effective_permissions_unchecked(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;REVOKE ALL ON FUNCTION public.permission_metadata_access(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;GRANT SELECT ON profiles,workspace_members,user_groups,user_group_members TO authenticated",
  );
  const keys = JSON.parse(readFileSync("docs/security/permission-key-catalog.json", "utf8")).keys;
  await db`insert into permissions(key) select jsonb_array_elements_text(${db.json(keys)})`;
  await db.unsafe(readFileSync(MIGRATION, "utf8"));
  const authenticatorPassword = randomBytes(32).toString("hex");
  // Hex-only, generated locally; never emitted to a command line or log.
  await db.unsafe(
    "CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD '" + authenticatorPassword + "'",
  );
  await db.unsafe("GRANT anon,authenticated,service_role TO authenticator");
  jwtSecret = randomBytes(48).toString("hex");
  const apiEnvironment = join(temporary, "postgrest.env");
  writeFileSync(
    apiEnvironment,
    [
      "PGRST_DB_URI=postgres://authenticator:" +
        authenticatorPassword +
        "@notification-db:5432/techerp_notification_ci",
      "PGRST_DB_SCHEMAS=public",
      "PGRST_DB_ANON_ROLE=anon",
      "PGRST_JWT_SECRET=" + jwtSecret,
      "PGRST_SERVER_PORT=3000",
      "PGRST_LOG_LEVEL=crit",
      "PGRST_DB_POOL=3",
    ].join("\n") + "\n",
    { mode: 0o600 },
  );
  dockerRun(
    "run",
    "-d",
    "--rm",
    "--name",
    apiContainer,
    "--network",
    network,
    "--env-file",
    apiEnvironment,
    "-p",
    "127.0.0.1::3000",
    postgrestImage,
  );
  apiStarted = true;
  const apiPort = dockerRun("port", apiContainer, "3000/tcp");
  if (!/^127\.0\.0\.1:\d+$/.test(apiPort)) throw Error("Unexpected disposable PostgREST binding");
  httpBase = "http://" + apiPort;
  let apiReady = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const response = await fetch(httpBase + "/", { signal: AbortSignal.timeout(1000) });
      if (response.ok) {
        apiReady = true;
        break;
      }
    } catch {
      /* Only the owned loopback API can be retried during startup. */
    }
    await new Promise((done) => setTimeout(done, 100));
  }
  if (!apiReady) throw Error("Disposable PostgREST did not become ready");
}, 180000);

afterAll(async () => {
  try {
    if (apiStarted) dockerRun("rm", "-f", "-v", apiContainer);
  } finally {
    try {
      if (db) await db.end({ timeout: 2 });
    } finally {
      try {
        if (started) dockerRun("rm", "-f", "-v", container);
      } finally {
        try {
          if (networkStarted) dockerRun("network", "rm", network);
        } finally {
          if (temporary) rmSync(temporary, { recursive: true, force: true });
        }
      }
    }
  }
});

beforeEach(async () => {
  await db.unsafe(
    "TRUNCATE notifications,workflow_approvals,contract_approvals,project_members,hiring_demand_steps,hiring_demand_requests,hiring_area_policies,workflow_runs,workflow_events,workflows,workspaces,profiles,workspace_members,user_job_roles,job_roles,job_role_permission_overrides,user_groups,user_group_members,view_as_sessions",
  );
  await db`insert into workspaces(id,created_by) values(${W},${A}),(${B},${A})`;
  for (const id of [A, U, C, D, N, F, CEO])
    await db`insert into profiles(id,active_workspace_id) values(${id},${id === F ? B : W})`;
  for (const id of [A, U, C, D, N, CEO])
    await db`insert into workspace_members(workspace_id,user_id) values(${W},${id})`;
  await db`insert into workspace_members(workspace_id,user_id) values(${B},${F})`;
  await db`insert into job_roles(id,workspace_id) values(${ROLE},${W})`;
  for (const id of [U, C, D, CEO])
    await db`insert into user_job_roles(role_id,user_id,workspace_id,owner_id) values(${ROLE},${id},${W},${W})`;
  for (const key of readKeys)
    await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${W},${ROLE},${key},'grant')`;
  await db`insert into user_groups(id,workspace_id,name) values(${GROUP},${W},'Synthetic group')`;
  for (const id of [U, C, N, F])
    await db`insert into user_group_members(group_id,user_id,is_leader) values(${GROUP},${id},${id === D})`;
  for (const table of sourceTables) {
    await db.unsafe(`DELETE FROM public.${table}`);
    await db.unsafe(
      `INSERT INTO public.${table}(id,workspace_id,owner_id,assigned_to,created_by,profile_id,assignee_id,project_id) VALUES($1,$2,$3,$4,$5,$4,$4,$1)`,
      [X, W, A, U, C],
    );
  }
  await db`insert into people(id,workspace_id,owner_id,profile_id,assigned_to) values(${MANAGER_PERSON},${W},${A},${D},${D})`;
  await db`update contracts set status='in_review' where id=${X}`;
  await db`insert into workflows(id,workspace_id,owner_id,execution_user_id,entity) values(${WF},${W},${A},${A},'deals')`;
  await db`insert into workflow_events(id,workspace_id,owner_id,entity,entity_id,workflow_version) values(${EVENT},${W},${A},'deals',${X},1)`;
  await db`insert into workflow_runs(id,workspace_id,owner_id,workflow_id,event_id,entity,entity_id) values(${RUN},${W},${A},${WF},${EVENT},'deals',${X})`;
});

type DispatchResult = {
  sent: number;
  candidates: number;
  excluded: number;
  duplicate: number;
  issues: string[];
};
type Rule = { kind: string; id?: string };
async function withRole<T>(
  role: "service_role" | "authenticated" | "anon",
  actor: string | null,
  fn: (tx: postgres.TransactionSql) => Promise<T>,
  extra: Record<string, unknown> = {},
) {
  return db.begin(async (tx) => {
    await tx.unsafe(`SET LOCAL ROLE ${role}`);
    await tx`select set_config('request.jwt.claims',${JSON.stringify({ role, ...(actor ? { sub: actor } : {}), ...extra })},true)`;
    return fn(tx);
  }) as Promise<T>;
}
async function source(entity = "deals") {
  await db`update workflows set entity=${entity} where id=${WF}`;
  await db`update workflow_runs set entity=${entity} where id=${RUN}`;
  await db`update workflow_events set entity=${entity} where id=${EVENT}`;
}
async function dispatch(
  rules: Rule[] = [{ kind: "user", id: U }],
  options: {
    entity?: string;
    record?: string;
    version?: number;
    run?: string;
    step?: string;
    title?: string;
    body?: string;
  } = {},
) {
  return withRole("service_role", null, async (tx) => {
    const rows =
      await tx`select public.notification_workflow_dispatch(${WF},${options.run ?? RUN},${options.version ?? 1},${options.entity ?? "deals"},${options.record ?? X},${tx.json(rules)},${options.title ?? "Synthetic notice"},${options.body ?? "Open the authorized record"},${options.step ?? "0"}) result`;
    return rows[0].result as DispatchResult;
  });
}
async function recipients() {
  return (await db`select user_id from notifications order by user_id`).map(
    (row) => row.user_id as string,
  );
}

function fixtureJwt(
  role: "service_role" | "authenticated" | "anon",
  actor?: string,
  signingSecret = jwtSecret,
) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const message =
    encode({ alg: "HS256", typ: "JWT" }) +
    "." +
    encode({
      role,
      ...(actor ? { sub: actor } : {}),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60,
    });
  return message + "." + createHmac("sha256", signingSecret).update(message).digest("base64url");
}
async function httpDispatch(
  options: {
    recipient?: string;
    role?: "service_role" | "authenticated" | "anon";
    actor?: string;
    token?: string;
  } = {},
) {
  const response = await fetch(httpBase + "/rpc/notification_workflow_dispatch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:
        "Bearer " + (options.token ?? fixtureJwt(options.role ?? "service_role", options.actor)),
    },
    body: JSON.stringify({
      p_workflow: WF,
      p_run: RUN,
      p_version: 1,
      p_entity: "deals",
      p_record: X,
      p_rules: [{ kind: "user", id: options.recipient ?? U }],
      p_title: "HTTP fixture notification",
      p_body: "Read the authorized record",
      p_step: "http",
    }),
    signal: AbortSignal.timeout(3000),
  });
  return {
    status: response.status,
    payload: (await response.json()) as { sent?: number; code?: string; issues?: string[] },
  };
}

it("notification HTTP JWT allows authorized recipient through real PostgREST", async () => {
  const result = await httpDispatch();
  expect(result.status).toBe(200);
  expect(result.payload.sent).toBe(1);
  expect(await recipients()).toEqual([U]);
});
it("notification HTTP JWT excludes a recipient missing the canonical permission", async () => {
  await db`delete from job_role_permission_overrides where permission_key='techsales.deals.view.workspace'`;
  const result = await httpDispatch();
  expect(result.status).toBe(200);
  expect(result.payload.sent).toBe(0);
  expect(await recipients()).toEqual([]);
});
it("notification HTTP JWT preserves an explicit canonical deny", async () => {
  await db`update job_role_permission_overrides set effect='deny' where permission_key='techsales.deals.view.workspace'`;
  const result = await httpDispatch();
  expect(result.status).toBe(200);
  expect(result.payload.sent).toBe(0);
  expect(await recipients()).toEqual([]);
});
it("notification HTTP JWT excludes another workspace member", async () => {
  const result = await httpDispatch({ recipient: F });
  expect(result.status).toBe(200);
  expect(result.payload.sent).toBe(0);
  expect(await recipients()).toEqual([]);
});
it("notification HTTP JWT excludes an inactive member", async () => {
  await db`update workspace_members set status='inactive' where user_id=${U}`;
  const result = await httpDispatch();
  expect(result.status).toBe(200);
  expect(result.payload.sent).toBe(0);
  expect(await recipients()).toEqual([]);
});
it("notification HTTP verifies the JWT signature instead of trusting a forged role claim", async () => {
  const result = await httpDispatch({
    token: fixtureJwt("service_role", undefined, "different-fixture-secret-that-must-not-verify"),
  });
  expect(result.status).toBe(401);
  expect(await recipients()).toEqual([]);
});
it("notification HTTP denies authenticated and anonymous caller roles", async () => {
  expect((await httpDispatch({ role: "authenticated", actor: U })).status).toBe(403);
  expect([401, 403]).toContain((await httpDispatch({ role: "anon" })).status);
  expect(await recipients()).toEqual([]);
});
it("notification HTTP does not expose private recipient bridges in the public RPC schema", async () => {
  for (const name of [
    "notification_source_visible",
    "notification_deal_leader",
    "notification_contract_approver",
  ]) {
    const response = await fetch(httpBase + "/rpc/" + name, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + fixtureJwt("service_role"),
      },
      body: JSON.stringify({ p_ws: W, p_user: U, p_table: "deals", p_id: X }),
      signal: AbortSignal.timeout(3000),
    });
    expect(response.status).toBe(404);
  }
  expect(await recipients()).toEqual([]);
});

it("notification recipients allow authorized member", async () => {
  expect((await dispatch()).sent).toBe(1);
  expect(await recipients()).toEqual([U]);
});
it("notification recipients reject missing permission", async () => {
  await db`delete from job_role_permission_overrides where permission_key='techsales.deals.view.workspace'`;
  expect((await dispatch()).sent).toBe(0);
  expect(await recipients()).toEqual([]);
});
it("notification recipients reject explicit deny", async () => {
  await db`update job_role_permission_overrides set effect='deny' where permission_key='techsales.deals.view.workspace'`;
  expect((await dispatch()).sent).toBe(0);
  expect(await recipients()).toEqual([]);
});
it("notification recipients reject foreign workspace", async () => {
  expect((await dispatch([{ kind: "user", id: F }])).sent).toBe(0);
  expect(await recipients()).toEqual([]);
});
it("notification recipients reject inactive member", async () => {
  await db`update workspace_members set status='inactive' where user_id=${U}`;
  expect((await dispatch()).sent).toBe(0);
  expect(await recipients()).toEqual([]);
});

it("caps large recipient groups before any partial fanout", async () => {
  await db`insert into user_group_members(group_id,user_id) select ${GROUP},('b2000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,201)n`;
  const result = await dispatch([{ kind: "team", id: GROUP }]);
  expect(result.sent).toBe(0);
  expect(result.issues).toContain("recipient_limit_exceeded");
  expect(await recipients()).toEqual([]);
});

it("refuses inactive execution owners before resolving any recipient", async () => {
  await db`update workspace_members set status='inactive' where user_id=${A} and workspace_id=${W}`;
  await expect(dispatch()).rejects.toThrow();
  expect(await recipients()).toEqual([]);
});

it("does not accept a user subject inside a service-role invocation", async () => {
  await expect(
    withRole(
      "service_role",
      U,
      (tx) =>
        tx`select public.notification_workflow_dispatch(${WF},${RUN},1,'deals',${X},'[{"kind":"workflow_owner"}]','Synthetic',null,'0')`,
    ),
  ).rejects.toThrow();
  expect(await recipients()).toEqual([]);
});

it.each(["deals", "ats_jobs", "people", "contracts", "projects", "financial_entries"])(
  "checks real canonical RLS for %s without leaking an unreadable title",
  async (entity) => {
    await source(entity);
    expect((await dispatch([{ kind: "user", id: U }], { entity })).sent).toBe(1);
    await db`truncate notifications`;
    await db`delete from job_role_permission_overrides`;
    const result = await dispatch([{ kind: "user", id: U }], {
      entity,
      title: "Private source title",
    });
    expect(result.sent).toBe(0);
    expect(JSON.stringify(result)).not.toContain("Private source title");
    expect(await recipients()).toEqual([]);
  },
);

it("preserves additional restrictive source policies for executor and recipient", async () => {
  await db.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims','{"role":"service_role"}',true)`;
    await tx`select set_config('test.notification_hidden',${X},true)`;
    expect(
      (await tx`select techerp_api.notification_source_visible(${W},${U},'deals',${X}) allowed`)[0]
        .allowed,
    ).toBe(false);
  });
  expect(await recipients()).toEqual([]);
});

it("keeps target profiles unchanged when ATS or Finance selected workspace denies the bridge", async () => {
  await db`insert into workspace_members(workspace_id,user_id) values(${B},${U})`;
  await db`update profiles set active_workspace_id=${B} where id=${U}`;
  for (const entity of ["ats_jobs", "financial_entries"]) {
    await source(entity);
    expect((await dispatch([{ kind: "user", id: U }], { entity })).sent).toBe(0);
    expect(
      (await db`select active_workspace_id from profiles where id=${U}`)[0].active_workspace_id,
    ).toBe(B);
  }
});

it("resolves current source fields and deduplicates overlapping rules and replay", async () => {
  const rules = [{ kind: "user", id: U }, { kind: "source_responsible" }];
  expect((await dispatch(rules)).sent).toBe(1);
  expect((await dispatch(rules)).sent).toBe(0);
  expect(await recipients()).toEqual([U]);
  await db`update deals set assigned_to=${C} where id=${X}`;
  expect((await dispatch([{ kind: "source_responsible" }], { step: "1" })).sent).toBe(1);
  expect(await recipients()).toEqual([U, C]);
});

it("resolves creator and explicit legacy executor without an implicit hierarchy", async () => {
  expect((await dispatch([{ kind: "source_creator" }], { step: "creator" })).sent).toBe(1);
  expect((await dispatch([{ kind: "workflow_owner" }], { step: "owner" })).sent).toBe(1);
  expect(await recipients()).toEqual([A, C]);
  expect((await dispatch([{ kind: "followers" }], { step: "followers" })).sent).toBe(0);
  expect(await recipients()).not.toContain(CEO);
});

it("filters explicit teams and job roles by active membership and real source access", async () => {
  expect((await dispatch([{ kind: "team", id: GROUP }])).sent).toBe(2);
  expect(await recipients()).toEqual([U, C]);
  await db`truncate notifications`;
  expect((await dispatch([{ kind: "job_role", id: ROLE }])).sent).toBe(4);
  expect(await recipients()).toEqual([U, C, D, CEO]);
});

it("resolves the manager person profile rather than treating people.manager_id as a user id", async () => {
  await source("people");
  await db`update people set manager_id=${MANAGER_PERSON} where id=${X}`;
  expect((await dispatch([{ kind: "area_manager" }], { entity: "people" })).sent).toBe(1);
  expect(await recipients()).toEqual([D]);
});

it("does not escalate an absent manager to the CEO or executor", async () => {
  await source("people");
  const result = await dispatch([{ kind: "area_manager" }], { entity: "people" });
  expect(result.sent).toBe(0);
  expect(await recipients()).toEqual([]);
});

it("rejects an archived manager person without replacing the manager with the CEO", async () => {
  await source("people");
  await db`update people set manager_id=${MANAGER_PERSON} where id=${X}`;
  await db`update people set archived=true where id=${MANAGER_PERSON}`;
  expect((await dispatch([{ kind: "area_manager" }], { entity: "people" })).sent).toBe(0);
  expect(await recipients()).toEqual([]);
});

it("uses the canonical unique commercial leader and leaves ambiguous leadership unresolved", async () => {
  await db`insert into user_group_members(group_id,user_id,is_leader) values(${GROUP},${D},true)`;
  expect((await dispatch([{ kind: "area_manager" }])).sent).toBe(1);
  expect(await recipients()).toEqual([D]);
  await db`truncate notifications`;
  await db`update user_group_members set is_leader=true where group_id=${GROUP} and user_id=${C}`;
  const ambiguous = await dispatch([{ kind: "area_manager" }], { step: "ambiguous" });
  expect(ambiguous.sent).toBe(0);
  expect(ambiguous.issues).toContain("recipient_source_ambiguous");
  expect(await recipients()).toEqual([]);
});

it("uses the persisted hiring request delegate rather than inferring self-approval from job creator", async () => {
  await source("ats_jobs");
  await db`update ats_jobs set hiring_area_id=${AREA},created_by=${C},hiring_revision=2 where id=${X}`;
  await db`insert into hiring_area_policies(workspace_id,area_id,manager_id,ceo_id,manager_delegate_id) values(${W},${AREA},${U},${CEO},${D})`;
  const request = randomUUID();
  await db`insert into hiring_demand_requests(id,workspace_id,job_id,revision,policy_revision,requested_by,status) values(${request},${W},${X},2,1,${U},'pending')`;
  await db`insert into hiring_demand_steps(workspace_id,request_id,stage,approver_id,status) values(${W},${request},'manager',${D},'pending')`;
  expect((await dispatch([{ kind: "area_manager" }], { entity: "ats_jobs" })).sent).toBe(1);
  expect(await recipients()).toEqual([D]);
  await db`truncate notifications`;
  await db`update hiring_demand_steps set approver_id=null where request_id=${request}`;
  expect(
    (await dispatch([{ kind: "area_manager" }], { entity: "ats_jobs", step: "no-delegate" })).sent,
  ).toBe(0);
  expect(await recipients()).toEqual([]);
});

it("keeps a configured hiring manager when only the job creator matches that manager", async () => {
  await source("ats_jobs");
  await db`update ats_jobs set hiring_area_id=${AREA},created_by=${U} where id=${X}`;
  await db`insert into hiring_area_policies(workspace_id,area_id,manager_id,ceo_id,manager_delegate_id) values(${W},${AREA},${U},${CEO},${D})`;
  expect((await dispatch([{ kind: "area_manager" }], { entity: "ats_jobs" })).sent).toBe(1);
  expect(await recipients()).toEqual([U]);
});

it.each(["stale_policy", "rejected_request", "rejected_step"])(
  "does not replace an unavailable current hiring request manager after %s",
  async (failure) => {
    await source("ats_jobs");
    await db`update ats_jobs set hiring_area_id=${AREA},hiring_revision=2 where id=${X}`;
    await db`insert into hiring_area_policies(workspace_id,area_id,manager_id,ceo_id,manager_delegate_id) values(${W},${AREA},${U},${CEO},${D})`;
    const request = randomUUID();
    await db`insert into hiring_demand_requests(id,workspace_id,job_id,revision,policy_revision,requested_by,status) values(${request},${W},${X},2,${failure === "stale_policy" ? 0 : 1},${C},${failure === "rejected_request" ? "rejected" : "pending"})`;
    await db`insert into hiring_demand_steps(workspace_id,request_id,stage,approver_id,status) values(${W},${request},'manager',${D},${failure === "rejected_step" ? "rejected" : "pending"})`;
    const result = await dispatch([{ kind: "area_manager" }], { entity: "ats_jobs" });
    expect(result.sent).toBe(0);
    expect(result.issues).toContain("recipient_source_unavailable");
    expect(await recipients()).toEqual([]);
  },
);

it("uses explicit project members without treating them as followers", async () => {
  await source("projects");
  for (const member of [U, N, F])
    await db`insert into project_members(workspace_id,project_id,user_id) values(${W},${X},${member})`;
  expect((await dispatch([{ kind: "project_members" }], { entity: "projects" })).sent).toBe(1);
  expect(await recipients()).toEqual([U]);
});

it("notifies only a current unsuperseded pending contract approval", async () => {
  await source("contracts");
  await db`insert into contract_approvals(workspace_id,contract_id,approver_id,status,sort_order,generation) values(${W},${X},${U},'pending',1,${GENERATION}),(${W},${X},${C},'pending',2,${GENERATION})`;
  await db`insert into contract_approvals(workspace_id,contract_id,approver_id,status,sort_order,superseded_at) values(${W},${X},${CEO},'pending',0,now())`;
  expect((await dispatch([{ kind: "pending_approvers" }], { entity: "contracts" })).sent).toBe(1);
  expect(await recipients()).toEqual([U]);
});

it("does not notify a later contract approval while a preceding stage is rejected", async () => {
  await source("contracts");
  await db`insert into contract_approvals(workspace_id,contract_id,approver_id,status,sort_order,generation) values(${W},${X},${U},'rejected',1,${GENERATION}),(${W},${X},${C},'pending',2,${GENERATION})`;
  expect((await dispatch([{ kind: "pending_approvers" }], { entity: "contracts" })).sent).toBe(0);
  expect(await recipients()).toEqual([]);
});

it.each(["missing", "deny"])(
  "requires canonical contract approval permission even when source view remains allowed: %s",
  async (effect) => {
    await source("contracts");
    await db`insert into contract_approvals(workspace_id,contract_id,approver_id,status,sort_order,generation) values(${W},${X},${U},'pending',1,${GENERATION})`;
    if (effect === "missing")
      await db`delete from job_role_permission_overrides where permission_key='techcontracts.approvals.approve.workspace'`;
    else
      await db`update job_role_permission_overrides set effect='deny' where permission_key='techcontracts.approvals.approve.workspace'`;
    expect((await dispatch([{ kind: "pending_approvers" }], { entity: "contracts" })).sent).toBe(0);
    expect(
      (await dispatch([{ kind: "user", id: U }], { entity: "contracts", step: "explicit" })).sent,
    ).toBe(1);
    expect(await recipients()).toEqual([U]);
  },
);

it("selects only pending approvals bound to an awaiting run and the current workflow version", async () => {
  const pendingRun = randomUUID(),
    finishedRun = randomUUID();
  for (const [id, status] of [
    [pendingRun, "waiting_approval"],
    [finishedRun, "success"],
  ]) {
    await db`insert into workflow_runs(id,workspace_id,owner_id,workflow_id,event_id,entity,entity_id,status) values(${id},${W},${A},${WF},${EVENT},'deals',${X},${status})`;
  }
  await db`insert into workflow_approvals(workspace_id,workflow_id,run_id,entity,entity_id,approver_user_id,status,workflow_version) values
    (${W},${WF},${pendingRun},'deals',${X},${U},'pending',1),
    (${W},${WF},${pendingRun},'deals',${X},${C},'pending',2),
    (${W},${WF},${finishedRun},'deals',${X},${CEO},'pending',1)`;
  expect((await dispatch([{ kind: "pending_approvers" }])).sent).toBe(1);
  expect(await recipients()).toEqual([U]);
});

it.each(["missing", "deny"])(
  "requires canonical workflow decision permission even when source view remains allowed: %s",
  async (effect) => {
    const pendingRun = randomUUID();
    await db`insert into workflow_runs(id,workspace_id,owner_id,workflow_id,event_id,entity,entity_id,status) values(${pendingRun},${W},${A},${WF},${EVENT},'deals',${X},'waiting_approval')`;
    await db`insert into workflow_approvals(workspace_id,workflow_id,run_id,entity,entity_id,approver_user_id,status,workflow_version) values(${W},${WF},${pendingRun},'deals',${X},${U},'pending',1)`;
    if (effect === "missing")
      await db`delete from job_role_permission_overrides where permission_key='system.workflow_approvals.manage.workspace'`;
    else
      await db`update job_role_permission_overrides set effect='deny' where permission_key='system.workflow_approvals.manage.workspace'`;
    expect((await dispatch([{ kind: "pending_approvers" }])).sent).toBe(0);
    expect((await dispatch([{ kind: "user", id: U }], { step: "explicit" })).sent).toBe(1);
    expect(await recipients()).toEqual([U]);
  },
);

it("keeps parent project authorization when notifying a milestone", async () => {
  await source("project_milestones");
  expect((await dispatch([{ kind: "user", id: U }], { entity: "project_milestones" })).sent).toBe(
    1,
  );
  await db`truncate notifications`;
  await db`delete from job_role_permission_overrides where permission_key='techprojects.projects.view.workspace'`;
  expect(
    (
      await dispatch([{ kind: "user", id: U }], {
        entity: "project_milestones",
        step: "parent-denied",
      })
    ).sent,
  ).toBe(0);
  expect(await recipients()).toEqual([]);
});

it("honors stored workflow preferences without removing an existing historical notification", async () => {
  await dispatch();
  await db`update profiles set notification_preferences='{"workflow":{"inapp":false}}' where id=${U}`;
  const disabled = await dispatch([{ kind: "user", id: U }], { step: "disabled" });
  expect(disabled.sent).toBe(0);
  expect(disabled.issues).toContain("preferences_disabled");
  expect(await recipients()).toEqual([U]);
});

it("binds the run owner to the workflow owner while the explicit execution user owns the new notice", async () => {
  await db`update workflows set execution_user_id=${C} where id=${WF}`;
  await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${W},${ROLE},'system.workflows.view.workspace','grant'),(${W},${ROLE},'system.workflows.manage.workspace','grant')`;
  expect((await dispatch([{ kind: "workflow_owner" }])).sent).toBe(1);
  expect((await db`select owner_id,user_id from notifications`)[0]).toEqual({
    owner_id: C,
    user_id: C,
  });
  expect((await db`select owner_id from workflow_runs where id=${RUN}`)[0].owner_id).toBe(A);
});

it("uses a neutral notice for template variables instead of expanding private source content", async () => {
  expect(
    (
      await dispatch([{ kind: "user", id: U }], {
        title: "Salary {{salary}}",
        body: "{{document}}",
      })
    ).sent,
  ).toBe(1);
  const notice = (await db`select title,body,workspace_id,entity,entity_id from notifications`)[0];
  expect(notice.title).toBe("Atualização no TechERP");
  expect(notice.body).toBe("Acesse o registro para consultar os detalhes.");
  expect(notice.workspace_id).toBe(W);
  expect(notice.entity_id).toBe(X);
});

it.each(["authenticated", "anon"] as const)(
  "does not expose the dispatcher or private bridge to %s",
  async (role) => {
    await expect(
      withRole(
        role,
        role === "authenticated" ? U : null,
        (tx) =>
          tx`select public.notification_workflow_dispatch(${WF},${RUN},1,'deals',${X},'[{"kind":"workflow_owner"}]','Synthetic',null,'0')`,
      ),
    ).rejects.toThrow(/permission denied/i);
    for (const name of [
      "notification_source_visible",
      "notification_deal_leader",
      "notification_contract_approver",
    ])
      await expect(
        withRole(role, role === "authenticated" ? U : null, (tx) =>
          tx.unsafe(
            `select techerp_api.${name}($1,$2,${name === "notification_source_visible" ? "'deals'," : ""}$3)`,
            [W, U, X],
          ),
        ),
      ).rejects.toThrow(/permission denied/i);
  },
);

it("does not expose the private bridges even to the service caller", async () => {
  for (const name of [
    "notification_source_visible",
    "notification_deal_leader",
    "notification_contract_approver",
  ])
    await expect(
      withRole("service_role", null, (tx) =>
        tx.unsafe(
          `select techerp_api.${name}($1,$2,${name === "notification_source_visible" ? "'deals'," : ""}$3)`,
          [W, U, X],
        ),
      ),
    ).rejects.toThrow(/permission denied/i);
});

it("restores claims after successful private evaluation and after a policy exception", async () => {
  await db.begin(async (tx) => {
    const claims = JSON.stringify({ role: "service_role", audit: "original" });
    await tx`select set_config('request.jwt.claims',${claims},true)`;
    expect(
      (await tx`select techerp_api.notification_source_visible(${W},${U},'deals',${X}) allowed`)[0]
        .allowed,
    ).toBe(true);
    expect(
      (
        await tx`select current_setting('request.jwt.claims',true) claims, (select count(*)::int from techerp_api.subject_sessions) sessions`
      )[0],
    ).toEqual({ claims, sessions: 0 });
    await tx`select set_config('test.notification_throw','on',true)`;
    await expect(
      tx.savepoint(
        (sub) => sub`select techerp_api.notification_source_visible(${W},${U},'deals',${X})`,
      ),
    ).rejects.toThrow("notification fixture policy failure");
    expect(
      (
        await tx`select current_setting('request.jwt.claims',true) claims, (select count(*)::int from techerp_api.subject_sessions) sessions`
      )[0],
    ).toEqual({ claims, sessions: 0 });
  });
});

it("restores the private contract approver context on success, nested calls and policy errors", async () => {
  const approval = randomUUID();
  await db`insert into contract_approvals(id,workspace_id,contract_id,approver_id,status,sort_order,generation) values(${approval},${W},${X},${U},'pending',1,${GENERATION})`;
  await db.begin(async (tx) => {
    const claims = JSON.stringify({ role: "service_role", audit: "contract-context" });
    await tx`select set_config('request.jwt.claims',${claims},true)`;
    expect(
      (
        await tx`select techerp_api.notification_contract_approver(${W},${U},${approval}) allowed`
      )[0].allowed,
    ).toBe(true);
    expect(
      (
        await tx`select current_setting('request.jwt.claims',true) claims, (select count(*)::int from techerp_api.subject_sessions) sessions`
      )[0],
    ).toEqual({ claims, sessions: 0 });
    await tx`select set_config('test.notification_throw','on',true)`;
    await expect(
      tx.savepoint(
        (sub) => sub`select techerp_api.notification_contract_approver(${W},${U},${approval})`,
      ),
    ).rejects.toThrow("notification fixture policy failure");
    expect(
      (
        await tx`select current_setting('request.jwt.claims',true) claims, (select count(*)::int from techerp_api.subject_sessions) sessions`
      )[0],
    ).toEqual({ claims, sessions: 0 });
    await tx`select set_config('test.notification_throw','off',true),set_config('app.api_subject','on',true)`;
    await tx`insert into techerp_api.subject_sessions(txid,user_id,workspace_id,api_key_id,prev_claims) values(txid_current(),${A},${W},${WF},'{}')`;
    expect(
      (
        await tx`select techerp_api.notification_contract_approver(${W},${U},${approval}) allowed`
      )[0].allowed,
    ).toBe(false);
    expect(
      (
        await tx`select current_setting('request.jwt.claims',true) claims, (select user_id from techerp_api.subject_sessions where txid=txid_current()) actor`
      )[0],
    ).toEqual({ claims, actor: A });
    await tx`delete from techerp_api.subject_sessions where txid=txid_current()`;
  });
});

it("refuses a nested subject without deleting or replacing the existing context", async () => {
  await db.begin(async (tx) => {
    const claims = JSON.stringify({ role: "authenticated", sub: A });
    await tx`select set_config('request.jwt.claims',${claims},true),set_config('app.api_subject','on',true)`;
    await tx`insert into techerp_api.subject_sessions(txid,user_id,workspace_id,api_key_id,prev_claims) values(txid_current(),${A},${W},${WF},'{}')`;
    expect(
      (await tx`select techerp_api.notification_source_visible(${W},${U},'deals',${X}) allowed`)[0]
        .allowed,
    ).toBe(false);
    expect(
      (
        await tx`select current_setting('request.jwt.claims',true) claims, (select user_id from techerp_api.subject_sessions where txid=txid_current()) actor`
      )[0],
    ).toEqual({ claims, actor: A });
    await tx`delete from techerp_api.subject_sessions where txid=txid_current()`;
  });
});

it("rejects stale version, forged run/source and disabled workflow without partial writes", async () => {
  await expect(dispatch(undefined, { version: 2 })).rejects.toThrow();
  await expect(dispatch(undefined, { run: randomUUID() })).rejects.toThrow();
  await expect(dispatch(undefined, { record: randomUUID() })).rejects.toThrow();
  await db`update workflows set enabled=false where id=${WF}`;
  await expect(dispatch()).rejects.toThrow();
  expect(await recipients()).toEqual([]);
});

it("does not emit from a test run or a read-only view-as service context", async () => {
  await db`update workflow_runs set is_test=true where id=${RUN}`;
  await expect(dispatch()).rejects.toThrow();
  await db`update workflow_runs set is_test=false where id=${RUN}`;
  await db`insert into view_as_sessions(session_id,mode) values(${SESSION},'role')`;
  await expect(
    withRole(
      "service_role",
      null,
      (tx) =>
        tx`select public.notification_workflow_dispatch(${WF},${RUN},1,'deals',${X},'[{"kind":"workflow_owner"}]','Synthetic',null,'0')`,
      { session_id: SESSION },
    ),
  ).rejects.toThrow();
  expect(await recipients()).toEqual([]);
});
