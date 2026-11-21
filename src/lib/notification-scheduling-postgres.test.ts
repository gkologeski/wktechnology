import { beforeEach, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  db,
  W,
  B,
  A,
  U,
  C,
  F,
  ROLE,
  X,
  WF,
  reset,
  withRole,
  request,
  fixtureJwt,
} from "../../tests/fixtures/notification-deliveries";
import { workflowNotificationEventTrigger } from "./workflows/notification-events";

beforeEach(reset);

const policy = {
  email_enabled: true,
  whatsapp_enabled: false,
  email_daily_limit: 20,
  whatsapp_daily_limit: 20,
  wa_sender_id: null,
  wa_template_name: null,
  wa_template_language: null,
  wa_estimated_unit_micros: 0,
  wa_daily_budget_micros: 0,
  currency: "BRL",
  digest_enabled: true,
  followups_enabled: true,
  followup_daily_limit: 10,
};
const digest = {
  enabled: true,
  frequency: "daily",
  at: "08:30",
  timezone: "America/Sao_Paulo",
  weekday: 1,
  channels: ["email"],
};
const savePolicy = (settings: Record<string, unknown> = policy, revision = 0, actor = U, ws = W) =>
  withRole(
    "authenticated",
    actor,
    async (tx) =>
      (
        await tx`select notification_delivery_settings_save(${ws},${tx.json(JSON.parse(JSON.stringify(settings)))},${revision}) result`
      )[0].result,
  );
const getDigest = (actor = U, ws = W) =>
  request("/rpc/get_notification_digest_settings", { p_workspace: ws }, actor);
const saveDigest = (settings: Record<string, unknown> = digest, revision = 0, actor = U, ws = W) =>
  request(
    "/rpc/save_notification_digest_settings",
    {
      p_workspace: ws,
      p_settings: settings,
      p_revision: revision,
    },
    actor,
  );
const scheduleTick = (limit = 100) =>
  request("/rpc/notification_schedule_tick", { p_limit: limit }, U, fixtureJwt("service_role"));
const claim = (id: string) =>
  request("/rpc/notification_delivery_claim", { p_id: id }, U, fixtureJwt("service_role"));
const preflight = (id: string, token: string) =>
  request(
    "/rpc/notification_delivery_preflight",
    { p_id: id, p_token: token },
    U,
    fixtureJwt("service_role"),
  );

it("Scheduling notifications allow authorized member", async () => {
  expect((await savePolicy()).policy).toMatchObject({
    digest_enabled: true,
    followups_enabled: true,
  });
  expect(await getDigest()).toMatchObject({
    status: 200,
    payload: { settings: { enabled: false }, revision: 0 },
  });
  expect(await saveDigest()).toMatchObject({
    status: 200,
    payload: { settings: digest, revision: 1 },
  });
});
it("Scheduling notifications reject missing permission", async () => {
  await db`delete from job_role_permission_overrides where workspace_id=${W} and role_id=${ROLE} and permission_key='system.notification_settings.manage.workspace'`;
  await expect(savePolicy()).rejects.toMatchObject({ code: "42501" });
  expect((await db`select count(*)::integer n from notification_delivery_policies`)[0].n).toBe(0);
});
it("Scheduling notifications reject explicit deny", async () => {
  await db`update job_role_permission_overrides set effect='deny' where workspace_id=${W} and role_id=${ROLE} and permission_key='system.notification_settings.manage.workspace'`;
  await expect(savePolicy()).rejects.toMatchObject({ code: "42501" });
  expect((await db`select count(*)::integer n from notification_delivery_policies`)[0].n).toBe(0);
});
it("Scheduling notifications reject foreign workspace", async () => {
  await expect(savePolicy(policy, 0, U, B)).rejects.toMatchObject({ code: "42501" });
  await expect(savePolicy(policy, 0, F, W)).rejects.toMatchObject({ code: "42501" });
  expect((await getDigest(F, W)).status).toBe(403);
  expect((await saveDigest(digest, 0, U, B)).status).toBe(403);
});
it("Scheduling notifications reject inactive member", async () => {
  await db`update workspace_members set status='inactive' where workspace_id=${W} and user_id=${U}`;
  await expect(savePolicy()).rejects.toMatchObject({ code: "42501" });
  expect((await getDigest()).status).toBe(403);
  expect((await saveDigest()).status).toBe(403);
});

it("keeps visual grouping separate from explicit personal digest consent and preserves legacy policy saves", async () => {
  await withRole(
    "authenticated",
    U,
    (tx) => tx`select notification_center_preferences_save(${W},'{"summary":"weekly"}',0)`,
  );
  expect(await getDigest()).toMatchObject({
    status: 200,
    payload: { settings: { enabled: false } },
  });
  await savePolicy();
  const {
    digest_enabled: _digest,
    followups_enabled: _followups,
    followup_daily_limit: _limit,
    ...legacy
  } = policy;
  expect((await savePolicy(legacy, 1)).policy).toMatchObject({
    digest_enabled: true,
    followups_enabled: true,
    followup_daily_limit: 10,
  });
  expect((await db`select count(*)::integer n from notification_digest_candidates`)[0].n).toBe(0);
});

it("stores digest only for the authenticated current member and rejects stale personal revisions", async () => {
  expect(await saveDigest()).toMatchObject({ status: 200, payload: { revision: 1 } });
  expect(await getDigest(C)).toMatchObject({
    status: 200,
    payload: { settings: { enabled: false }, revision: 0 },
  });
  expect((await saveDigest({ ...digest, at: "09:30" }, 0)).status).toBe(409);
  expect(await getDigest()).toMatchObject({
    status: 200,
    payload: { settings: { at: "08:30" }, revision: 1 },
  });
  expect((await request("/notification_digest_settings?select=*")).status).toBe(403);
});

it("rejects malformed digest configuration and non-service scheduling through the real JWT gateway", async () => {
  for (const bad of [
    { ...digest, timezone: "Not/A_Time_Zone" },
    { ...digest, at: "24:70" },
    { ...digest, channels: [] },
    { ...digest, weekday: 0 },
    { ...digest, channels: ["email", "email"] },
    { ...digest, user_id: C },
  ])
    expect((await saveDigest(bad)).status).toBeGreaterThanOrEqual(400);
  expect((await request("/rpc/notification_schedule_tick", { p_limit: 100 })).status).toBe(403);
  expect((await scheduleTick(0)).status).toBeGreaterThanOrEqual(400);
  expect((await db`select count(*)::integer n from notification_digest_settings`)[0].n).toBe(0);
});

/** Canonical proved Finance occurrence, real source RLS and actual dispatch. */
async function financeNotice(
  delivery: Record<string, unknown>,
  recipient = U,
  workflow = WF,
  source = X,
) {
  const trigger = JSON.parse(
    JSON.stringify(workflowNotificationEventTrigger("finance.payable.overdue")),
  );
  const storedDelivery = JSON.parse(JSON.stringify(delivery));
  const recipients = [{ kind: "user", id: recipient }];
  await db`update profiles set notification_preferences='{"workflow":{"email":true},"task":{"email":true}}' where id in (${U},${C})`;
  await db`update workflows set entity='financial_entries',execution_user_id=${U},trigger=${db.json(trigger)},
    actions=${db.json([{ type: "send_notification", title: "Atualização financeira disponível", recipients, delivery: storedDelivery }])},last_published_at=clock_timestamp()-interval '10 days' where id=${workflow}`;
  await db`update financial_entries set direction='payable',status='open',amount=1000,paid_amount=0,currency='BRL',
    due_date=(now() at time zone 'America/Sao_Paulo')::date-1 where id=${source}`;
  const tick = await request(
    "/rpc/notification_business_due_tick",
    { p_limit: 100 },
    U,
    fixtureJwt("service_role"),
  );
  expect(tick.status).toBe(200);
  expect(tick.payload.enqueued).toBeGreaterThanOrEqual(1);
  const [event] =
    await db`select e.id from workflow_events e join notification_business_event_proofs p on p.event_id=e.id where e.notification_event_key='finance.payable.overdue' and e.entity_id=${source} and p.workflow_id=${workflow}`;
  const runId = randomUUID();
  await db`insert into workflow_runs(id,workspace_id,owner_id,workflow_id,event_id,entity,entity_id) values(${runId},${W},${A},${workflow},${event.id},'financial_entries',${source})`;
  const result = await withRole(
    "service_role",
    null,
    async (tx) =>
      (
        await tx`select notification_workflow_dispatch_v2(${workflow},${runId},1,'financial_entries',${source},${tx.json(recipients)},'Atualização financeira disponível',null,'1',${tx.json(storedDelivery)}) result`
      )[0].result,
  );
  const [intent] = await db`select * from notification_delivery_intents where run_id=${runId}`;
  return { runId, eventId: event.id as string, intent, result };
}

const lowDelivery = { channels: ["inapp", "email"], fallback: "none", priority: "low" };
const reminderDelivery = {
  channels: ["inapp"],
  fallback: "none",
  followup: { reminder: { interval_hours: 1, max_occurrences: 3 } },
};
const tickAt = (at: Date | string, limit = 100) =>
  db.begin(async (tx) => {
    // Private owner seam with the same service identity as the public cron.
    await tx`select set_config('request.jwt.claims','{"role":"service_role"}',true)`;
    return (
      await tx`select techerp_api.notification_schedule_tick_at(${limit},${at}::timestamptz) result`
    )[0].result;
  });
const candidateTime = async () =>
  (
    await db`select min(next_at)+interval '1 second' scheduled_at from notification_digest_candidates where state='waiting'`
  )[0].scheduled_at as Date;
const followupTime = async (hours = 1) =>
  (
    await db`select min(base_at)+make_interval(hours=>${hours})+interval '1 second' scheduled_at from notification_followup_schedules`
  )[0].scheduled_at as Date;
const digestJob = async () =>
  (
    await db`select * from workflow_deliveries where notification_digest_id is not null order by created_at,id`
  )[0];
const readyClaim = async (id: string) => {
  // Owner-only clock seam: make an already closed synthetic envelope eligible now.
  await db`update workflow_deliveries set next_attempt_at=clock_timestamp()-interval '1 second' where id=${id}`;
  return claim(id);
};
async function secondFinanceNotice(delivery: Record<string, unknown> = lowDelivery) {
  const workflow = randomUUID(),
    source = randomUUID();
  await db`insert into workflows select (jsonb_populate_record(null::workflows,to_jsonb(w)||jsonb_build_object('id',${workflow}::text))).* from workflows w where id=${WF}`;
  await db`insert into financial_entries select (jsonb_populate_record(null::financial_entries,to_jsonb(f)||jsonb_build_object('id',${source}::text))).* from financial_entries f where id=${X}`;
  return { ...(await financeNotice(delivery, U, workflow, source)), workflow, source };
}

it("keeps scheduling off without both workspace policy and explicit personal opt-in", async () => {
  await financeNotice(lowDelivery);
  expect((await db`select count(*)::int n from notification_digest_candidates`)[0].n).toBe(0);
  expect((await db`select count(*)::int n from notifications`)[0].n).toBe(1);
  expect(await scheduleTick()).toMatchObject({
    status: 200,
    payload: { digests_queued: 0, followups_queued: 0 },
  });
});

it("keeps ordinary priority immediate even when the recipient has opted into daily digests", async () => {
  await savePolicy();
  await saveDigest();
  const { intent } = await financeNotice({ channels: ["inapp", "email"], fallback: "none" });
  expect((await db`select count(*)::int n from notification_digest_candidates`)[0].n).toBe(0);
  const [job] =
    await db`select * from workflow_deliveries where notification_intent_id=${intent.id}`;
  expect(new Date(job.next_attempt_at).getTime()).toBeLessThanOrEqual(Date.now());
});

it("groups current low-priority occurrences across real workflows into one neutral batch with no invented run", async () => {
  await savePolicy();
  await saveDigest();
  await financeNotice(lowDelivery);
  await secondFinanceNotice();
  expect((await db`select count(*)::int n from notifications`)[0].n).toBe(2);
  expect(
    (await db`select count(distinct workflow_id)::int n from notification_digest_candidates`)[0].n,
  ).toBe(2);
  const at = await candidateTime();
  expect(await tickAt(at)).toMatchObject({ digests_queued: 1 });
  expect(await tickAt(at)).toMatchObject({ digests_queued: 0 });
  const job = await digestJob();
  expect(job).toMatchObject({
    workflow_id: null,
    notification_intent_id: null,
    channel: "email",
    status: "queued",
  });
  expect(
    (
      await db`select count(*)::int n from notification_digest_candidates where batch_id=${job.notification_digest_id}`
    )[0].n,
  ).toBe(2);
  const claimed = await readyClaim(job.id);
  expect(claimed).toMatchObject({
    status: 200,
    payload: { result: "claimed", kind: "digest", batchId: job.notification_digest_id },
  });
  expect(claimed.payload).not.toHaveProperty("workflowId");
  expect(claimed.payload).not.toHaveProperty("runId");
  expect(JSON.stringify(claimed.payload)).not.toMatch(
    /"amount"\s*:|Atualização financeira|memberCount|sourceIds/,
  );
  expect(await preflight(job.id, claimed.payload.token)).toMatchObject({
    status: 200,
    payload: { allowed: true, kind: "digest" },
  });
});

it("prunes revoked sources at digest closure and never sends an empty composition", async () => {
  await savePolicy();
  await saveDigest();
  await financeNotice(lowDelivery);
  await db`update financial_entries set status='paid',paid_amount=amount where id=${X}`;
  expect(await tickAt(await candidateTime())).toMatchObject({ digests_queued: 0, suppressed: 1 });
  expect(
    await db`select id from workflow_deliveries where notification_digest_id is not null`,
  ).toHaveLength(0);
  expect((await db`select state from notification_digest_candidates`)[0].state).toBe("cancelled");
});

it("revalidates every digest member again at claim and preflight", async () => {
  await savePolicy();
  await saveDigest();
  await financeNotice(lowDelivery);
  const second = await secondFinanceNotice();
  await tickAt(await candidateTime());
  const job = await digestJob();
  await db`update financial_entries set status='paid',paid_amount=amount where id=${X}`;
  const claimed = await readyClaim(job.id);
  expect(claimed).toMatchObject({ status: 200, payload: { result: "claimed" } });
  expect(
    (
      await db`select count(*)::int n from notification_digest_candidates where state='cancelled'`
    )[0].n,
  ).toBe(1);
  await db`update financial_entries set status='paid',paid_amount=amount where id=${second.source}`;
  expect(await preflight(job.id, claimed.payload.token)).toMatchObject({
    status: 200,
    payload: { allowed: false },
  });
  expect((await db`select status from workflow_deliveries where id=${job.id}`)[0].status).toBe(
    "suppressed",
  );
});

it("cancels waiting digest work after personal revision changes without replaying it", async () => {
  await savePolicy();
  await saveDigest();
  await financeNotice(lowDelivery);
  const at = await candidateTime();
  expect(await saveDigest({ ...digest, frequency: "weekly", timezone: "UTC" }, 1)).toMatchObject({
    status: 200,
  });
  expect(await tickAt(at)).toMatchObject({ digests_queued: 0 });
  expect(
    (await db`select count(*)::int n from notification_digest_candidates where state='waiting'`)[0]
      .n,
  ).toBe(0);
  expect(
    await db`select id from workflow_deliveries where notification_digest_id is not null`,
  ).toHaveLength(0);
});

it("creates only bounded original-step reminder occurrences without repeating other Workflow actions", async () => {
  await savePolicy();
  const { intent, runId } = await financeNotice(reminderDelivery);
  expect((await db`select count(*)::int n from notification_followup_schedules`)[0].n).toBe(1);
  const [runBefore] = await db`select * from workflow_runs where id=${runId}`;
  const [{ n: runCount }] = await db`select count(*)::int n from workflow_runs`;
  for (let hour = 1; hour <= 3; hour++)
    expect(await tickAt(await followupTime(hour))).toMatchObject({ followups_queued: 1 });
  expect(await tickAt(await followupTime(4))).toMatchObject({ followups_queued: 0 });
  expect((await db`select count(*)::int n from notification_followup_occurrences`)[0].n).toBe(3);
  const children =
    await db`select parent_intent_id,event_key,run_id,workflow_version,occurrence_kind from notification_delivery_intents where parent_intent_id=${intent.id}`;
  expect(children).toHaveLength(3);
  for (const child of children)
    expect(child).toMatchObject({
      parent_intent_id: intent.id,
      run_id: runId,
      workflow_version: 1,
      event_key: "finance.payable.overdue",
      occurrence_kind: "reminder",
    });
  expect((await db`select * from workflow_runs where id=${runId}`)[0]).toEqual(runBefore);
  expect((await db`select count(*)::int n from workflow_runs`)[0].n).toBe(runCount);
  expect((await db`select count(*)::int n from financial_entries`)[0].n).toBe(1);
  expect(
    (await db`select status,paid_amount from financial_entries where id=${X}`)[0],
  ).toMatchObject({ status: "open", paid_amount: "0.00" });
});

it("coalesces missed reminder intervals once instead of producing a backlog burst", async () => {
  await savePolicy();
  await financeNotice(reminderDelivery);
  expect(await tickAt(await followupTime(3))).toMatchObject({ followups_queued: 1 });
  expect((await db`select ordinal from notification_followup_occurrences`)[0].ordinal).toBe(3);
  expect(await tickAt(await followupTime(4))).toMatchObject({ followups_queued: 0 });
});

it("stops reminders after reading the original notice without approving or paying the source", async () => {
  await savePolicy();
  const { intent } = await financeNotice(reminderDelivery);
  await db`update notifications set read_at=clock_timestamp() where id=${intent.notification_id}`;
  expect(await tickAt(await followupTime())).toMatchObject({ followups_queued: 0, suppressed: 1 });
  expect((await db`select status from financial_entries where id=${X}`)[0].status).toBe("open");
  expect((await db`select count(*)::int n from notification_followup_occurrences`)[0].n).toBe(0);
});

it("never escalates to a CEO or another person when no explicit escalation was configured", async () => {
  await savePolicy();
  await financeNotice(reminderDelivery);
  await tickAt(await followupTime());
  const targets =
    await db`select recipient_user_id from notification_delivery_intents where occurrence_kind<>'initial'`;
  expect(targets).toEqual([{ recipient_user_id: U }]);
});

it("resolves one explicit escalation recipient and does not grant access or reassign the source", async () => {
  await savePolicy();
  await financeNotice({
    channels: ["inapp"],
    fallback: "none",
    followup: { escalation: { after_hours: 1, recipient: { kind: "user", id: C } } },
  });
  const grantsBefore =
    await db`select * from job_role_permission_overrides order by permission_key`;
  const [sourceBefore] = await db`select * from financial_entries where id=${X}`;
  expect(await tickAt(await followupTime())).toMatchObject({ followups_queued: 1 });
  expect(
    await db`select recipient_user_id,occurrence_kind from notification_delivery_intents where occurrence_kind<>'initial'`,
  ).toEqual([{ recipient_user_id: C, occurrence_kind: "escalation" }]);
  expect((await db`select * from financial_entries where id=${X}`)[0]).toEqual(sourceBefore);
  expect(await db`select * from job_role_permission_overrides order by permission_key`).toEqual(
    grantsBefore,
  );
});

it("suppresses follow-ups after workflow version revocation and explicit source permission denial", async () => {
  await savePolicy();
  await financeNotice(reminderDelivery);
  await db`update job_role_permission_overrides set effect='deny' where workspace_id=${W} and role_id=${ROLE} and permission_key='techfinance.entries.view.workspace'`;
  await db`update workflows set published_version=2 where id=${WF}`;
  expect(await tickAt(await followupTime())).toMatchObject({ followups_queued: 0, suppressed: 1 });
  expect(
    (
      await db`select count(*)::int n from notification_delivery_intents where occurrence_kind<>'initial'`
    )[0].n,
  ).toBe(0);
});

it("does not register a reminder when the original in-app notice is suppressed", async () => {
  await savePolicy();
  await withRole(
    "authenticated",
    U,
    (tx) =>
      tx`select notification_center_preferences_save(${W},'{"eventOverrides":{"finance.payable.overdue":{"inapp":false}}}',0)`,
  );
  const { intent } = await financeNotice(reminderDelivery);
  expect(intent.notification_id).toBeNull();
  expect((await db`select count(*)::int n from notification_followup_schedules`)[0].n).toBe(0);
});

it("serializes concurrent closing ticks into one batch and one external envelope", async () => {
  await savePolicy();
  await saveDigest();
  await financeNotice(lowDelivery);
  const at = await candidateTime();
  const ticks = await Promise.all([tickAt(at), tickAt(at)]);
  expect(ticks.reduce((sum, value) => sum + value.digests_queued, 0)).toBe(1);
  expect((await db`select count(*)::int n from notification_digest_batches`)[0].n).toBe(1);
  expect(
    (
      await db`select count(*)::int n from workflow_deliveries where notification_digest_id is not null`
    )[0].n,
  ).toBe(1);
});

it("limits a bulk-prepared current envelope to 100 members and moves overflow to a future civil slot", async () => {
  await savePolicy();
  await saveDigest();
  const { runId, intent } = await financeNotice(lowDelivery);
  const [wf] = await db`select actions from workflows where id=${WF}`;
  const action = wf.actions[0];
  // Six actual published Workflow/run pairs, never more than the editor's 20 steps.
  for (let group = 0; group < 6; group++) {
    const workflow = group === 0 ? WF : randomUUID(),
      run = group === 0 ? runId : randomUUID();
    const steps = group === 5 ? 1 : 20;
    if (group > 0) {
      await db`insert into workflows select (jsonb_populate_record(null::workflows,to_jsonb(w)||jsonb_build_object('id',${workflow}::text))).* from workflows w where id=${WF}`;
      await request(
        "/rpc/notification_business_due_tick",
        { p_limit: 100 },
        U,
        fixtureJwt("service_role"),
      );
      const [proof] =
        await db`select event_id from notification_business_event_proofs where workflow_id=${workflow} and source_id=${X}`;
      await db`insert into workflow_runs(id,workspace_id,owner_id,workflow_id,event_id,entity,entity_id) values(${run},${W},${A},${workflow},${proof.event_id},'financial_entries',${X})`;
    }
    await db`update workflows set actions=${db.json(Array.from({ length: steps }, () => action))} where id=${workflow}`;
    // This case measures bounded closing, not 101 repeated captures. Other cases
    // exercise dispatch/capture end to end. Bulk fixture rows copy one actual
    // normalized dispatch; each target still has its real published step/run/proof.
    const members = Array.from({ length: steps }, (_, index) => ({
      intent: randomUUID(),
      delivery: randomUUID(),
      candidate: randomUUID(),
      path: String(index + 1),
    })).filter((member) => group > 0 || member.path !== "1");
    await db.begin(async (tx) => {
      await tx`insert into notification_delivery_intents
        select (jsonb_populate_record(null::notification_delivery_intents,to_jsonb(i)||jsonb_build_object(
          'id',m->>'intent','workflow_id',${workflow}::text,'run_id',${run}::text,'step_path',m->>'path'))).*
        from notification_delivery_intents i cross join jsonb_array_elements(${tx.json(members)}) m where i.id=${intent.id}`;
      await tx`insert into workflow_deliveries
        select (jsonb_populate_record(null::workflow_deliveries,to_jsonb(d)||jsonb_build_object(
          'id',m->>'delivery','workflow_id',${workflow}::text,'notification_intent_id',m->>'intent',
          'step_path',m->>'path','idempotency_key','nfd:'||(m->>'intent')||':email'))).*
        from workflow_deliveries d cross join jsonb_array_elements(${tx.json(members)}) m
        where d.notification_intent_id=${intent.id} and d.channel='email'`;
      await tx`insert into notification_digest_candidates
        select (jsonb_populate_record(null::notification_digest_candidates,to_jsonb(c)||jsonb_build_object(
          'id',m->>'candidate','source_intent_id',m->>'intent','workflow_id',${workflow}::text,
          'run_id',${run}::text,'step_path',m->>'path'))).*
        from notification_digest_candidates c cross join jsonb_array_elements(${tx.json(members)}) m
        where c.source_intent_id=${intent.id}`;
    });
  }
  expect((await db`select count(*)::int n from notification_digest_candidates`)[0].n).toBe(101);
  expect(
    (await db`select count(distinct workflow_id)::int n from notification_digest_candidates`)[0].n,
  ).toBe(6);
  const at = await candidateTime();
  expect(await tickAt(at)).toMatchObject({ digests_queued: 1 });
  expect(await tickAt(at)).toMatchObject({ digests_queued: 0 });
  expect(
    (await db`select count(*)::int n from notification_digest_candidates where state='batched'`)[0]
      .n,
  ).toBe(100);
  const waiting =
    await db`select next_at from notification_digest_candidates where state='waiting'`;
  expect(waiting).toHaveLength(1);
  expect(new Date(waiting[0].next_at).getTime()).toBeGreaterThan(new Date(at).getTime());
  expect(
    (
      await db`select count(*)::int n from workflow_deliveries where notification_digest_id is not null`
    )[0].n,
  ).toBe(1);
}, 20_000);

it("applies the explicit workspace follow-up cap without consuming another occurrence", async () => {
  await savePolicy({ ...policy, followup_daily_limit: 1 });
  await financeNotice(reminderDelivery);
  expect(await tickAt(await followupTime())).toMatchObject({ followups_queued: 1 });
  expect(await tickAt(await followupTime(2))).toMatchObject({ followups_queued: 0 });
  expect((await db`select count(*)::int n from notification_followup_occurrences`)[0].n).toBe(1);
  expect(
    (await db`select next_reminder from notification_followup_schedules`)[0].next_reminder,
  ).toBe(2);
});

it("preserves durable member receipts after queue purge and refuses to regroup the same run-step", async () => {
  await savePolicy();
  await saveDigest();
  const { intent, runId } = await financeNotice(lowDelivery);
  await tickAt(await candidateTime());
  await db`delete from workflow_deliveries`;
  await db`delete from notification_delivery_intents where id=${intent.id}`;
  await withRole(
    "service_role",
    null,
    (tx) =>
      tx`select notification_workflow_dispatch_v2(${WF},${runId},1,'financial_entries',${X},${tx.json([{ kind: "user", id: U }])},'Atualização financeira disponível',null,'1',${tx.json(lowDelivery)})`,
  );
  expect((await db`select count(*)::int n from notification_digest_candidates`)[0].n).toBe(1);
  expect(
    (await db`select count(*)::int n from notification_digest_candidates where state='waiting'`)[0]
      .n,
  ).toBe(0);
  expect(
    (await db`select status,reason_code from workflow_deliveries where channel='email'`)[0],
  ).toMatchObject({ status: "deduped", reason_code: "digest_duplicate" });
});

it("keeps uncertainty terminal for regrouping and automatic follow-up transmission", async () => {
  await savePolicy();
  await saveDigest();
  await financeNotice({ ...lowDelivery, followup: reminderDelivery.followup });
  await tickAt(await candidateTime());
  const job = await digestJob();
  const claimed = await readyClaim(job.id);
  expect(claimed).toMatchObject({ status: 200, payload: { result: "claimed" } });
  expect(await preflight(job.id, claimed.payload.token)).toMatchObject({
    status: 200,
    payload: { allowed: true },
  });
  expect(
    await request(
      "/rpc/notification_delivery_finish",
      {
        p_id: job.id,
        p_token: claimed.payload.token,
        p_status: "uncertain",
        p_provider: "managed_email",
        p_provider_id: null,
        p_reason: "transport_unknown",
        p_retry_after_seconds: null,
      },
      U,
      fixtureJwt("service_role"),
    ),
  ).toMatchObject({ status: 200, payload: { updated: true } });
  expect(await tickAt(await followupTime(3))).toMatchObject({
    followups_queued: 0,
    digests_queued: 0,
  });
  expect((await db`select status from workflow_deliveries where id=${job.id}`)[0].status).toBe(
    "uncertain",
  );
  expect(
    (
      await db`select count(*)::int n from notification_delivery_intents where occurrence_kind<>'initial'`
    )[0].n,
  ).toBe(0);
});

async function whatsappDigest(fallback = "none") {
  await savePolicy({
    ...policy,
    whatsapp_enabled: true,
    wa_sender_id: "123456789",
    wa_template_name: "techerp_update",
    wa_template_language: "pt_BR",
    wa_estimated_unit_micros: 1000,
    wa_daily_budget_micros: 10000,
  });
  await withRole(
    "authenticated",
    U,
    (tx) => tx`select save_notification_delivery_consent(${W},true,'+5548999990001',0)`,
  );
  await saveDigest({ ...digest, channels: ["whatsapp"] });
  await financeNotice({ channels: ["inapp", "whatsapp"], fallback, priority: "low" });
  await tickAt(await candidateTime());
  const job = await digestJob();
  const claimed = await readyClaim(job.id);
  expect(claimed).toMatchObject({
    status: 200,
    payload: { result: "claimed", kind: "digest", connectionId: X },
  });
  return { job, claimed: claimed.payload };
}
const finishJob = (
  id: string,
  token: string,
  status: string,
  provider = "managed_email",
  providerId: string | null = null,
  reason: string | null = null,
) =>
  request(
    "/rpc/notification_delivery_finish",
    {
      p_id: id,
      p_token: token,
      p_status: status,
      p_provider: provider,
      p_provider_id: providerId,
      p_reason: reason,
      p_retry_after_seconds: null,
    },
    U,
    fixtureJwt("service_role"),
  );
const waReceipt = (workspace = W, status = "delivered") =>
  request(
    "/rpc/notification_whatsapp_receipt",
    {
      p_workspace: workspace,
      p_connection: X,
      p_sender: "123456789",
      p_wamid: "wamid.synthetic-p12",
      p_recipient: "+5548999990001",
      p_status: status,
      p_error_code: null,
    },
    U,
    fixtureJwt("service_role"),
  );

it("ends an uncertain schedule and lets a later eligible reminder progress with a one-row tick budget", async () => {
  await savePolicy();
  const first = await financeNotice({ ...reminderDelivery, channels: ["inapp", "email"] });
  const [job] =
    await db`select id from workflow_deliveries where notification_intent_id=${first.intent.id}`;
  const claimed = await readyClaim(job.id);
  expect(claimed).toMatchObject({ status: 200, payload: { result: "claimed" } });
  expect(await preflight(job.id, claimed.payload.token)).toMatchObject({
    status: 200,
    payload: { allowed: true },
  });
  expect(
    await finishJob(
      job.id,
      claimed.payload.token,
      "uncertain",
      "managed_email",
      null,
      "transport_unknown",
    ),
  ).toMatchObject({ status: 200, payload: { updated: true } });
  const second = await secondFinanceNotice(reminderDelivery);
  const [time] =
    await db`select max(base_at)+interval '1 hour 1 second' scheduled_at from notification_followup_schedules`;
  expect(await tickAt(time.scheduled_at, 1)).toMatchObject({ followups_queued: 0, suppressed: 1 });
  expect(
    (
      await db`select stopped_at from notification_followup_schedules where parent_intent_id=${first.intent.id}`
    )[0].stopped_at,
  ).not.toBeNull();
  expect(await tickAt(time.scheduled_at, 1)).toMatchObject({ followups_queued: 1 });
  expect(
    (
      await db`select count(*)::int n from notification_delivery_intents where parent_intent_id=${second.intent.id}`
    )[0].n,
  ).toBe(1);
});

it("lets never-checked work advance ahead of pending old work even with the canonical fifteen-minute cron", async () => {
  await savePolicy();
  const pending = await financeNotice({ ...reminderDelivery, channels: ["inapp", "email"] });
  const next = await secondFinanceNotice(reminderDelivery);
  const [time] =
    await db`select max(base_at)+interval '1 hour 1 second' scheduled_at from notification_followup_schedules`;
  expect(await tickAt(time.scheduled_at, 1)).toMatchObject({ followups_queued: 0 });
  const later = new Date(new Date(time.scheduled_at).getTime() + 15 * 60 * 1000);
  expect(await tickAt(later, 1)).toMatchObject({ followups_queued: 1 });
  expect(
    (
      await db`select count(*)::int n from notification_delivery_intents where parent_intent_id=${next.intent.id}`
    )[0].n,
  ).toBe(1);
  expect(
    (
      await db`select next_reminder,stopped_at from notification_followup_schedules where parent_intent_id=${pending.intent.id}`
    )[0],
  ).toMatchObject({ next_reminder: 1, stopped_at: null });
  expect(
    (
      await db`select status from workflow_deliveries where notification_intent_id=${pending.intent.id}`
    )[0].status,
  ).toBe("queued");
});

it("pins the digest WhatsApp connection and applies actual provider receipts monotonically to its envelope only", async () => {
  const { job, claimed } = await whatsappDigest();
  expect(await preflight(job.id, claimed.token)).toMatchObject({
    status: 200,
    payload: { allowed: true, kind: "digest", connectionId: X },
  });
  expect(
    await finishJob(job.id, claimed.token, "accepted", "meta_cloud", "wamid.synthetic-p12"),
  ).toMatchObject({ status: 200, payload: { updated: true } });
  expect(await waReceipt(B)).toMatchObject({
    status: 200,
    payload: { matched: false, updated: false },
  });
  expect(await waReceipt()).toMatchObject({
    status: 200,
    payload: { matched: true, updated: true },
  });
  expect(await waReceipt(W, "read")).toMatchObject({
    status: 200,
    payload: { matched: true, updated: true },
  });
  expect(await waReceipt()).toMatchObject({
    status: 200,
    payload: { matched: true, updated: false },
  });
  expect((await db`select status from workflow_deliveries where id=${job.id}`)[0].status).toBe(
    "read",
  );
  expect((await db`select read_at from notifications`)[0].read_at).toBeNull();
  expect(
    (await db`select count(*)::int n from workflow_deliveries where channel='email'`)[0].n,
  ).toBe(0);
});

it("never turns a failed WhatsApp digest into an unselected email fallback", async () => {
  const { job, claimed } = await whatsappDigest("email");
  expect(await preflight(job.id, claimed.token)).toMatchObject({
    status: 200,
    payload: { allowed: true },
  });
  expect(
    await finishJob(job.id, claimed.token, "failed", "meta_cloud", null, "provider_rejected"),
  ).toMatchObject({ status: 200, payload: { updated: true } });
  expect((await db`select status from workflow_deliveries where id=${job.id}`)[0].status).toBe(
    "failed",
  );
  expect(
    (await db`select count(*)::int n from workflow_deliveries where channel='email'`)[0].n,
  ).toBe(0);
});

it("shares the workspace email quota between digest envelopes and ordinary immediate jobs", async () => {
  await savePolicy({ ...policy, email_daily_limit: 1 });
  await saveDigest();
  await financeNotice(lowDelivery);
  await tickAt(await candidateTime());
  const first = await digestJob();
  expect(await readyClaim(first.id)).toMatchObject({ status: 200, payload: { result: "claimed" } });
  const next = await secondFinanceNotice({ channels: ["inapp", "email"], fallback: "none" });
  const [job] =
    await db`select id from workflow_deliveries where notification_intent_id=${next.intent.id}`;
  expect(await readyClaim(job.id)).toMatchObject({
    status: 200,
    payload: { result: "deferred", reason: "quota_exceeded" },
  });
});

it("exposes neutral batch metadata in protected history and hides the entire batch after source access is lost", async () => {
  await savePolicy();
  await saveDigest();
  await financeNotice(lowDelivery);
  await tickAt(await candidateTime());
  const job = await digestJob();
  const history = () =>
    request("/rpc/notification_delivery_history", {
      p_workspace: W,
      p_scope: "own",
      p_channel: "email",
    });
  const first = await history();
  expect(first.status).toBe(200);
  const item = first.payload.items.find((row: { id: string }) => row.id === job.id);
  expect(item).toMatchObject({
    occurrence_kind: "digest",
    batch_id: job.notification_digest_id,
    workflow_id: null,
  });
  expect(JSON.stringify(item)).not.toMatch(
    /fixture.invalid|5548999990001|"amount"\s*:|runId|source_id/,
  );
  expect((await request(`/workflow_deliveries?select=id&id=eq.${job.id}`)).payload).toEqual([
    { id: job.id },
  ]);
  await db`update job_role_permission_overrides set effect='deny' where workspace_id=${W} and role_id=${ROLE} and permission_key='techfinance.entries.view.workspace'`;
  expect((await history()).payload.items.some((row: { id: string }) => row.id === job.id)).toBe(
    false,
  );
  expect((await request(`/workflow_deliveries?select=id&id=eq.${job.id}`)).payload).toEqual([]);
  expect(
    (await request("/rpc/notification_delivery_history", { p_workspace: W, p_scope: "own" }, F))
      .status,
  ).toBe(403);
});

it("uses civil daily slots across the real IANA spring-forward gap instead of adding 24 hours", async () => {
  const settings = { ...digest, timezone: "America/New_York", at: "02:30" };
  const [gap] =
    await db`select * from techerp_api.notification_digest_slot(${db.json(settings)},'2026-03-08T06:00:00Z'::timestamptz,true)`;
  expect(new Date(gap.slot_at).toISOString()).toBe("2026-03-08T07:30:00.000Z");
  const [same] =
    await db`select * from techerp_api.notification_digest_slot(${db.json(settings)},'2026-03-08T07:31:00Z'::timestamptz,false)`;
  expect(same.slot_key).toBe(gap.slot_key);
  const [next] =
    await db`select * from techerp_api.notification_digest_slot(${db.json(settings)},'2026-03-08T07:31:00Z'::timestamptz,true)`;
  expect(new Date(next.slot_at).toISOString()).toBe("2026-03-09T06:30:00.000Z");
  expect(new Date(next.slot_at).getTime() - new Date(gap.slot_at).getTime()).toBe(
    23 * 60 * 60 * 1000,
  );
});

it("uses one durable civil key for the repeated IANA fall-back hour", async () => {
  const settings = { ...digest, timezone: "America/New_York", at: "01:30" };
  const [first] =
    await db`select * from techerp_api.notification_digest_slot(${db.json(settings)},'2026-11-01T05:00:00Z'::timestamptz,true)`;
  const [second] =
    await db`select * from techerp_api.notification_digest_slot(${db.json(settings)},'2026-11-01T06:00:00Z'::timestamptz,true)`;
  expect(first.slot_key).toBe(second.slot_key);
  expect(new Date(first.slot_at).toISOString()).toBe("2026-11-01T06:30:00.000Z");
  expect(new Date(second.slot_at).toISOString()).toBe(new Date(first.slot_at).toISOString());
});

it("follows the chosen weekly weekday in the user's civil timezone", async () => {
  const settings = { ...digest, frequency: "weekly", weekday: 1 };
  const [monday] =
    await db`select * from techerp_api.notification_digest_slot(${db.json(settings)},'2026-11-20T15:00:00Z'::timestamptz,true)`;
  expect(new Date(monday.slot_at).toISOString()).toBe("2026-11-23T11:30:00.000Z");
  const [nextMonday] =
    await db`select * from techerp_api.notification_digest_slot(${db.json(settings)},'2026-11-23T11:31:00Z'::timestamptz,true)`;
  expect(new Date(nextMonday.slot_at).toISOString()).toBe("2026-11-30T11:30:00.000Z");
});

it("keeps private timing and candidate tables inaccessible through both direct SQL and the HTTP API", async () => {
  for (const table of [
    "notification_digest_candidates",
    "notification_digest_batches",
    "notification_followup_schedules",
    "notification_followup_occurrences",
  ])
    expect((await request(`/${table}?select=*`)).status).toBe(403);
  await expect(
    withRole(
      "authenticated",
      U,
      (tx) => tx`select * from techerp_api.notification_digest_slot(${tx.json(digest)},now(),true)`,
    ),
  ).rejects.toMatchObject({ code: "42501" });
  expect(
    (
      await request(
        "/rpc/notification_schedule_tick",
        { p_limit: 100, p_now: "2035-01-01T00:00:00Z" },
        U,
        fixtureJwt("service_role"),
      )
    ).status,
  ).toBe(404);
});
