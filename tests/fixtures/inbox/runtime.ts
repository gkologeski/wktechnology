import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
import type postgres from "postgres";
import { setupNotificationWhatsAppReceived } from "../notification-whatsapp-received";
import { db as ownedDatabase, fixtureHttpBase } from "../notification-deliveries";
import {
  prepareLegacyAccessVector,
  legacyAccessVector,
  assertLegacyAccessUnchanged,
} from "./legacy-access";

let releaseGuardDefinition: string | undefined;

async function assertOwnedCopy(db: postgres.Sql) {
  if (db !== ownedDatabase) throw new Error("Refused: not the owned disposable CI database");
  fixtureHttpBase();
  const [target] = await db`select current_database() name`;
  if (target?.["name"] !== "techerp_notification_ci") {
    throw new Error("Refused: unexpected database for lock-free CI fixtures");
  }
}

// Availability is the sole excluded trigger; compare actual controls, not just
// their presence. No worker, proof, cutoff, RLS, deny or consent stub is allowed.
async function authorizationSnapshot(db: postgres.Sql) {
  return db`select jsonb_build_object(
    'relations',(select jsonb_agg(to_jsonb(x) order by x.oid) from
      (select c.oid,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity
       from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname in ('public','techerp_api','auth')) x),
    'policies',(select jsonb_agg(to_jsonb(x) order by x.oid) from pg_policy x),
    'triggers',(select jsonb_agg(to_jsonb(x) order by x.oid) from pg_trigger x
      where not (x.tgname='inbox_runtime_release_guard'
        and x.tgrelid='public.workflows'::regclass)),
    'functions',(select jsonb_agg(to_jsonb(x) order by x.oid) from
      (select p.oid,p.proowner,p.proacl,p.prosecdef,p.proconfig,p.prosrc,p.probin
       from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname in ('public','techerp_api','auth')) x),
    'roles',(select jsonb_agg(to_jsonb(x) order by x.oid) from pg_roles x),
    'memberships',(select jsonb_agg(to_jsonb(x) order by x.roleid,x.member)
      from pg_auth_members x)
  ) controls`;
}

/** Restore the exact blocked version for an activation test, only on owned CI. */
export async function withInboxAvailabilityLock(
  db: postgres.Sql,
  check: () => Promise<void>,
  release = false,
) {
  await assertOwnedCopy(db);
  if (!releaseGuardDefinition) throw new Error("Missing canonical availability trigger");
  const before = await authorizationSnapshot(db);
  await db.unsafe(releaseGuardDefinition);
  try {
    await check();
  } finally {
    try {
      if (release)
        await db.unsafe(
          readFileSync("drizzle/migrations/0452_inbox_channel_runtime_release.sql", "utf8"),
        );
    } finally {
      await db.unsafe("DROP TRIGGER IF EXISTS inbox_runtime_release_guard ON public.workflows");
      assert.deepEqual(await authorizationSnapshot(db), before);
    }
  }
}

/** Authorized CI copy only: the caller owns a Docker database from the existing
 * notification fixture. Never call this against PG*, Supabase or a draft URL. */
export async function setupInboxExecutionCopy(
  db: postgres.Sql,
  options: { supabaseTableDefaults?: boolean } = {},
) {
  // Identity, not a configurable URL: only the connection created by the
  // dedicated Docker fixture may ever reach the lock-free preparation.
  await assertOwnedCopy(db);
  await setupNotificationWhatsAppReceived(db);
  await db.unsafe(
    "ALTER TABLE public.workflows ALTER COLUMN status SET DEFAULT 'draft', ALTER COLUMN published_version SET DEFAULT 0",
  );
  // Exact schema-only checks captured read-only from main 37df8c84; no business rows.
  await db.unsafe(readFileSync("tests/fixtures/inbox/source-constraints.sql", "utf8"));
  await db.unsafe(`
    CREATE TABLE public.email_accounts(id uuid PRIMARY KEY,workspace_id uuid,owner_id uuid,
      provider text,status text,email text,history_id text,last_sync_at timestamptz,last_error text,
      access_token text,refresh_token text,expires_at timestamptz);
    CREATE TABLE public.email_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,
      owner_id uuid,account_id uuid,thread_id uuid,provider_message_id text,direction text,
      received_at timestamptz,sent_at timestamptz,created_at timestamptz DEFAULT clock_timestamp(),
      body_text text,body_html text,from_name text,from_email text,snippet text,subject text,to_emails text[],
      cc_emails text[],bcc_emails text[],in_reply_to text,headers jsonb,has_attachments boolean,attachments jsonb,
      UNIQUE(account_id,provider_message_id));
    ALTER TABLE public.email_threads ADD COLUMN account_id uuid,ADD COLUMN provider_thread_id text,
      ADD COLUMN subject text,ADD COLUMN created_at timestamptz DEFAULT clock_timestamp();
    ALTER TABLE public.email_threads ADD COLUMN IF NOT EXISTS snippet text,
      ADD COLUMN IF NOT EXISTS last_message_at timestamptz,ADD COLUMN IF NOT EXISTS contact_id uuid,
      ADD COLUMN IF NOT EXISTS lead_id uuid,ADD COLUMN IF NOT EXISTS deal_id uuid,ADD COLUMN IF NOT EXISTS company_id uuid;
    CREATE UNIQUE INDEX ON public.email_threads(account_id,provider_thread_id);
    ALTER TABLE public.live_chat_sessions ADD COLUMN visitor_id text,ADD COLUMN visitor_name text,
      ADD COLUMN visitor_email text,ADD COLUMN status text DEFAULT 'open',
      ADD COLUMN created_at timestamptz DEFAULT clock_timestamp(),ADD COLUMN last_message_at timestamptz;
    CREATE TABLE public.live_chat_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid,owner_id uuid,session_id uuid REFERENCES public.live_chat_sessions(id),
      direction text,body text,author_user_id uuid,created_at timestamptz DEFAULT clock_timestamp());
    CREATE TABLE public.service_agent_jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,
      session_id uuid REFERENCES public.service_agent_sessions(id),status text DEFAULT 'queued',
      sent_at timestamptz,send_started_at timestamptz,send_token uuid,outbound_message_id uuid,
      provider_message_id text,draft_text text);
    ALTER TABLE public.service_agent_jobs ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON public.service_agent_jobs TO authenticated;
    GRANT ALL ON public.service_agent_jobs TO service_role;
    CREATE TABLE public.unipile_accounts(id uuid PRIMARY KEY,workspace_id uuid,owner_id uuid,status text);
    CREATE TABLE public.financial_recurrences(id uuid PRIMARY KEY,workspace_id uuid,owner_id uuid,assigned_to uuid);
    ALTER TABLE public.financial_recurrences ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON public.financial_recurrences TO authenticated;
    ALTER TABLE public.linkedin_conversations ADD COLUMN account_id uuid,ADD COLUMN provider_chat_id text,
      ADD COLUMN status text DEFAULT 'open',ADD COLUMN sender_id text,ADD COLUMN title text,
      ADD COLUMN snippet text DEFAULT '',ADD COLUMN last_message_at timestamptz DEFAULT now(),
      ADD COLUMN created_at timestamptz DEFAULT now(),ADD COLUMN identity_status text DEFAULT 'unresolved',
      ADD COLUMN contact_id uuid,ADD COLUMN lead_id uuid,ADD COLUMN company_id uuid,ADD COLUMN deal_id uuid;
    CREATE UNIQUE INDEX ON public.linkedin_conversations(account_id,provider_chat_id);
    ALTER TABLE public.linkedin_conversations ALTER COLUMN id SET DEFAULT gen_random_uuid();
    CREATE TABLE public.linkedin_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,account_id uuid,
      conversation_id uuid,direction text,provider_message_id text,body text,created_at timestamptz DEFAULT now(),
      UNIQUE(account_id,provider_message_id));
    CREATE TABLE public.unipile_message_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account_id uuid,
      target_identifier text,candidate_id uuid,created_at timestamptz DEFAULT now());
    CREATE TABLE public.ats_sourcing_enrollments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id uuid,
      workspace_id uuid,candidate_id uuid,status text,finished_at timestamptz,next_run_at timestamptz,last_error text);
    GRANT SELECT ON public.email_accounts,public.email_messages,public.live_chat_messages,
      public.unipile_accounts,public.linkedin_messages TO authenticated;
    GRANT ALL ON public.email_accounts,public.email_messages,public.live_chat_messages,
      public.unipile_accounts,public.linkedin_messages TO service_role;
    ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.live_chat_messages ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.unipile_accounts ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.linkedin_messages ENABLE ROW LEVEL SECURITY;
  `);
  // Replace—not supplement—the test fixture's permissive source policy with
  // the canonical Inbox policy. No permissive authorization stub is installed.
  // This source contains only the canonical legacy trigger function and its
  // ACL, which 0432 must replace without changing its identity or privileges.
  await db.unsafe(
    readFileSync("drizzle/migrations/0056_inbox_first_unread_notification.sql", "utf8"),
  );
  const accountAuthorization = readFileSync(
    "drizzle/migrations/0222_order4_sales_prepare.sql",
    "utf8",
  );
  const accountStart = accountAuthorization.indexOf(
    "CREATE OR REPLACE FUNCTION public.sales_account_job_authorize(",
  );
  const accountEnd = accountAuthorization.indexOf("\n-- Generic workflow DML", accountStart);
  if (accountStart < 0 || accountEnd < accountStart)
    throw new Error("Missing canonical account background authorization and ACL");
  await db.unsafe(accountAuthorization.slice(accountStart, accountEnd));
  const canonical = readFileSync("drizzle/migrations/0223_order4_sales_activate.sql", "utf8");
  const financePolicy = readFileSync("drizzle/migrations/0211_finance_core_activation.sql", "utf8")
    .split("\n")
    .find((line) => line.startsWith("CREATE POLICY finance_view ON public.financial_recurrences "));
  if (!financePolicy) throw new Error("Missing canonical recurrence read policy");
  await db.unsafe(financePolicy);
  const serviceJobPolicy = readFileSync("drizzle/migrations/0258_service_agent_queue.sql", "utf8");
  const serviceJobStart = serviceJobPolicy.indexOf("CREATE POLICY service_agent_job_read ");
  const serviceJobEnd = serviceJobPolicy.indexOf(
    "CREATE POLICY service_agent_evidence_read ",
    serviceJobStart,
  );
  if (serviceJobStart < 0 || serviceJobEnd <= serviceJobStart)
    throw new Error("Missing canonical service job read policy");
  await db.unsafe(serviceJobPolicy.slice(serviceJobStart, serviceJobEnd));
  // The base delivery fixture only reads Workflows. Install the exact existing
  // product DML policies for the interactive lifecycle tests, not an allow stub.
  // These table-level DML privileges were verified read-only in the main catalogue.
  await db.unsafe("GRANT INSERT,UPDATE,DELETE ON public.workflows TO authenticated");
  for (const action of ["create", "update", "delete"]) {
    const policy = canonical
      .split("\n")
      .find((line) => line.startsWith(`CREATE POLICY sales_${action} ON public."workflows"`));
    if (!policy) throw new Error(`Missing canonical Workflow ${action} policy`);
    await db.unsafe(policy);
  }
  for (const table of ["email_threads", "live_chat_sessions"]) {
    const policy = canonical
      .split("\n")
      .find((line) => line.startsWith(`CREATE POLICY sales_view ON public."${table}"`));
    if (!policy) throw new Error(`Missing canonical policy for ${table}`);
    await db.unsafe(`DROP POLICY source_read ON public.${table}`);
    await db.unsafe(policy);
    const update = canonical
      .split("\n")
      .find((line) => line.startsWith(`CREATE POLICY sales_update ON public."${table}"`));
    if (!update) throw new Error(`Missing canonical ${table} update policy`);
    await db.unsafe(update);
    await db.unsafe(`GRANT UPDATE ON public.${table} TO authenticated`);
  }
  for (const table of ["email_accounts", "email_messages", "live_chat_messages"]) {
    const policy = canonical
      .split("\n")
      .find((line) => line.startsWith(`CREATE POLICY sales_view ON public."${table}"`));
    if (!policy) throw new Error(`Missing canonical ${table} read policy`);
    await db.unsafe(policy);
  }
  const chatCreate = canonical
    .split("\n")
    .find((line) => line.startsWith('CREATE POLICY sales_create ON public."live_chat_messages"'));
  if (!chatCreate) throw new Error("Missing canonical chat message create policy");
  await db.unsafe(chatCreate);
  await db.unsafe("GRANT INSERT ON public.live_chat_messages TO authenticated");
  // Real personal credential / Inbox boundaries and canonical projection; no
  // workspace-scoped substitute for the owner-only LinkedIn model.
  const ownerPolicy = readFileSync(
    "supabase/migrations/20260815115105_988be5d1-f959-49ff-81b4-8c088d5f6f07.sql",
    "utf8",
  );
  const ownerStart = ownerPolicy.indexOf('CREATE POLICY "owner manages unipile_accounts"');
  const ownerEnd = ownerPolicy.indexOf(";", ownerStart) + 1;
  if (ownerStart < 0 || ownerEnd <= ownerStart)
    throw new Error("Missing canonical Unipile owner policy");
  await db.unsafe(ownerPolicy.slice(ownerStart, ownerEnd));
  await db.unsafe(
    readFileSync("drizzle/migrations/0336_unipile_personal_account_access.sql", "utf8"),
  );
  await db.unsafe(readFileSync("drizzle/migrations/0339_unipile_inbound_idempotency.sql", "utf8"));
  const linkedin = readFileSync("drizzle/migrations/0342_linkedin_inbox.sql", "utf8");
  const accessStart = linkedin.indexOf("CREATE FUNCTION public.linkedin_inbox_access(");
  const accessEnd = linkedin.indexOf(
    "CREATE UNIQUE INDEX unipile_account_tenant_owner",
    accessStart,
  );
  await db.unsafe(linkedin.slice(accessStart, accessEnd));
  await db.unsafe("DROP POLICY source_read ON public.linkedin_conversations");
  await db.unsafe(
    "GRANT ALL ON public.linkedin_conversations,public.linkedin_messages TO service_role",
  );
  const policyStart = linkedin.indexOf("CREATE POLICY linkedin_conversation_read ");
  const policyEnd = linkedin.indexOf(
    "CREATE FUNCTION public.linkedin_project_inbound()",
    policyStart,
  );
  await db.unsafe(linkedin.slice(policyStart, policyEnd));
  const projectionEnd = linkedin.indexOf(
    "-- Projection of an already-existing private journal",
    policyEnd,
  );
  await db.unsafe(linkedin.slice(policyEnd, projectionEnd));
  const editStart = linkedin.indexOf("CREATE FUNCTION public.linkedin_conversation_edit(");
  const editEnd = linkedin.indexOf("DO $$ BEGIN", editStart);
  await db.unsafe(linkedin.slice(editStart, editEnd));
  // Physical private sequence journal fields needed by canonical receipt proof.
  // No permissive policies or provider/send implementations are replaced here.
  await db.unsafe(`
    CREATE TABLE public.prospecting_sequence_runs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,owner_id uuid NOT NULL,state text DEFAULT 'active');
    CREATE TABLE public.prospecting_sequence_effects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,run_id uuid NOT NULL REFERENCES public.prospecting_sequence_runs(id),
      kind text,status text,provider_receipt jsonb,sender jsonb,finished_at timestamptz);
    ALTER TABLE public.prospecting_sequence_runs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.prospecting_sequence_effects ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.prospecting_sequence_runs,public.prospecting_sequence_effects FROM PUBLIC,anon,authenticated;
    GRANT SELECT,DELETE ON public.prospecting_sequence_runs,public.prospecting_sequence_effects TO service_role;
    GRANT ALL ON public.email_threads TO service_role;
    GRANT UPDATE(active_workspace_id) ON public.profiles TO service_role;
  `);
  const receiptSchema = readFileSync(
    "drizzle/migrations/0340_unipile_delivery_receipts.sql",
    "utf8",
  );
  await db.unsafe(
    receiptSchema.slice(0, receiptSchema.indexOf("CREATE FUNCTION public.unipile_delivery_begin(")),
  );
  const finishStart = receiptSchema.indexOf("CREATE FUNCTION public.unipile_delivery_finish(");
  const finishEnd = receiptSchema.indexOf(
    "REVOKE ALL ON FUNCTION public.unipile_delivery_begin",
    finishStart,
  );
  if (finishStart < 0 || finishEnd <= finishStart)
    throw new Error("Missing canonical Unipile confirmation CAS");
  await db.unsafe(receiptSchema.slice(finishStart, finishEnd));
  await db.unsafe(
    "REVOKE ALL ON FUNCTION public.unipile_delivery_finish(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.unipile_delivery_finish(uuid,uuid,text,jsonb) TO service_role",
  );
  // Canonical pre-existing restrictive chat policies remain in force; package2
  // does not turn the historical team-only create key into additional access.
  const structural = readFileSync("drizzle/migrations/0122_rbac_wk_phase1_structural.sql", "utf8");
  const helper = structural.indexOf("CREATE OR REPLACE FUNCTION public.my_perm_workspaces(");
  if (helper < 0) throw new Error("Missing canonical per-key workspace resolver");
  const platform = readFileSync(
    "supabase/migrations/20260527010039_b86aafc5-9783-487b-97e5-0186fcb677eb.sql",
    "utf8",
  );
  const platformTable = platform.indexOf("CREATE TABLE public.platform_admins (");
  const platformEnd = platform.indexOf("-- 3) workspace_members", platformTable);
  await db.unsafe(platform.slice(platformTable, platformEnd));
  const platformFunction = platform.indexOf("CREATE OR REPLACE FUNCTION public.is_platform_admin(");
  const platformFunctionEnd = platform.indexOf(
    "CREATE OR REPLACE FUNCTION public.is_workspace_member(",
    platformFunction,
  );
  await db.unsafe(platform.slice(platformFunction, platformFunctionEnd));
  await db.unsafe(
    "REVOKE EXECUTE ON FUNCTION public.is_platform_admin(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated,service_role",
  );
  const team = readFileSync(
    "drizzle/migrations/0120_activities_team_scope_active_membership.sql",
    "utf8",
  );
  const teamStart = team.indexOf("CREATE OR REPLACE FUNCTION public.my_team_member_ids()");
  const teamEnd = team.indexOf(
    "CREATE OR REPLACE FUNCTION public.my_team_member_pairs()",
    teamStart,
  );
  await db.unsafe(team.slice(teamStart, teamEnd));
  await db.unsafe(
    "REVOKE ALL ON FUNCTION public.my_team_member_ids() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.my_team_member_ids() TO authenticated,service_role",
  );
  await db.unsafe(structural.slice(helper));
  const migrations = readdirSync("drizzle/migrations")
    .filter((file) => {
      const version = Number(file.slice(0, 4));
      return file.endsWith(".sql") && version >= 406 && version <= 451;
    })
    .sort();
  const legacyBefore = await prepareLegacyAccessVector(db);
  if (options.supabaseTableDefaults)
    await db.unsafe(
      "ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated",
    );
  for (const file of migrations) {
    await db.unsafe(readFileSync(`drizzle/migrations/${file}`, "utf8"));
  }
  assertLegacyAccessUnchanged(legacyBefore, await legacyAccessVector(db));
  // Test-only availability change on the owned disposable CI copy.
  // All migrations first execute their real catalog/lock assertions. This
  // operation is never shared with the draft fixture loader or shipped runtime.
  await db.unsafe(`CREATE TRIGGER notify_assigned_live_chat_message AFTER INSERT
    ON public.live_chat_messages FOR EACH ROW EXECUTE FUNCTION public.notify_assigned_inbox_message()`);
  const [guard] = await db`select pg_get_triggerdef(oid) definition from pg_trigger
    where tgrelid='public.workflows'::regclass and tgname='inbox_runtime_release_guard'
      and tgenabled='O'`;
  if (typeof guard?.["definition"] !== "string") throw new Error("Canonical release lock missing");
  releaseGuardDefinition = guard["definition"];
  const before = await authorizationSnapshot(db);
  if (options.supabaseTableDefaults)
    await db.unsafe(
      readFileSync("drizzle/migrations/0452_inbox_channel_runtime_release.sql", "utf8"),
    );
  else await db.unsafe("DROP TRIGGER inbox_runtime_release_guard ON public.workflows");
  assert.deepEqual(await authorizationSnapshot(db), before);
  // The regression fixture first measures the real pre-0453 exposure. Every
  // normal runtime fixture uses the final reviewed ACL before its tests run.
  if (!options.supabaseTableDefaults)
    await db.unsafe(
      readFileSync("drizzle/migrations/0453_inbox_occurrence_default_privileges.sql", "utf8"),
    );
}
