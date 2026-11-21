import { randomUUID } from "node:crypto";
import { beforeEach, expect, it } from "vitest";
import {
  db,
  W,
  A,
  U,
  C,
  D,
  ROLE,
  WF,
  reset,
  withRole,
  request,
  fixtureJwt,
} from "../../tests/fixtures/notification-deliveries";
import { prepareCanonicalFiscalDocument } from "../../tests/fixtures/notification-fiscal-scenario";
import { workflowNotificationEventTrigger } from "./workflows/notification-events";

beforeEach(reset);

const title = "Atualização disponível";
const pending = [{ kind: "pending_approvers" }];
// The stored intent sorts channels; the published step deliberately retains UI order.
const delivery = {
  channels: ["inapp", "email"],
  fallback: "none",
  priority: "low",
  followup: { reminder: { interval_hours: 1, max_occurrences: 2 } },
};
const service = () => fixtureJwt("service_role");
const check = (event: string) =>
  request(
    "/rpc/notification_business_event_check",
    { p_event: event, p_workflow: WF, p_version: 1 },
    U,
    service(),
  );
const claim = (id: string) =>
  request("/rpc/notification_delivery_claim", { p_id: id }, U, service());
const preflight = (id: string, token: string) =>
  request("/rpc/notification_delivery_preflight", { p_id: id, p_token: token }, U, service());

async function enablePolicy() {
  await withRole(
    "authenticated",
    U,
    (tx) =>
      tx`select notification_delivery_settings_save(${W},${tx.json({
        email_enabled: true,
        whatsapp_enabled: false,
        email_daily_limit: 20,
        whatsapp_daily_limit: 0,
        wa_sender_id: null,
        wa_template_name: null,
        wa_template_language: null,
        wa_estimated_unit_micros: 0,
        wa_daily_budget_micros: 0,
        currency: "BRL",
        digest_enabled: true,
        followups_enabled: true,
        followup_daily_limit: 10,
      })},0)`,
  );
  await db`update profiles set notification_preferences='{"workflow":{"email":true},"task":{"email":true},"approval":{"email":true}}' where id in (${U},${C})`;
}
async function grant(...keys: string[]) {
  for (const key of keys)
    await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect)
      values(${W},${ROLE},${key},'grant') on conflict do nothing`;
}
async function dispatch(event: string, rules: { kind: string }[], config = delivery) {
  const [row] = await db`select entity,entity_id from workflow_events where id=${event}`;
  const run = randomUUID();
  await db`insert into workflow_runs(id,workspace_id,owner_id,workflow_id,event_id,entity,entity_id)
    values(${run},${W},${A},${WF},${event},${row.entity},${row.entity_id})`;
  await withRole(
    "service_role",
    null,
    (tx) =>
      tx`select notification_workflow_dispatch_v2(${WF},${run},1,${row.entity},${row.entity_id},${tx.json(rules)},${title},null,'1',${tx.json(config)})`,
  );
  const [intent] = await db`select * from notification_delivery_intents where run_id=${run}`;
  const [schedule] =
    await db`select * from notification_followup_schedules where parent_intent_id=${intent.id}`;
  expect(schedule).toMatchObject({
    workflow_id: WF,
    run_id: run,
    parent_intent_id: intent.id,
    notification_id: intent.notification_id,
  });
  return { run, intent, schedule };
}
async function finishInitialEmail(intent: string, recipient: string) {
  const [job] =
    await db`select id from workflow_deliveries where notification_intent_id=${intent} and channel='email'`;
  const claimed = await claim(job.id);
  expect(claimed).toMatchObject({
    status: 200,
    payload: { result: "claimed", recipientId: recipient, channel: "email" },
  });
  const payload = claimed.payload as { token: string };
  expect(await preflight(job.id, payload.token)).toMatchObject({
    status: 200,
    payload: { allowed: true, recipientId: recipient },
  });
  expect(
    await request(
      "/rpc/notification_delivery_finish",
      {
        p_id: job.id,
        p_token: payload.token,
        p_status: "accepted",
        p_provider: "managed_email",
        p_provider_id: "synthetic-local-acceptance",
        p_reason: null,
        p_retry_after_seconds: null,
      },
      U,
      service(),
    ),
  ).toMatchObject({ status: 200, payload: { updated: true } });
}
const tickAfter = (schedule: string, hours: number) =>
  db.begin(async (tx) => {
    // Keep the private owner's EXECUTE right while exercising the real null-uid service context.
    await tx`select set_config('request.jwt.claims','{"role":"service_role"}',true)`;
    return (
      await tx`select techerp_api.notification_schedule_tick_at(100,base_at+make_interval(hours=>${hours})+interval '1 second') result
        from notification_followup_schedules where id=${schedule}`
    )[0].result;
  });

async function pendingPreparation() {
  await grant(
    "techpeople.hiring_requests.view.workspace",
    "techpeople.hiring_requests.reference.view.workspace",
    "techpeople.hiring_requests.approval.approve.workspace",
    "techpeople.hiring_requests.approval_request.create.workspace",
  );
  const trigger = JSON.parse(
    JSON.stringify(workflowNotificationEventTrigger("people.approval.pending")),
  );
  await db`update workflows set entity='hiring_preparation_requests',execution_user_id=${U},trigger=${db.json(trigger)},
    actions=${db.json([{ type: "send_notification", title, recipients: pending, delivery }])},
    last_published_at=clock_timestamp()-interval '10 days' where id=${WF}`;
  const [group] = await db`select id from user_groups where workspace_id=${W} limit 1`;
  await db`insert into hiring_area_policies(workspace_id,area_id,manager_id,ceo_id,manager_delegate_id,ceo_delegate_id,updated_by)
    values(${W},${group.id},${U},${C},${D},${D},${A})`;
  const id = randomUUID();
  await db`insert into hiring_preparation_requests(id,workspace_id,kind,title,scope_text,purpose,area_id,status,revision,created_by,selection_mode)
    values(${id},${W},'professional','Synthetic preparation','Synthetic scope','internal',${group.id},'ready',1,${A},'needs_selection')`;
  await db`insert into hiring_preparation_reference_values(request_id,workspace_id,reference_value,revision)
    values(${id},${W},98765,1)`;
  const approval = await withRole(
    "authenticated",
    A,
    async (tx) =>
      (await tx`select hiring_preparation_approval_request(${W},'professional',${id},1) id`)[0]
        .id as string,
  );
  const [event] =
    await db`select id from workflow_events where notification_event_key='people.approval.pending'`;
  return { id, approval, event: event.id as string };
}

it("keeps approval communication immediate and reminds only the released approver through the same canonical notice", async () => {
  await enablePolicy();
  await withRole(
    "authenticated",
    U,
    (tx) =>
      tx`select save_notification_digest_settings(${W},${tx.json({
        enabled: true,
        frequency: "daily",
        at: "08:30",
        timezone: "America/Sao_Paulo",
        weekday: 1,
        channels: ["email"],
      })},0)`,
  );
  const p = await pendingPreparation();
  const [originalNotice] = await db`select id,user_id from notifications`;
  expect(originalNotice.user_id).toBe(U);
  const { intent, schedule, run } = await dispatch(p.event, pending);
  expect(intent.notification_id).toBe(originalNotice.id);
  expect((await db`select count(*)::int n from notifications`)[0].n).toBe(1);
  expect((await db`select count(*)::int n from hiring_preparation_approvals`)[0].n).toBe(1);
  expect((await db`select count(*)::int n from notification_digest_candidates`)[0].n).toBe(0);
  await finishInitialEmail(intent.id, U);
  expect(await tickAfter(schedule.id, 1)).toMatchObject({ followups_queued: 1, digests_queued: 0 });
  const [reminder] =
    await db`select * from notification_delivery_intents where parent_intent_id=${intent.id}`;
  expect(reminder).toMatchObject({
    occurrence_kind: "reminder",
    parent_intent_id: intent.id,
    workflow_id: WF,
    run_id: run,
    recipient_user_id: U,
    notification_id: originalNotice.id,
  });
  expect((await db`select count(*)::int n from notifications`)[0].n).toBe(1);
  expect((await db`select count(*)::int n from hiring_preparation_approvals`)[0].n).toBe(1);
  expect((await db`select count(*)::int n from workflow_runs where event_id=${p.event}`)[0].n).toBe(
    1,
  );
  expect(
    (
      await db`select count(*)::int n from workflow_events where notification_event_key='people.approval.pending'`
    )[0].n,
  ).toBe(1);
  const [job] = await db`update workflow_deliveries set next_attempt_at=clock_timestamp()
    where notification_intent_id=${reminder.id} returning id`;
  const claimed = await claim(job.id);
  expect(claimed).toMatchObject({
    status: 200,
    payload: {
      result: "claimed",
      kind: "reminder",
      parentIntentId: intent.id,
      recipientId: U,
      workflowId: WF,
      runId: run,
    },
  });
  await withRole(
    "authenticated",
    U,
    (tx) =>
      tx`select hiring_preparation_approval_decide(${W},'professional',${p.id},1,${p.approval},'manager','approved','Synthetic independent review',${randomUUID()})`,
  );
  expect(await check(p.event)).toEqual({ status: 200, payload: false });
  expect(await preflight(job.id, (claimed.payload as { token: string }).token)).toMatchObject({
    status: 200,
    payload: { allowed: false },
  });
  expect(await tickAfter(schedule.id, 2)).toMatchObject({ followups_queued: 0, suppressed: 1 });
  expect(
    (
      await db`select stopped_at is not null stopped from notification_followup_schedules where id=${schedule.id}`
    )[0].stopped,
  ).toBe(true);
  expect((await db`select count(*)::int n from hiring_preparation_approvals`)[0].n).toBe(1);
  expect(
    (await db`select user_id from notifications order by user_id`).map((n) => n.user_id).sort(),
  ).toEqual([U, C].sort());
  expect(
    (
      await db`select count(*)::int n from notification_followup_occurrences where schedule_id=${schedule.id}`
    )[0].n,
  ).toBe(1);
});

it.each(["verified", "rejected"] as const)(
  "stops fiscal follow-ups after canonical %s review without changing original receipt proof semantics",
  async (decision) => {
    await enablePolicy();
    const config = { ...delivery, priority: "normal" };
    const f = await prepareCanonicalFiscalDocument("professional", config);
    await f.attest();
    expect(await f.register()).toBe(f.id);
    const [event] =
      await db`select id,after from workflow_events where notification_event_key='finance.invoice.received'`;
    const [proof] =
      await db`select * from notification_business_event_proofs where event_id=${event.id}`;
    const [receipt] =
      await db`select * from notification_business_occurrence_receipts where event_key='finance.invoice.received'`;
    expect(await check(event.id)).toEqual({ status: 200, payload: true });
    const { intent, schedule } = await dispatch(event.id, [{ kind: "source_responsible" }], config);
    expect(intent.recipient_user_id).toBe(C);
    await finishInitialEmail(intent.id, C);
    expect(await tickAfter(schedule.id, 1)).toMatchObject({ followups_queued: 1 });
    const [child] =
      await db`select id from notification_delivery_intents where parent_intent_id=${intent.id}`;
    const [job] = await db`update workflow_deliveries set next_attempt_at=clock_timestamp()
      where notification_intent_id=${child.id} returning id`;
    const claimed = await claim(job.id);
    expect(claimed).toMatchObject({
      status: 200,
      payload: { result: "claimed", kind: "reminder", recipientId: C, parentIntentId: intent.id },
    });
    await withRole(
      "authenticated",
      C,
      (tx) =>
        tx`select hiring_fiscal_review(${W},${f.requestId},${f.id},${f.sha},${decision},'Synthetic independent fiscal review',${randomUUID()})`,
    );
    expect(await preflight(job.id, (claimed.payload as { token: string }).token)).toMatchObject({
      status: 200,
      payload: { allowed: false },
    });
    expect(await tickAfter(schedule.id, 2)).toMatchObject({ followups_queued: 0, suppressed: 1 });
    expect(await check(event.id)).toEqual({ status: 200, payload: decision === "verified" });
    expect(
      (await db`select * from notification_business_event_proofs where event_id=${event.id}`)[0],
    ).toEqual(proof);
    expect(
      (
        await db`select * from notification_business_occurrence_receipts where event_key='finance.invoice.received'`
      )[0],
    ).toEqual(receipt);
    expect((await db`select after from workflow_events where id=${event.id}`)[0].after).toEqual(
      event.after,
    );
    expect(
      (
        await db`select count(*)::int n from workflow_events where notification_event_key='finance.invoice.received'`
      )[0].n,
    ).toBe(1);
    expect(
      (
        await db`select count(*)::int n from notification_followup_occurrences where schedule_id=${schedule.id}`
      )[0].n,
    ).toBe(1);
    expect(
      (
        await db`select stopped_at is not null stopped from notification_followup_schedules where id=${schedule.id}`
      )[0].stopped,
    ).toBe(true);
    expect((await db`select status from hiring_fiscal_documents where id=${f.id}`)[0].status).toBe(
      decision,
    );
  },
);
