import { randomUUID } from "node:crypto";
import { beforeEach, expect, it } from "vitest";
import {
  db,
  W,
  A,
  U,
  X,
  WF,
  RUN,
  EVENT,
  reset,
  withRole,
  request,
  fixtureJwt,
} from "../../tests/fixtures/notification-deliveries";

beforeEach(reset);
const policy = {
  email_enabled: true,
  whatsapp_enabled: true,
  email_daily_limit: 10,
  whatsapp_daily_limit: 10,
  wa_sender_id: "123456789",
  wa_template_name: "techerp_update",
  wa_template_language: "pt_BR",
  wa_estimated_unit_micros: 1000,
  wa_daily_budget_micros: 10000,
  currency: "BRL",
  digest_enabled: false,
  followups_enabled: false,
  followup_daily_limit: 0,
};
const slackPolicy = {
  enabled: true,
  daily_limit: 10,
  integration_id: X,
  template_version: "neutral-v1",
};
const service = () => fixtureJwt("service_role");
const savePolicy = (next: Record<string, unknown> = policy, revision = 0) =>
  withRole(
    "authenticated",
    U,
    (tx) =>
      tx`select notification_delivery_settings_save(${W},${tx.json(JSON.parse(JSON.stringify(next)))},${revision})`,
  );
const saveSlack = (enabled = true, revision = 0) =>
  withRole(
    "authenticated",
    U,
    (tx) =>
      tx`select notification_slack_settings_save(${W},${tx.json({ ...slackPolicy, enabled })},${revision})`,
  );
const claim = (id: string) =>
  request("/rpc/notification_delivery_claim", { p_id: id }, U, service());
const preflight = (id: string, token: string) =>
  request("/rpc/notification_delivery_preflight", { p_id: id, p_token: token }, U, service());
const finish = (id: string, token: string, status: "accepted" | "uncertain") =>
  request(
    "/rpc/notification_delivery_finish",
    {
      p_id: id,
      p_token: token,
      p_status: status,
      p_provider: "managed_email",
      p_provider_id: null,
      p_reason: status === "uncertain" ? "transport_unknown" : null,
      p_retry_after_seconds: null,
    },
    U,
    service(),
  );
const notify = async (
  step = "2",
  channels = ["inapp", "whatsapp"],
  fallback = "email",
  workflow = WF,
  run = RUN,
) => {
  await withRole(
    "service_role",
    null,
    (tx) =>
      tx`select notification_workflow_dispatch_v2(${workflow},${run},1,'deals',${X},${tx.json([{ kind: "user", id: U }])},'Atualização disponível',null,${step},${tx.json({ channels, fallback })})`,
  );
  return (
    await db`select * from notification_delivery_intents where workflow_id=${workflow} and run_id=${run} and step_path=${step}`
  )[0];
};
async function prepare() {
  await db`update workflows set execution_user_id=${U},actions=${db.json([
    { type: "send_slack", text: "Atualização disponível" },
    {
      type: "send_notification",
      title: "Atualização disponível",
      recipients: [{ kind: "user", id: U }],
      delivery: { channels: ["inapp", "whatsapp"], fallback: "email" },
    },
  ])} where id=${WF}`;
  await savePolicy();
  await withRole(
    "authenticated",
    U,
    (tx) => tx`select save_notification_delivery_consent(${W},true,'+5548999990001',0)`,
  );
}
const emailJob = async (intent: string) =>
  (
    await db`select * from workflow_deliveries where notification_intent_id=${intent} and channel='email'`
  )[0];

it("shows why pausing only WhatsApp does not pause an explicitly configured email fallback", async () => {
  await prepare();
  const intent = await notify();
  const [wa] =
    await db`select id from workflow_deliveries where notification_intent_id=${intent.id} and channel='whatsapp'`;
  await savePolicy({ ...policy, whatsapp_enabled: false }, 1);
  expect(await claim(wa.id)).toMatchObject({
    status: 200,
    payload: { result: "suppressed", reason: "policy_disabled" },
  });
  const email = await emailJob(intent.id);
  expect(email).toMatchObject({ status: "queued", reason_code: "fallback_pending" });
  const claimed = await claim(email.id);
  expect(claimed).toMatchObject({ status: 200, payload: { result: "claimed", channel: "email" } });
  expect(await preflight(email.id, claimed.payload.token)).toMatchObject({
    status: 200,
    payload: { allowed: true },
  });
});

it("pauses each central outbound policy while preserving the original in-app notice and workflow state", async () => {
  await prepare();
  await saveSlack();
  const intent = await notify();
  await request(
    "/rpc/notification_workflow_slack_dispatch",
    {
      p_workspace: W,
      p_workflow: WF,
      p_run: RUN,
      p_step_path: "1",
      p_version: 1,
    },
    U,
    service(),
  );
  const [before] =
    await db`select id,read_at,title,created_at from notifications where id=${intent.notification_id}`;
  const [runBefore] = await db`select status from workflow_runs where id=${RUN}`;
  await savePolicy({ ...policy, email_enabled: false, whatsapp_enabled: false }, 1);
  await saveSlack(false, 1);
  const queued = await db`select id,channel from workflow_deliveries order by created_at,id`;
  expect(queued.map((row) => row.channel).sort()).toEqual(["slack", "whatsapp"]);
  for (const job of queued)
    expect(await claim(job.id)).toMatchObject({
      status: 200,
      payload: { result: "suppressed", reason: "policy_disabled" },
    });
  const email = await emailJob(intent.id);
  expect(await claim(email.id)).toMatchObject({
    status: 200,
    payload: { result: "suppressed", reason: "policy_disabled" },
  });
  expect(
    (
      await db`select id,read_at,title,created_at from notifications where id=${intent.notification_id}`
    )[0],
  ).toEqual(before);
  expect((await db`select status from workflow_runs where id=${RUN}`)[0]).toEqual(runBefore);
  expect((await db`select enabled from workflows where id=${WF}`)[0].enabled).toBe(true);
});

it("does not retract accepted delivery or replay uncertainty after policy and rule pause", async () => {
  await prepare();
  const accepted = await notify("2", ["email"], "none");
  const uncertain = await notify("3", ["email"], "none");
  const first = await emailJob(accepted.id),
    second = await emailJob(uncertain.id);
  for (const [job, status] of [
    [first, "accepted"],
    [second, "uncertain"],
  ] as const) {
    const leased = await claim(job.id);
    expect(leased).toMatchObject({ status: 200, payload: { result: "claimed" } });
    expect(await preflight(job.id, leased.payload.token)).toMatchObject({
      status: 200,
      payload: { allowed: true },
    });
    expect(await finish(job.id, leased.payload.token, status)).toMatchObject({
      status: 200,
      payload: { updated: true },
    });
  }
  await savePolicy({ ...policy, email_enabled: false, whatsapp_enabled: false }, 1);
  await db`update workflows set enabled=false where id=${WF}`;
  expect((await db`select status from workflow_deliveries where id=${first.id}`)[0].status).toBe(
    "accepted",
  );
  expect(await claim(second.id)).toMatchObject({
    status: 200,
    payload: { result: "already_done", reason: "transport_unknown" },
  });
  expect((await db`select status from workflow_deliveries where id=${second.id}`)[0].status).toBe(
    "uncertain",
  );
  expect((await db`select count(*)::int n from workflow_deliveries`)[0].n).toBe(2);
  expect(
    await request("/rpc/notification_worker_list", { p_limit: 20 }, U, service()),
  ).toMatchObject({ status: 200, payload: [] });
});

it("requires inventory of other workflows because enabling a shared policy can release both queues", async () => {
  await prepare();
  await savePolicy({ ...policy, email_enabled: false }, 1);
  const first = await notify("2", ["email"], "none");
  const workflow = randomUUID(),
    run = randomUUID();
  await db`insert into workflows select (jsonb_populate_record(null::workflows,to_jsonb(w)||jsonb_build_object('id',${workflow}::text))).* from workflows w where id=${WF}`;
  await db`insert into workflow_runs(id,workspace_id,owner_id,workflow_id,event_id,entity,entity_id) values(${run},${W},${A},${workflow},${EVENT},'deals',${X})`;
  const second = await notify("2", ["email"], "none", workflow, run);
  await savePolicy(policy, 2);
  for (const intent of [first, second]) {
    const job = await emailJob(intent.id);
    expect(await claim(job.id)).toMatchObject({
      status: 200,
      payload: { result: "claimed", channel: "email" },
    });
  }
  expect(
    (
      await db`select count(distinct workflow_id)::int n from workflow_deliveries where status='in_flight'`
    )[0].n,
  ).toBe(2);
});
