import { afterAll, beforeAll } from "vitest";
import postgres from "postgres";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHmac, randomBytes, randomUUID } from "node:crypto";

// Actual gateway, private RLS bridge and production permission predicates in a
// disposable PostgreSQL. HTTP cases use cryptographically verified synthetic JWTs
// in real PostgREST, not GoTrue login or any production credential.
const MIGRATION = "drizzle/migrations/0392_notification_center.sql";
const image = "postgres@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b";
const postgrestImage =
  "postgrest/postgrest@sha256:e9490aa503a5fb07d8e8c80da46e5c0c193894e583b59ed9077e74c4101ffae2";
const docker =
  process.platform === "darwin"
    ? "/Applications/Docker.app/Contents/Resources/bin/docker"
    : "docker";
const container = "techerp-notification-deliveries-ci-" + randomUUID();
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
const X = "d1000000-0000-4000-8000-000000000001";
const MANAGER_PERSON = "d1000000-0000-4000-8000-000000000002";
const WF = "e1000000-0000-4000-8000-000000000001";
const RUN = "e1000000-0000-4000-8000-000000000002";
const EVENT = "e1000000-0000-4000-8000-000000000003";
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
  const source = readFileSync(file, "utf8").replaceAll(
    "CREATE FUNCTION ",
    "CREATE OR REPLACE FUNCTION ",
  );
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
  for (const name of names) {
    try {
      await db.unsafe(productionFunction(file, name));
    } catch (e) {
      throw new Error(
        `Production function ${file}::${name}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
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
  temporary = mkdtempSync(join(tmpdir(), "techerp-notification-deliveries-ci-"));
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
    const sourceResource =
      table === "activities"
        ? "(CASE type::text WHEN 'note' THEN 'techsales.notes' WHEN 'task' THEN 'techsales.tasks' ELSE 'techsales.activities' END)"
        : "'" + resource + "'";
    await db.unsafe(
      `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;GRANT SELECT ON public.${table} TO authenticated;CREATE POLICY source_read ON public.${table} FOR SELECT TO authenticated USING(public.sales_context_access((SELECT public.sales_access_context()),workspace_id,${sourceResource},'view',ARRAY[${responsible}]::uuid[]))`,
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
  await db.unsafe(readFileSync("drizzle/migrations/0391_notification_recipients.sql", "utf8"));
  await load("drizzle/migrations/0374_hiring_preparation_conditions.sql", [
    "hiring_preparation_access",
  ]);
  await db.unsafe(readFileSync("tests/fixtures/notification-center.sql", "utf8"));
  await db.unsafe(
    "CREATE POLICY source_read ON hiring_preparation_requests FOR SELECT TO authenticated USING(public.hiring_preparation_access(workspace_id,kind,'view'))",
  );
  for (const [table, resource, responsible] of [
    ["whatsapp_conversations", "techsales.inbox.whatsapp", "assigned_to"],
    ["email_threads", "techsales.inbox.email", "assigned_to"],
    ["live_chat_sessions", "techsales.inbox.chat", "assignee_id"],
    ["linkedin_conversations", "techsales.inbox.whatsapp", "assigned_to"],
  ])
    await db.unsafe(
      `CREATE POLICY source_read ON ${table} FOR SELECT TO authenticated USING(public.sales_context_access((SELECT public.sales_access_context()),workspace_id,'${resource}','view',ARRAY[coalesce(${responsible},owner_id)]))`,
    );
  await db.unsafe(readFileSync(MIGRATION, "utf8"));
  await load("drizzle/migrations/0249_permission_introspection_boundary.sql", [
    "work_subject_context",
  ]);
  await load("drizzle/migrations/0129_active_admin_requires_active_membership.sql", [
    "is_active_workspace_admin",
  ]);
  await db.unsafe(
    readFileSync("drizzle/migrations/0131_workflow_delivery_ledger_and_send_policy.sql", "utf8"),
  );
  await db.unsafe(readFileSync("tests/fixtures/notification-deliveries.sql", "utf8"));
  await load("drizzle/migrations/0301_whatsapp_number_suppressions.sql", ["wa_phone_key"]);
  try {
    await db.unsafe(readFileSync("drizzle/migrations/0393_notification_deliveries.sql", "utf8"));
  } catch (e) {
    const detail = e as {
      position?: string;
      internal_position?: string;
      internal_query?: string;
      message?: string;
    };
    throw new Error(
      `Migration 0393 position ${detail.position} / internal ${detail.internal_position}: ${detail.message}; ${detail.internal_query ?? ""}`,
    );
  }
  const historic = await db`select count(*)::integer n from notification_workspace_context`;
  if (historic[0].n !== 0) throw Error("Historical rows were attributed to a workspace");
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
    if (apiStarted) dockerRun("rm", "-f", apiContainer);
  } finally {
    try {
      if (db) await db.end({ timeout: 2 });
    } finally {
      try {
        if (started) dockerRun("rm", "-f", container);
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

export async function reset() {
  await db.unsafe(
    "TRUNCATE workflow_deliveries,notification_delivery_intents,notification_delivery_policies,notification_delivery_consents,workflow_send_policies,wa_cloud_numbers,wa_cloud_connections,whatsapp_number_suppressions,whatsapp_messages,auth.users CASCADE",
  );
  await db.unsafe(
    "TRUNCATE service_agent_sessions,sdr_enrollments,sdr_playbooks,contract_drafts,contract_draft_approvers,notification_workspace_context,notification_user_preferences,notifications,workflow_approvals,contract_approvals,project_members,hiring_demand_steps,hiring_demand_requests,hiring_area_policies,workflow_runs,workflow_events,workflows,workspaces,profiles,workspace_members,user_job_roles,job_roles,job_role_permission_overrides,user_groups,user_group_members,view_as_sessions CASCADE",
  );
  for (const t of [
    "email_threads",
    "live_chat_sessions",
    "linkedin_conversations",
    "whatsapp_conversations",
    "hiring_preparation_requests",
  ])
    await db.unsafe(`DELETE FROM ${t}`);
  await db`insert into workspaces(id,created_by) values(${W},${A}),(${B},${A})`;
  for (const id of [A, U, C, D, N, F, CEO]) {
    await db`insert into profiles(id,active_workspace_id,phone,notification_preferences) values(${id},${id === F ? B : W},'+5548999990001','{"workflow":{"email":true}}')`;
    await db`insert into auth.users(id,email,email_confirmed_at) values(${id},${id.slice(0, 8) + "@fixture.invalid"},now())`;
  }
  for (const id of [A, U, C, D, N, CEO])
    await db`insert into workspace_members(workspace_id,user_id) values(${W},${id})`;
  await db`insert into workspace_members(workspace_id,user_id) values(${B},${F})`;
  await db`insert into job_roles(id,workspace_id) values(${ROLE},${W})`;
  for (const id of [U, C, D, CEO])
    await db`insert into user_job_roles(role_id,user_id,workspace_id,owner_id) values(${ROLE},${id},${W},${W})`;
  for (const key of [
    ...readKeys,
    "system.workflows.view.workspace",
    "system.workflows.manage.workspace",
    "system.notification_settings.view.workspace",
    "system.notification_settings.manage.workspace",
    "system.notification_deliveries.view.workspace",
    "system.channels.view.workspace",
    "system.whatsapp.manage.workspace",
    "techsales.inbox.email.view.workspace",
    "techsales.inbox.email.create.workspace",
    "techsales.inbox.whatsapp.view.workspace",
    "techsales.inbox.whatsapp.create.workspace",
  ])
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
  await db`insert into wa_cloud_connections(id,workspace_id,enabled,webhook_verified_at) values(${X},${W},true,now())`;
  await db`insert into wa_cloud_numbers(phone_number_id,connection_id,workspace_id,display_phone_number,quality_rating,status,available) values('123456789',${X},${W},'+554861360001','GREEN','CONNECTED',true)`;
}
export async function withRole<T>(
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
export function fixtureJwt(
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

export async function request(
  path: string,
  body?: Record<string, unknown>,
  actor = U,
  token?: string,
) {
  const response = await fetch(httpBase + path, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + (token ?? fixtureJwt("authenticated", actor)),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(4000),
  });
  return { status: response.status, payload: await response.json() };
}
export { db, W, B, A, U, C, D, N, F, ROLE, X, WF, RUN, EVENT };
