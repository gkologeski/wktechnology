import { beforeAll, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  db,
  W,
  U,
  N,
  D,
  C,
  F,
  ROLE,
  withRole,
  request,
  fixtureJwt,
  fixtureHttpBase,
} from "../../tests/fixtures/notification-deliveries";
import { setupInboxExecutionCopy } from "../../tests/fixtures/inbox/runtime";
import {
  legacyAccessVector,
  assertLegacyAccessUnchanged,
} from "../../tests/fixtures/inbox/legacy-access";

// A real owned Docker/PostgREST fixture, never an environment-selected URL.
// Supabase's public-schema defaults are installed BEFORE the 0406 source is created.
beforeAll(async () => setupInboxExecutionCopy(db, { supabaseTableDefaults: true }), 60000);
const allowed = [
  "id",
  "workspace_id",
  "channel",
  "account_id",
  "conversation_id",
  "event_key",
  "message_id",
  "inbound_id",
  "actor_id",
  "assigned_to",
  "previous_status",
  "status",
  "occurred_at",
];
const source = "public.inbox_channel_occurrences";
async function controls() {
  return db`select jsonb_build_object(
    'functions',(select jsonb_agg(to_jsonb(x) order by x.oid) from
      (select p.oid,p.proowner,p.proacl,p.prosecdef,p.proconfig,p.prosrc,p.probin from pg_proc p
       join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','techerp_api','auth')) x),
    'policies',(select jsonb_agg(to_jsonb(x) order by x.oid) from pg_policy x),
    'triggers',(select jsonb_agg(to_jsonb(x) order by x.oid) from pg_trigger x),
    'roles',(select jsonb_agg(to_jsonb(x) order by x.oid) from pg_roles x),
    'memberships',(select jsonb_agg(to_jsonb(x) order by x.roleid,x.member) from pg_auth_members x),
    'other_relations',(select jsonb_agg(to_jsonb(x) order by x.oid) from
      (select c.oid,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity from pg_class c
       join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','techerp_api','auth')
       and c.oid<>'public.inbox_channel_occurrences'::regclass) x)
  ) controls`;
}

it("0453 closes real Supabase default table grants while preserving the 13-column RLS boundary, service transport and five legacy profiles", async () => {
  fixtureHttpBase();
  const legacyBefore = await legacyAccessVector(db);
  const controlsBefore = await controls();
  const defaults = await db`select r.rolname from pg_default_acl d
    join pg_namespace n on n.oid=d.defaclnamespace, lateral aclexplode(d.defaclacl) a
    join pg_roles r on r.oid=a.grantee where d.defaclrole='postgres'::regrole
    and n.nspname='public' and r.rolname in('anon','authenticated') and a.privilege_type='TRUNCATE'`;
  expect(defaults.map((row) => row.rolname).sort()).toEqual(["anon", "authenticated"]);
  const [exposed] = await db`select
    has_table_privilege('anon',${source},'TRUNCATE') anon_truncate,
    has_table_privilege('authenticated',${source},'INSERT,UPDATE,DELETE,TRUNCATE') auth_write,
    has_column_privilege('authenticated',${source},'envelope_id','SELECT') auth_private,
    (select relrowsecurity from pg_class where oid=${source}::regclass) rls`;
  expect(exposed).toEqual({ anon_truncate: true, auth_write: true, auth_private: true, rls: true });

  await db.unsafe(
    readFileSync("drizzle/migrations/0453_inbox_occurrence_default_privileges.sql", "utf8"),
  );
  expect(await controls()).toEqual(controlsBefore);
  assertLegacyAccessUnchanged(legacyBefore, await legacyAccessVector(db));
  const columns = await db`select a.attname,
    has_column_privilege('authenticated',a.attrelid,a.attnum,'SELECT') auth_select,
    has_column_privilege('anon',a.attrelid,a.attnum,'SELECT,INSERT,UPDATE,REFERENCES') anon_any
    from pg_attribute a where a.attrelid=${source}::regclass and a.attnum>0 and not a.attisdropped
    order by a.attnum`;
  expect(columns.filter((row) => row.auth_select).map((row) => row.attname)).toEqual(allowed);
  expect(columns.every((row) => row.anon_any === false)).toBe(true);
  const grants = await db`select role,
    has_table_privilege(role,${source},'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') any_table,
    has_any_column_privilege(role,${source},'INSERT,UPDATE,REFERENCES') any_column_write
    from unnest(array['anon','authenticated']) role`;
  expect(grants.every((row) => !row.any_table && !row.any_column_write)).toBe(true);
  const privateTables = await db`select n.nspname,c.relname,role,
    has_table_privilege(role,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') any_table,
    has_any_column_privilege(role,c.oid,'SELECT,INSERT,UPDATE,REFERENCES') any_column
    from pg_class c join pg_namespace n on n.oid=c.relnamespace,
      unnest(array['anon','authenticated']) role
    where c.relkind='r' and ((n.nspname='public' and c.relname=any(array[
      'inbox_channel_evidence','inbox_workflow_activations','gmail_workflow_pending','gmail_sync_queue',
      'inbox_widget_receipts','inbox_unipile_envelopes','inbox_transition_receipts','inbox_response_receipts']))
      or (n.nspname='techerp_api' and c.relname=any(array['inbox_response_epoch',
        'inbox_response_history_barriers','inbox_gmail_recovery','inbox_gmail_recovery_attempts'])))`;
  expect(privateTables).toHaveLength(24);
  expect(privateTables.every((row) => !row.any_table && !row.any_column)).toBe(true);
  await expect(
    withRole("anon", null, (tx) => tx.unsafe(`select id from ${source}`)),
  ).rejects.toMatchObject({ code: "42501" });
  await expect(
    withRole("authenticated", U, (tx) => tx.unsafe(`select envelope_id from ${source}`)),
  ).rejects.toMatchObject({ code: "42501" });
  for (const role of ["anon", "authenticated"] as const)
    await expect(
      withRole(role, role === "anon" ? null : U, (tx) => tx.unsafe(`truncate ${source}`)),
    ).rejects.toMatchObject({ code: "42501" });

  // The same canonical service producer still persists an inbound message and proof.
  await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect)
    values(${W},${ROLE},'techsales.inbox.chat.view.workspace','grant') on conflict do nothing`;
  const [deniedRole] = await db`select role_id from user_job_roles where workspace_id=${W}
    and user_id=${D} and role_id<>${ROLE} limit 1`;
  expect(deniedRole).toBeDefined();
  await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect)
    values(${W},${deniedRole!.role_id},'techsales.inbox.chat.view.workspace','deny') on conflict do nothing`;
  const conversation = randomUUID(),
    visitor = randomUUID();
  await db`insert into live_chat_sessions(id,workspace_id,owner_id,assignee_id,visitor_id,status)
    values(${conversation},${W},${W},${U},${visitor},'open')`;
  const received = await request(
    "/rpc/widget_inbound_commit",
    {
      p_session: conversation,
      p_visitor: visitor,
      p_request: randomUUID(),
      p_body: "Owned default-ACL regression",
    },
    U,
    fixtureJwt("service_role"),
  );
  expect(received.status, JSON.stringify(received.payload)).toBe(200);
  const serviceRows = await withRole("service_role", null, (tx) =>
    tx.unsafe(`select envelope_id,occurrence_key,received_at from ${source}`),
  );
  expect(serviceRows.length).toBeGreaterThan(0);
  for (const actor of [U, N, D, C, F]) {
    const rows = await withRole("authenticated", actor, (tx) =>
      tx.unsafe(`select ${allowed.join(",")} from ${source}`),
    );
    expect(rows.length, actor).toBe(actor === U ? serviceRows.length : 0);
  }
});
