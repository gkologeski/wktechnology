import { beforeEach, expect, it } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import {
  db,
  W,
  B,
  A,
  U,
  F,
  ROLE,
  X,
  WF,
  RUN,
  EVENT,
  reset,
  withRole,
  request,
  fixtureJwt,
  enableNotificationConcurrencyPreparation,
} from "../../tests/fixtures/notification-deliveries";

enableNotificationConcurrencyPreparation();
beforeEach(reset);
const webhook = "https://hooks.slack.com/services/T_FIXTURE/B_FIXTURE/synthetic-not-a-secret";
const policy = {
  enabled: true,
  daily_limit: 10,
  integration_id: X,
  template_version: "neutral-v1",
};
const settings = (actor = U, ws = W) =>
  withRole(
    "authenticated",
    actor,
    async (tx) => (await tx`select notification_slack_settings(${ws}) r`)[0].r,
  );
const save = (value = policy, revision = 0, actor = U, ws = W) =>
  withRole(
    "authenticated",
    actor,
    async (tx) =>
      (await tx`select notification_slack_settings_save(${ws},${tx.json(value)},${revision}) r`)[0]
        .r,
  );
const enqueue = (step = "1", run = RUN, workflow = WF, ws = W, version = 1) =>
  withRole(
    "service_role",
    null,
    async (tx) =>
      (
        await tx`select notification_workflow_slack_dispatch(${ws},${workflow},${run},${step},${version}) r`
      )[0].r,
  );
const claim = (id: string) =>
  withRole(
    "service_role",
    null,
    async (tx) => (await tx`select notification_delivery_claim(${id}) r`)[0].r,
  );
const preflight = (id: string, token: string) =>
  withRole(
    "service_role",
    null,
    async (tx) => (await tx`select notification_delivery_preflight(${id},${token}) r`)[0].r,
  );
const endpoint = (id: string, token: string) =>
  withRole(
    "service_role",
    null,
    async (tx) => (await tx`select notification_slack_endpoint(${id},${token}) r`)[0].r,
  );
const finish = (
  id: string,
  token: string,
  status = "accepted",
  reason: string | null = null,
  retry: number | null = null,
  providerId: string | null = null,
) =>
  withRole(
    "service_role",
    null,
    async (tx) =>
      (
        await tx`select notification_delivery_finish(${id},${token},${status},'slack_webhook',${providerId},${reason},${retry}) r`
      )[0].r,
  );
const history = (
  scope = "workspace",
  channel: string | null = "slack",
  actor = U,
  cursor: unknown = null,
) =>
  withRole(
    "authenticated",
    actor,
    async (tx) =>
      (
        await tx`select notification_delivery_history(${W},${tx.json(cursor as never)},null,${channel},${scope}) r`
      )[0].r,
  );
async function prepare(
  actions: unknown[] = [{ type: "send_slack", text: "Private {{salary}} @here" }],
) {
  await db`update workflows set execution_user_id=${U},actions=${db.json(actions as never)} where id=${WF}`;
  await save();
}
async function ready() {
  await prepare();
  return enqueue();
}
async function releaseClock() {
  await db`update notification_slack_endpoint_state set next_allowed_at=now()-interval '1 second',busy_until=now()-interval '1 second'`;
  await db`update workflow_deliveries set next_attempt_at=now()-interval '1 second' where channel='slack'`;
}

it("notification Slack allow authorized member", async () => {
  expect((await settings()).policy).toEqual({
    enabled: false,
    daily_limit: 0,
    integration_id: null,
    template_version: "neutral-v1",
  });
  expect((await save()).revision).toBe(1);
  expect((await request("/rpc/notification_slack_settings", { p_workspace: W })).status).toBe(200);
});
it("notification Slack reject missing permission", async () => {
  await db`delete from job_role_permission_overrides where role_id=${ROLE} and permission_key='system.notification_settings.view.workspace'`;
  await expect(settings()).rejects.toMatchObject({ code: "42501" });
  expect((await request("/rpc/notification_slack_settings", { p_workspace: W })).status).toBe(403);
});
it("notification Slack reject explicit deny", async () => {
  await db`update job_role_permission_overrides set effect='deny' where role_id=${ROLE} and permission_key='system.integrations.manage.workspace'`;
  await expect(save()).rejects.toMatchObject({ code: "42501" });
  expect(
    (
      await request("/rpc/notification_slack_settings_save", {
        p_workspace: W,
        p_policy: policy,
        p_revision: 0,
      })
    ).status,
  ).toBe(403);
});
it("notification Slack reject foreign workspace", async () => {
  await expect(settings(F, W)).rejects.toMatchObject({ code: "42501" });
  await expect(settings(U, B)).rejects.toMatchObject({ code: "42501" });
  expect((await request("/rpc/notification_slack_settings", { p_workspace: W }, F)).status).toBe(
    403,
  );
});
it("notification Slack reject inactive member", async () => {
  await db`update workspace_members set status='inactive' where workspace_id=${W} and user_id=${U}`;
  await expect(settings()).rejects.toMatchObject({ code: "42501" });
  expect((await request("/rpc/notification_slack_settings", { p_workspace: W })).status).toBe(403);
});
it("requires integration view/manage and respects restrictive integration policies", async () => {
  await expect(
    withRole("authenticated", U, async (tx) => {
      await tx`select set_config('test.notification_hidden',${X},true)`;
      return (await tx`select notification_slack_settings_save(${W},${tx.json(policy)},0) r`)[0].r;
    }),
  ).rejects.toMatchObject({ code: "42501" });
  await db`delete from job_role_permission_overrides where role_id=${ROLE} and permission_key='system.integrations.view.workspace'`;
  expect(
    (
      await withRole(
        "authenticated",
        U,
        async (tx) => (await tx`select notification_delivery_capabilities(${W}) r`)[0].r,
      )
    ).slackView,
  ).toBe(false);
  await expect(settings()).rejects.toMatchObject({ code: "42501" });
});
it("validates fixed templates policy limits CAS and read-only mode without changing integration", async () => {
  for (const p of [
    { ...policy, template_version: "free-form" },
    { ...policy, enabled: true, daily_limit: 0 },
    { ...policy, daily_limit: 10001 },
    { ...policy, arbitrary_text: "{{salary}}" },
  ])
    await expect(save(p)).rejects.toMatchObject({ code: "22023" });
  await save();
  await expect(save(policy, 0)).rejects.toMatchObject({ code: "40001" });
  const session = randomUUID();
  await db`insert into view_as_sessions(session_id,mode) values(${session},'role')`;
  await expect(
    withRole(
      "authenticated",
      U,
      async (tx) =>
        (await tx`select notification_slack_settings_save(${W},${tx.json(policy)},1) r`)[0].r,
      { session_id: session },
    ),
  ).rejects.toMatchObject({ code: "42501" });
  expect(
    (
      await db`select access_token,notification_endpoint_revision from slack_integrations where id=${X}`
    )[0],
  ).toEqual({ access_token: webhook, notification_endpoint_revision: 1 });
});
it("queues one collective endpoint notice and deduplicates concurrent occurrences without personal fanout", async () => {
  const profileStart = performance.now();
  console.info("[slack-ci-profile] case started");
  await prepare();
  console.info(
    "[slack-ci-profile]",
    JSON.stringify({ stage: "prepared", elapsed_ms: performance.now() - profileStart }),
  );
  const measuredEnqueue = async (index: number) => {
    const started = performance.now();
    try {
      return await enqueue();
    } finally {
      console.info(
        "[slack-ci-profile]",
        JSON.stringify({
          stage: "enqueue",
          index,
          elapsed_ms: performance.now() - started,
          case_elapsed_ms: performance.now() - profileStart,
        }),
      );
    }
  };
  const results = await Promise.all([measuredEnqueue(0), measuredEnqueue(1), measuredEnqueue(2)]);
  console.info(
    "[slack-ci-profile]",
    JSON.stringify({ stage: "enqueued", elapsed_ms: performance.now() - profileStart }),
  );
  expect(results.filter((v) => v.result === "queued")).toHaveLength(1);
  expect(results.filter((v) => v.result === "duplicate")).toHaveLength(2);
  const rows = await db`select * from workflow_deliveries where channel='slack'`;
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    recipient: null,
    notification_intent_id: null,
    status: "queued",
    attempts: 0,
  });
  expect(await db`select * from notifications`).toHaveLength(0);
  const i = (await db`select * from notification_slack_intents`)[0];
  expect(JSON.stringify(i)).not.toContain("salary");
  expect(JSON.stringify(i)).not.toContain("@here");
});
it("binds actual published nested action paths and rejects arbitrary steps or channel overrides", async () => {
  await prepare([{ type: "branch_if", then: [{ type: "send_slack", text: "ignored" }], else: [] }]);
  await expect(enqueue("1")).rejects.toMatchObject({ code: "42501" });
  await expect(enqueue("2.then.1")).rejects.toMatchObject({ code: "42501" });
  expect((await enqueue("1.then.1")).result).toBe("queued");
  await db`update workflows set actions='[{"type":"send_slack","channel":"C_UNVERIFIED","text":"ignored"}]' where id=${WF}`;
  await expect(enqueue()).rejects.toMatchObject({ code: "42501" });
});
it("requires real matching workflow run event version actor and source at dispatch", async () => {
  await prepare();
  await expect(enqueue("1", RUN, WF, B)).rejects.toMatchObject({ code: "42501" });
  await db`update workflow_events set workflow_version=2 where id=${EVENT}`;
  await expect(enqueue()).rejects.toMatchObject({ code: "42501" });
  await db`update workflow_events set workflow_version=1 where id=${EVENT}`;
  await db`update workflow_runs set is_test=true where id=${RUN}`;
  await expect(enqueue()).rejects.toMatchObject({ code: "42501" });
  await db`update workflow_runs set is_test=false where id=${RUN}`;
  await db`delete from job_role_permission_overrides where role_id=${ROLE} and permission_key='techsales.deals.view.workspace'`;
  await expect(enqueue()).rejects.toMatchObject({ code: "42501" });
});
it("pins endpoint revision and literal hash at enqueue and never reroutes a pending notice", async () => {
  const d = await ready();
  await db`update slack_integrations set access_token=access_token||'-changed',notification_endpoint_revision=999 where id=${X}`;
  expect(
    (await db`select notification_endpoint_revision r from slack_integrations where id=${X}`)[0].r,
  ).toBe(2);
  expect(await claim(d.deliveryId)).toMatchObject({
    result: "suppressed",
    reason: "endpoint_changed",
  });
  await db`update slack_integrations set notification_endpoint_revision=0 where id=${X}`;
  expect(
    (await db`select notification_endpoint_revision r from slack_integrations where id=${X}`)[0].r,
  ).toBe(2);
});
it("returns only the bound server-side endpoint and does not spend slots during repeated preflight", async () => {
  const d = await ready(),
    c = await claim(d.deliveryId);
  expect(c).toMatchObject({
    result: "claimed",
    integrationId: X,
    endpointRevision: 1,
    endpointHash: createHash("sha256").update(webhook).digest("hex"),
  });
  expect(c).not.toHaveProperty("recipientId");
  expect(JSON.stringify(c)).not.toContain("https://hooks");
  expect(await endpoint(c.id, c.token)).toEqual({ webhookUrl: webhook });
  for (let n = 0; n < 3; n++)
    expect(await preflight(c.id, c.token)).toMatchObject({ allowed: true });
  expect((await db`select attempts from workflow_deliveries where id=${c.id}`)[0].attempts).toBe(1);
  await expect(endpoint(c.id, randomUUID())).rejects.toMatchObject({ code: "42501" });
});
it("revalidates source and integration restrictions before the provider POST", async () => {
  const d = await ready(),
    c = await claim(d.deliveryId);
  const denied = await withRole("service_role", null, async (tx) => {
    await tx`select set_config('test.notification_hidden',${X},true)`;
    return (await tx`select notification_delivery_preflight(${c.id},${c.token}) r`)[0].r;
  });
  expect(denied).toMatchObject({ allowed: false, result: "suppressed" });
  await expect(endpoint(c.id, c.token)).rejects.toMatchObject({ code: "42501" });
});
it("suppresses revoked integration manage membership workflow and policy at the final guard", async () => {
  const d = await ready(),
    c = await claim(d.deliveryId);
  await db`update job_role_permission_overrides set effect='deny' where role_id=${ROLE} and permission_key='system.integrations.manage.workspace'`;
  expect(await preflight(c.id, c.token)).toMatchObject({
    allowed: false,
    reason: "executor_transport_forbidden",
  });
  expect(await finish(c.id, c.token)).toEqual({ updated: false });
  expect(await db`select id from workflow_deliveries where channel='email'`).toHaveLength(0);
});
it("fences old workers and expired tokens without retrying an uncertain POST", async () => {
  const d = await ready(),
    c = await claim(d.deliveryId);
  expect(await preflight(c.id, randomUUID())).toMatchObject({ allowed: false });
  expect((await db`select status from workflow_deliveries where id=${c.id}`)[0].status).toBe(
    "in_flight",
  );
  await db`update workflow_deliveries set lease_until=now()-interval '1 second' where id=${c.id}`;
  expect(await claim(c.id)).toMatchObject({ result: "uncertain", reason: "lease_expired" });
  expect(await finish(c.id, c.token)).toEqual({ updated: false });
  expect(await claim(c.id)).toMatchObject({ result: "already_done" });
  const legacy = await withRole("service_role", null, async (tx) => {
    const key = (await tx`select idempotency_key from workflow_deliveries where id=${c.id}`)[0]
      .idempotency_key;
    const result = (
      await tx`select workflow_delivery_claim(${W},${WF},${key},'email','1',null) r`
    )[0].r;
    await tx`select workflow_delivery_finish(${key},'sent','forged',null,null,null)`;
    return result;
  });
  expect(legacy).toEqual({ result: "forbidden" });
  expect((await db`select status from workflow_deliveries where id=${c.id}`)[0].status).toBe(
    "uncertain",
  );
});
it("serializes endpoint claims and enforces the one-second gap after completion", async () => {
  await prepare([
    { type: "send_slack", text: "one" },
    { type: "send_slack", text: "two" },
  ]);
  const a = await enqueue("1"),
    b = await enqueue("2");
  const results = await Promise.all([claim(a.deliveryId), claim(b.deliveryId)]);
  const first = results.find((v) => v.result === "claimed")!;
  expect(results.filter((v) => v.result === "claimed")).toHaveLength(1);
  expect(results.filter((v) => v.result === "deferred")).toHaveLength(1);
  expect(await finish(first.id, first.token)).toEqual({ updated: true });
  const other = first.id === a.deliveryId ? b : a;
  expect((await claim(other.deliveryId)).result).toBe("deferred");
  const gap = (
    await db`select next_allowed_at>=now()+interval '0.8 seconds' ok from notification_slack_endpoint_state`
  )[0].ok;
  expect(gap).toBe(true);
  await releaseClock();
  expect((await claim(other.deliveryId)).result).toBe("claimed");
});
it("preserves the entire Retry-After and shares its cooldown with other queued jobs", async () => {
  await prepare([
    { type: "send_slack", text: "one" },
    { type: "send_slack", text: "two" },
  ]);
  const a = await enqueue("1"),
    b = await enqueue("2"),
    c = await claim(a.deliveryId);
  expect(await finish(c.id, c.token, "retry_scheduled", "provider_rate_limited", 7200)).toEqual({
    updated: true,
  });
  expect(
    (
      await db`select next_attempt_at>=now()+interval '7199 seconds' ok from workflow_deliveries where id=${c.id}`
    )[0].ok,
  ).toBe(true);
  const deferred = await claim(b.deliveryId);
  expect(deferred).toMatchObject({ result: "deferred", reason: "provider_rate_limited" });
  expect(Date.parse(deferred.nextAttemptAt)).toBeGreaterThan(Date.now() + 7_198_000);
  expect(
    (await db`select attempts from workflow_deliveries where id=${b.deliveryId}`)[0].attempts,
  ).toBe(0);
});
it("pauses the endpoint for manual review when rate-limit timing cannot be trusted", async () => {
  await prepare([
    { type: "send_slack", text: "one" },
    { type: "send_slack", text: "two" },
  ]);
  const a = await enqueue("1"),
    b = await enqueue("2"),
    c = await claim(a.deliveryId);
  await finish(c.id, c.token, "failed", "provider_rate_limited");
  expect(
    (
      await db`select next_allowed_at='infinity'::timestamptz paused from notification_slack_endpoint_state`
    )[0].paused,
  ).toBe(true);
  expect(await claim(b.deliveryId)).toMatchObject({
    result: "deferred",
    reason: "provider_rate_limited",
  });
  await save(policy, 1);
  expect(
    (
      await db`select next_allowed_at='-infinity'::timestamptz released from notification_slack_endpoint_state`
    )[0].released,
  ).toBe(true);
  // Re-saving deliberately invalidates old queued policy snapshots; it does not reroute them.
  await releaseClock();
  expect(await claim(b.deliveryId)).toMatchObject({
    result: "suppressed",
    reason: "endpoint_changed",
  });
});
it("never converts webhook acceptance into delivery or read receipts", async () => {
  const d = await ready(),
    c = await claim(d.deliveryId);
  await expect(
    finish(c.id, c.token, "accepted", null, null, "fabricated-ts"),
  ).rejects.toMatchObject({ code: "22023" });
  await expect(finish(c.id, c.token, "delivered")).rejects.toMatchObject({ code: "22023" });
  expect(await finish(c.id, c.token)).toEqual({ updated: true });
  expect(await finish(c.id, c.token)).toEqual({ updated: true });
  expect(
    (await db`select status,provider_id from workflow_deliveries where id=${c.id}`)[0],
  ).toEqual({ status: "accepted", provider_id: null });
});
it("uses only workspace history and filters current source and integration visibility", async () => {
  await ready();
  expect((await history("own")).items).toHaveLength(0);
  expect((await history()).items).toHaveLength(1);
  await db`delete from job_role_permission_overrides where role_id=${ROLE} and permission_key='system.notification_deliveries.view.workspace'`;
  await expect(history()).rejects.toMatchObject({ code: "42501" });
  await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${W},${ROLE},'system.notification_deliveries.view.workspace','grant')`;
  await db`update job_role_permission_overrides set effect='deny' where role_id=${ROLE} and permission_key='system.integrations.view.workspace'`;
  expect((await history()).items).toHaveLength(0);
  const direct = await withRole(
    "authenticated",
    U,
    async (tx) => tx`select id from workflow_deliveries where channel='slack'`,
  );
  expect(direct).toHaveLength(0);
});
it("keeps endpoint secrets private through real HTTP JWT APIs including service-with-user spoofing", async () => {
  const d = await ready(),
    c = await claim(d.deliveryId);
  for (const table of [
    "notification_slack_policies",
    "notification_slack_intents",
    "notification_slack_endpoint_state",
  ])
    expect((await request("/" + table + "?select=*")).status).toBe(403);
  expect((await request("/slack_integrations?select=access_token")).status).toBe(403);
  for (const rpc of ["notification_slack_endpoint", "notification_delivery_preflight"])
    expect((await request("/rpc/" + rpc, { p_id: c.id, p_token: c.token })).status).toBe(403);
  expect(
    (
      await request(
        "/rpc/notification_slack_endpoint",
        { p_id: c.id, p_token: c.token },
        U,
        fixtureJwt("service_role", U),
      )
    ).status,
  ).toBe(403);
  const allowed = await request(
    "/rpc/notification_slack_endpoint",
    { p_id: c.id, p_token: c.token },
    U,
    fixtureJwt("service_role"),
  );
  expect(allowed.status).toBe(200);
  expect(allowed.payload).toEqual({ webhookUrl: webhook });
  const text = JSON.stringify((await history()).items);
  for (const forbidden of [webhook, c.token, c.endpointHash, "salary", "@here"])
    expect(text).not.toContain(forbidden);
  expect(
    (await request("/rpc/notification_delivery_claim_personal_v1", { p_id: c.id })).status,
  ).toBe(403);
});
it("keeps confirmed-email long Retry-After intact through the common finish wrapper", async () => {
  await withRole(
    "authenticated",
    U,
    async (tx) =>
      tx`select notification_delivery_settings_save(${W},${tx.json({
        email_enabled: true,
        whatsapp_enabled: false,
        email_daily_limit: 10,
        whatsapp_daily_limit: 0,
        wa_sender_id: null,
        wa_template_name: null,
        wa_template_language: null,
        wa_estimated_unit_micros: 0,
        wa_daily_budget_micros: 0,
        currency: "BRL",
      })},0)`,
  );
  await withRole(
    "service_role",
    null,
    async (tx) =>
      tx`select notification_workflow_dispatch_v2(${WF},${RUN},1,'deals',${X},${tx.json([{ kind: "user", id: U }])},'Safe notice','Safe notice','email',${tx.json({ channels: ["email"], fallback: "none" })})`,
  );
  const d = (await db`select id from workflow_deliveries where channel='email'`)[0],
    c = await claim(d.id);
  await withRole(
    "service_role",
    null,
    async (tx) =>
      tx`select notification_delivery_finish(${d.id},${c.token},'retry_scheduled','managed_email',null,'provider_rate_limited',7200)`,
  );
  expect(
    (
      await db`select next_attempt_at>=now()+interval '7199 seconds' ok from workflow_deliveries where id=${d.id}`
    )[0].ok,
  ).toBe(true);
});
it("shares rate reservations across workspaces reusing the exact webhook without exposing their deliveries", async () => {
  const first = await ready(),
    active = await claim(first.deliveryId);
  const integration = randomUUID(),
    workflow = randomUUID(),
    run = randomUUID(),
    event = randomUUID(),
    source = randomUUID();
  await db`insert into workspace_members(workspace_id,user_id) values(${B},${A})`;
  await db`update profiles set active_workspace_id=${B} where id=${A}`;
  await db`insert into slack_integrations(id,workspace_id,owner_id,access_token) values(${integration},${B},${A},${webhook})`;
  await db`insert into deals(id,workspace_id,owner_id,assigned_to) values(${source},${B},${A},${A})`;
  await db`insert into workflows(id,workspace_id,owner_id,execution_user_id,entity,actions) values(${workflow},${B},${A},${A},'deals','[{"type":"send_slack","text":"ignored"}]')`;
  await db`insert into workflow_events(id,workspace_id,owner_id,entity,entity_id,workflow_version) values(${event},${B},${A},'deals',${source},1)`;
  await db`insert into workflow_runs(id,workspace_id,owner_id,workflow_id,event_id,entity,entity_id) values(${run},${B},${A},${workflow},${event},'deals',${source})`;
  await save({ ...policy, integration_id: integration }, 0, A, B);
  const next = await enqueue("1", run, workflow, B);
  expect(await claim(next.deliveryId)).toMatchObject({
    result: "deferred",
    reason: "provider_rate_limited",
  });
  expect(await db`select * from notification_slack_endpoint_state`).toHaveLength(1);
  await finish(active.id, active.token, "retry_scheduled", "provider_rate_limited", 7200);
  await db`update workflow_deliveries set next_attempt_at=now() where id=${next.deliveryId}`;
  const deferred = await claim(next.deliveryId);
  expect(Date.parse(deferred.nextAttemptAt)).toBeGreaterThan(Date.now() + 7_198_000);
  expect((await history()).items.map((item: { id: string }) => item.id)).toEqual([
    first.deliveryId,
  ]);
});
it("reserves the workspace daily quota atomically and does not spend another attempt on deferral", async () => {
  await prepare([
    { type: "send_slack", text: "one" },
    { type: "send_slack", text: "two" },
  ]);
  await save({ ...policy, daily_limit: 1 }, 1);
  const a = await enqueue("1"),
    b = await enqueue("2"),
    c = await claim(a.deliveryId);
  await finish(c.id, c.token);
  await releaseClock();
  expect(await claim(b.deliveryId)).toMatchObject({ result: "deferred", reason: "quota_exceeded" });
  expect(
    (await db`select attempts,status from workflow_deliveries where id=${b.deliveryId}`)[0],
  ).toEqual({ attempts: 0, status: "queued" });
});

it("rejects an outdated execution version even when a legacy event has no pinned version", async () => {
  await prepare();
  await db`update workflow_events set workflow_version=null where id=${EVENT}`;
  await db`update workflows set published_version=2 where id=${WF}`;
  await expect(enqueue("1", RUN, WF, W, 1)).rejects.toMatchObject({ code: "42501" });
  expect(await db`select * from notification_slack_intents`).toHaveLength(0);
  expect((await enqueue("1", RUN, WF, W, 2)).result).toBe("queued");
});

it("lists a Slack-only published rule through the existing workflow rule catalogue", async () => {
  await prepare();
  const result = await withRole(
    "authenticated",
    U,
    async (tx) => (await tx`select notification_delivery_rules(${W}) r`)[0].r,
  );
  expect(result.items.map((item: { id: string }) => item.id)).toEqual([WF]);
  expect(result.items[0].actions[0].type).toBe("send_slack");
});

it("preserves legacy case branch and parallel namespaces with heterogeneous actions", async () => {
  await prepare([
    {
      type: "switch_by_value",
      field: "status",
      cases: [
        { value: "won", actions: [{ type: "send_slack", text: "ignored" }] },
        { value: "lost", actions: [{ type: "send_email", subject: "private", body: "private" }] },
        {
          value: "open",
          actions: [{ type: "send_slack", channel: "C_UNVERIFIED", text: "ignored" }],
        },
      ],
      default: [],
    },
  ]);
  // Branch selection is the service engine's existing responsibility. SQL checks
  // its exact version/path and canonical safe action, not a new condition engine.
  expect((await enqueue("1.case.1")).result).toBe("queued");
  await db`update workflows set actions=${db.json([
    {
      type: "branch_multi",
      branches: [
        { filters: [], actions: [{ type: "send_slack", text: "ignored" }] },
        { filters: [], actions: [{ type: "send_email", subject: "private", body: "private" }] },
      ],
      else: [],
    },
  ])} where id=${WF}`;
  expect((await enqueue("1.branch.1")).result).toBe("queued");
  await db`update workflows set actions=${db.json([
    {
      type: "parallel",
      join: "all",
      branches: [
        { actions: [{ type: "send_slack", text: "ignored" }] },
        { actions: [{ type: "send_email", subject: "private", body: "private" }] },
      ],
    },
  ])} where id=${WF}`;
  expect((await enqueue("1.p1.1")).result).toBe("queued");
  await expect(enqueue("1.p2.1")).rejects.toMatchObject({ code: "42501" });
});
