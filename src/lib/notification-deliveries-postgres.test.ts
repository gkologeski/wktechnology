import { beforeEach, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  db,
  W,
  B,
  A,
  U,
  C,
  N,
  F,
  ROLE,
  X,
  WF,
  RUN,
  reset,
  withRole,
  request,
  fixtureJwt,
} from "../../tests/fixtures/notification-deliveries";

beforeEach(reset);
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Expected fixture row was not found");
  return value;
}
const policy = {
  email_enabled: true,
  whatsapp_enabled: false,
  email_daily_limit: 10,
  whatsapp_daily_limit: 10,
  wa_sender_id: null,
  wa_template_name: null,
  wa_template_language: null,
  wa_estimated_unit_micros: 0,
  wa_daily_budget_micros: 0,
  currency: "BRL",
};
const settings = (actor = U, ws = W) =>
  withRole(
    "authenticated",
    actor,
    async (tx) => (await tx`select notification_delivery_settings(${ws}) r`)[0].r,
  );
const save = (p: Record<string, unknown> = policy, revision = 0, actor = U, ws = W) =>
  withRole(
    "authenticated",
    actor,
    async (tx) =>
      (
        await tx`select notification_delivery_settings_save(${ws},${tx.json(JSON.parse(JSON.stringify(p)))},${revision}) r`
      )[0].r,
  );
const enqueue = (delivery = { channels: ["email"], fallback: "none" }, target = U, step = "0") =>
  withRole(
    "service_role",
    null,
    async (tx) =>
      (
        await tx`select notification_workflow_dispatch_v2(${WF},${RUN},1,'deals',${X},${tx.json([{ kind: "user", id: target }])},'Fixture notice','Private source snapshot',${step},${tx.json(delivery)}) r`
      )[0].r,
  );
const claim = (id: string) =>
  withRole(
    "service_role",
    null,
    async (tx) => (await tx`select notification_delivery_claim(${id}) r`)[0].r,
  );
const listJobs = () =>
  db`select id,channel,status,reason_code from workflow_deliveries where notification_intent_id is not null order by channel`;

it("notification deliveries allow authorized member", async () => {
  expect((await settings()).policy.email_enabled).toBe(false);
  expect((await save()).revision).toBe(1);
});
it("notification deliveries reject missing permission", async () => {
  await db`delete from job_role_permission_overrides where role_id=${ROLE} and permission_key='system.notification_settings.view.workspace'`;
  await expect(settings()).rejects.toMatchObject({ code: "42501" });
});
it("notification deliveries reject explicit deny", async () => {
  await db`update job_role_permission_overrides set effect='deny' where role_id=${ROLE} and permission_key='system.notification_settings.manage.workspace'`;
  await expect(save()).rejects.toMatchObject({ code: "42501" });
});
it("notification deliveries reject foreign workspace", async () => {
  await expect(settings(F, W)).rejects.toMatchObject({ code: "42501" });
  await expect(settings(U, B)).rejects.toMatchObject({ code: "42501" });
});
it("notification deliveries reject inactive member", async () => {
  await db`update workspace_members set status='inactive' where workspace_id=${W} and user_id=${U}`;
  await expect(settings()).rejects.toMatchObject({ code: "42501" });
});

const waPolicy = {
  ...policy,
  whatsapp_enabled: true,
  wa_sender_id: "123456789",
  wa_template_name: "techerp_update",
  wa_template_language: "pt_BR",
  wa_estimated_unit_micros: 1000,
  wa_daily_budget_micros: 10000,
};
const consent = (granted = true, phone = "+5548999990001", revision = 0, actor = U, ws = W) =>
  withRole(
    "authenticated",
    actor,
    async (tx) =>
      (
        await tx`select save_notification_delivery_consent(${ws},${granted},${phone},${revision}) r`
      )[0].r,
  );
const phone = (next: string, expected: string | null = "+5548999990001", actor = U, ws = W) =>
  withRole(
    "authenticated",
    actor,
    async (tx) =>
      (await tx`select notification_delivery_profile_phone(${ws},${next},${expected}) r`)[0].r,
  );
const preflight = (id: string, token: string) =>
  withRole(
    "service_role",
    null,
    async (tx) => (await tx`select notification_delivery_preflight(${id},${token}) r`)[0].r,
  );
const finish = (
  id: string,
  token: string,
  status = "accepted",
  provider = "managed_email",
  providerId: string | null = null,
  reason: string | null = null,
) =>
  withRole(
    "service_role",
    null,
    async (tx) =>
      (
        await tx`select notification_delivery_finish(${id},${token},${status},${provider},${providerId},${reason},null) r`
      )[0].r,
  );
const history = (
  actor = U,
  scope = "own",
  channel: string | null = null,
  cursor: Record<string, unknown> | null = null,
) =>
  withRole(
    "authenticated",
    actor,
    async (tx) =>
      (
        await tx`select notification_delivery_history(${W},${cursor ? tx.json(JSON.parse(JSON.stringify(cursor))) : null},null,${channel},${scope}) r`
      )[0].r,
  );
const job = async () => (await listJobs())[0];
const readyEmail = async () => {
  await save();
  await enqueue();
  return job();
};
const readyWA = async (fallback = "none") => {
  await save(waPolicy);
  await consent();
  await enqueue({ channels: ["whatsapp"], fallback });
  return job();
};
const addPrefs = async (settings: Record<string, unknown>) => {
  await db`insert into notification_user_preferences(workspace_id,user_id,settings,revision) values(${W},${U},${db.json(JSON.parse(JSON.stringify(settings)))},1) on conflict(workspace_id,user_id) do update set settings=excluded.settings,revision=notification_user_preferences.revision+1`;
};

it("exposes safe disabled capabilities and does not grant new permissions to roles", async () => {
  const r = await withRole(
    "authenticated",
    N,
    async (tx) => (await tx`select notification_delivery_capabilities(${W}) r`)[0].r,
  );
  expect(r).toMatchObject({
    settingsView: false,
    settingsManage: false,
    deliveriesView: true,
    deliveriesWorkspaceView: false,
    whatsappConfigure: false,
  });
  await expect(settings(N)).rejects.toMatchObject({ code: "42501" });
  expect((await db`select count(*)::int n from notification_delivery_policies`)[0].n).toBe(0);
});
it("validates policy ranges channel prerequisites and compare-and-swap over HTTP", async () => {
  for (const p of [
    { ...policy, email_daily_limit: 0 },
    { ...policy, email_daily_limit: 10001 },
    { ...policy, wa_daily_budget_micros: 1000000000001 },
    { ...waPolicy, wa_estimated_unit_micros: 0 },
    { ...waPolicy, wa_sender_id: "foreign" },
    { ...policy, approved: true },
  ])
    await expect(save(p)).rejects.toMatchObject({ code: "22023" });
  const r = await request("/rpc/notification_delivery_settings_save", {
    p_workspace: W,
    p_policy: policy,
    p_revision: 0,
  });
  expect(r.status).toBe(200);
  const stale = await request("/rpc/notification_delivery_settings_save", {
    p_workspace: W,
    p_policy: policy,
    p_revision: 0,
  });
  expect(stale).toMatchObject({ status: 409, payload: { code: "PT409" } });
  const concurrent = await Promise.allSettled([
    save(policy, 1),
    save({ ...policy, email_daily_limit: 20 }, 1),
  ]);
  expect(concurrent.filter((x) => x.status === "fulfilled")).toHaveLength(1);
});
it("preserves unchanged WhatsApp configuration for email administrators and rejects channel deny", async () => {
  await save(waPolicy);
  await db`update job_role_permission_overrides set effect='deny' where role_id=${ROLE} and permission_key='system.whatsapp.manage.workspace'`;
  expect((await save({ ...waPolicy, email_daily_limit: 11 }, 1)).revision).toBe(2);
  await expect(save({ ...waPolicy, wa_template_name: "changed" }, 2)).rejects.toMatchObject({
    code: "42501",
  });
  await db`update job_role_permission_overrides set effect='deny' where role_id=${ROLE} and permission_key='system.channels.view.workspace'`;
  await expect(save({ ...waPolicy, wa_sender_id: "987654321" }, 2)).rejects.toMatchObject({
    code: "42501",
  });
});
it("requires own current E164 phone consent and supports revocation after profile changes", async () => {
  await expect(consent(true, "+5548999999999")).rejects.toMatchObject({ code: "42501" });
  expect((await consent()).consent).toMatchObject({
    phone: "+5548999990001",
    version: "notifica-wa-v1",
    revision: 1,
    revokedAt: null,
  });
  await expect(consent()).rejects.toMatchObject({ code: "PT409" });
  await db`update profiles set phone=null where id=${U}`;
  expect((await consent(false, "", 1)).consent.revision).toBe(2);
  expect((await consent(false, "", 2)).consent.revokedAt).not.toBeNull();
});
it("updates only the signed-in profile phone with CAS and revokes their consent across workspaces", async () => {
  await consent();
  await db`insert into notification_delivery_consents(workspace_id,user_id,phone,granted_at,revision) values(${B},${U},'+5548999990001',now(),1),(${W},${C},'+5548999990001',now(),1)`;
  expect(await phone("+5548999990002")).toEqual({ phone: "+5548999990002" });
  await expect(phone("+5548999990003")).rejects.toMatchObject({ code: "PT409" });
  const own =
    await db`select revoked_at,revision from notification_delivery_consents where user_id=${U}`;
  expect(own).toHaveLength(2);
  expect(own.every((x) => x.revoked_at && x.revision === 2)).toBe(true);
  expect(
    (await db`select revoked_at from notification_delivery_consents where user_id=${C}`)[0]
      .revoked_at,
  ).toBeNull();
  await expect(phone("+5548999990003", null, F, W)).rejects.toMatchObject({ code: "42501" });
});
it("blocks policy consent and profile writes in read-only mode", async () => {
  const session = randomUUID();
  await db`insert into view_as_sessions(session_id,mode) values(${session},'role')`;
  for (const execute of [
    (tx: typeof db) => tx`select notification_delivery_settings_save(${W},${tx.json(policy)},0)`,
    (tx: typeof db) => tx`select save_notification_delivery_consent(${W},true,'+5548999990001',0)`,
    (tx: typeof db) =>
      tx`select notification_delivery_profile_phone(${W},'+5548999990002','+5548999990001')`,
  ])
    await expect(
      withRole("authenticated", U, (tx) => execute(tx as unknown as typeof db), {
        session_id: session,
      }),
    ).rejects.toMatchObject({ code: "42501" });
});
it("queues external email independently of disabled in-app preferences and keeps neutral payload", async () => {
  await save();
  await db`update profiles set notification_preferences='{"workflow":{"inapp":false,"email":true}}' where id=${U}`;
  expect(await enqueue({ channels: ["inapp", "email"], fallback: "none" })).toMatchObject({
    sent: 0,
    queued: 1,
  });
  const i = (await db`select * from notification_delivery_intents`)[0];
  expect(i.notification_id).toBeNull();
  expect(JSON.stringify(i.payload_content_neutral)).not.toContain("Private source snapshot");
  expect(await claim((await job()).id)).toMatchObject({
    result: "claimed",
    email: expect.stringContaining("@fixture.invalid"),
    recipientId: U,
  });
});
it("creates real in-app history only when a central notification exists", async () => {
  await save();
  expect(await enqueue({ channels: ["inapp", "email"], fallback: "none" })).toMatchObject({
    sent: 1,
    queued: 1,
  });
  const h = await history();
  expect(h.items.map((x: { channel: string }) => x.channel).sort()).toEqual(["email", "inapp"]);
  const central = required(h.items.find((x: { channel: string }) => x.channel === "inapp"));
  expect(central.status).toBe("available");
  await db`update notifications set read_at=now() where id=${central.id}`;
  expect((await history(U, "own", "inapp")).items[0].status).toBe("read");
});
it("deduplicates workflow occurrences and serializes concurrent delivery claims", async () => {
  const d = await readyEmail();
  expect(await enqueue()).toMatchObject({ queued: 0, duplicate: 1 });
  expect(await listJobs()).toHaveLength(1);
  const claims = await Promise.all([claim(d.id), claim(d.id)]);
  expect(claims.map((x) => x.result).sort()).toEqual(["claimed", "in_flight"]);
  const c = required(claims.find((x) => x.result === "claimed"));
  expect(c.idempotencyKey).toMatch(/^nfd:/);
  expect((await preflight(d.id, c.token)).allowed).toBe(true);
});
it("rejects invalid channel fallback combinations and mixed occurrence revisions", async () => {
  for (const config of [
    { channels: ["email", "email"], fallback: "none" },
    { channels: ["email", "whatsapp"], fallback: "email" },
    { channels: ["email"], fallback: "email" },
    { channels: [], fallback: "none" },
    { channels: ["slack"], fallback: "none" },
  ])
    await expect(enqueue(config)).rejects.toMatchObject({ code: "22023" });
  await readyEmail();
  await expect(enqueue({ channels: ["inapp", "email"], fallback: "none" })).rejects.toMatchObject({
    code: "22023",
  });
});
it("revalidates recipient source access at enqueue claim and preflight", async () => {
  await save();
  await db`update job_role_permission_overrides set effect='deny' where role_id=${ROLE} and permission_key='techsales.deals.view.workspace'`;
  expect(await enqueue()).toMatchObject({ queued: 0, excluded: 1 });
  await db`update job_role_permission_overrides set effect='grant' where role_id=${ROLE} and permission_key='techsales.deals.view.workspace'`;
  await enqueue();
  const d = await job();
  const c = await claim(d.id);
  await db`update job_role_permission_overrides set effect='deny' where role_id=${ROLE} and permission_key='techsales.deals.view.workspace'`;
  expect(await preflight(d.id, c.token)).toMatchObject({
    allowed: false,
    result: "suppressed",
    reason: "recipient_unavailable",
  });
  expect((await listJobs())[0].status).toBe("suppressed");
  expect(await finish(d.id, c.token)).toEqual({ updated: false });
});
it("revalidates executor source and transport permissions without leaking to recipients", async () => {
  await db`update workflows set execution_user_id=${C} where id=${WF}`;
  await save();
  await enqueue();
  const d = await job();
  const c = await claim(d.id);
  expect(c.result).toBe("claimed");
  await db`update job_role_permission_overrides set effect='deny' where role_id=${ROLE} and permission_key='techsales.inbox.email.create.workspace'`;
  expect(await preflight(d.id, c.token)).toMatchObject({
    allowed: false,
    reason: "executor_transport_forbidden",
  });
  await expect(enqueue(undefined, U, "1")).rejects.toMatchObject({ code: "42501" });
});
it("allows finished workflow runs but suppresses changed versions inactive recipients and tests", async () => {
  const d = await readyEmail();
  await db`update workflow_runs set status='completed' where id=${RUN}`;
  expect((await claim(d.id)).result).toBe("claimed");
  await db`update workspace_members set status='inactive' where workspace_id=${W} and user_id=${U}`;
  const c = (await db`select lease_token from workflow_deliveries where id=${d.id}`)[0];
  expect(await preflight(d.id, c.lease_token)).toMatchObject({
    allowed: false,
    reason: "recipient_unavailable",
  });
});
it("fences wrong expired and superseded lease tokens without resending unknown attempts", async () => {
  const d = await readyEmail();
  const c = await claim(d.id);
  expect(await finish(d.id, randomUUID())).toEqual({ updated: false });
  expect((await preflight(d.id, randomUUID())).allowed).toBe(false);
  expect((await db`select status from workflow_deliveries where id=${d.id}`)[0].status).toBe(
    "in_flight",
  );
  await db`update workflow_deliveries set lease_until=now()-interval '1 second' where id=${d.id}`;
  expect(await claim(d.id)).toMatchObject({ result: "uncertain", reason: "lease_expired" });
  expect(await finish(d.id, c.token)).toEqual({ updated: false });
  expect((await claim(d.id)).result).toBe("already_done");
});
it("schedules only known non-accepted retries with bounded attempts and fresh fencing", async () => {
  const d = await readyEmail();
  let c = await claim(d.id);
  await expect(
    finish(d.id, c.token, "retry_scheduled", "managed_email", null, "transport_unknown"),
  ).rejects.toMatchObject({ code: "22023" });
  for (let attempt = 1; attempt <= 4; attempt++) {
    expect(
      await finish(
        d.id,
        c.token,
        "retry_scheduled",
        "managed_email",
        null,
        "provider_rate_limited",
      ),
    ).toEqual({ updated: true });
    if (attempt < 4) {
      expect((await claim(d.id)).result).toBe("deferred");
      await db`update workflow_deliveries set next_attempt_at=now()-interval '1 second' where id=${d.id}`;
      const previous = c.token;
      c = await claim(d.id);
      expect(c.result).toBe("claimed");
      expect(c.token).not.toBe(previous);
      expect(await finish(d.id, previous)).toEqual({ updated: false });
    }
  }
  expect((await listJobs())[0].status).toBe("failed");
});
it("serializes concurrent quota reservations and counts accepted delivered and read states", async () => {
  await save({ ...policy, email_daily_limit: 1 });
  await enqueue();
  await enqueue(undefined, C, "1");
  const ds = await listJobs();
  const cs = await Promise.all(ds.map((d) => claim(d.id)));
  expect(cs.filter((x) => x.result === "claimed")).toHaveLength(1);
  expect(cs.find((x) => x.result === "deferred").reason).toBe("quota_exceeded");
  const c = required(cs.find((x) => x.result === "claimed"));
  await finish(c.id, c.token);
  expect((await db`select status from workflow_deliveries where id=${c.id}`)[0].status).toBe(
    "accepted",
  );
  for (const state of ["delivered", "read"]) {
    await db`update workflow_deliveries set status=${state} where id=${c.id}`;
    const pending = required(ds.find((d) => d.id !== c.id));
    await db`update workflow_deliveries set next_attempt_at=now() where id=${pending.id}`;
    expect(await claim(pending.id)).toMatchObject({ result: "deferred", reason: "quota_exceeded" });
  }
});
it("requires confirmed auth email and honors per-event preference overrides", async () => {
  const d = await readyEmail();
  await db`update auth.users set email_confirmed_at=null where id=${U}`;
  expect(await claim(d.id)).toMatchObject({ result: "suppressed", reason: "email_unconfirmed" });
  await enqueue(undefined, C, "1");
  await db`update profiles set notification_preferences='{"workflow":{"email":false}}' where id=${C}`;
  expect(await claim(required((await listJobs()).find((x) => x.id !== d.id)).id)).toMatchObject({
    reason: "preferences_disabled",
  });
});
it("applies per-workspace category and event preferences with event precedence", async () => {
  const d = await readyEmail();
  await addPrefs({
    categories: { workflow: { email: true } },
    eventOverrides: { "legacy.workflow": { email: false } },
  });
  expect(await claim(d.id)).toMatchObject({ result: "suppressed", reason: "preferences_disabled" });
});
it("defers actual deliveries during silence and handles midnight and DST boundaries", async () => {
  const d = await readyEmail();
  await addPrefs({ quiet: { enabled: true, timezone: "UTC", start: "00:00", end: "23:59" } });
  await db`update notification_user_preferences set settings=jsonb_set(jsonb_set(settings,'{quiet,start}',to_jsonb(to_char(now()-interval '1 minute','HH24:MI'))),'{quiet,end}',to_jsonb(to_char(now()+interval '10 minutes','HH24:MI'))) where workspace_id=${W} and user_id=${U}`;
  expect(await claim(d.id)).toMatchObject({ result: "deferred", reason: "quiet_hours" });
  expect((await db`select attempts from workflow_deliveries where id=${d.id}`)[0].attempts).toBe(0);
  await addPrefs({
    quiet: { enabled: true, timezone: "America/New_York", start: "01:00", end: "02:00" },
  });
  const dst = (
    await db`select techerp_api.notification_quiet_until(${W},${U},'2026-11-01T05:30:00Z')::text t`
  )[0].t;
  expect(new Date(dst).toISOString()).toBe("2026-11-01T07:00:00.000Z");
  await addPrefs({
    quiet: { enabled: true, timezone: "America/Sao_Paulo", start: "22:00", end: "08:00" },
  });
  const midnight = (
    await db`select techerp_api.notification_quiet_until(${W},${U},'2026-11-20T02:30:00Z')::text t`
  )[0].t;
  expect(new Date(midnight).toISOString()).toBe("2026-11-20T11:00:00.000Z");
});
it("requires consent configured official sender and positive financial allowance", async () => {
  await save(waPolicy);
  await enqueue({ channels: ["whatsapp"], fallback: "none" });
  const d = await job();
  expect(await claim(d.id)).toMatchObject({ result: "suppressed", reason: "consent_missing" });
  await consent();
  await enqueue({ channels: ["whatsapp"], fallback: "none" }, U, "1");
  const next = required((await listJobs()).find((x) => x.id !== d.id));
  const c = await claim(next.id);
  expect(c).toMatchObject({
    result: "claimed",
    phone: "+5548999990001",
    senderPhoneNumberId: "123456789",
    templateName: "techerp_update",
    templateLanguage: "pt_BR",
  });
  expect(await preflight(next.id, c.token)).toMatchObject({ allowed: true });
});
it("invalidates consent and destination changes before sending without fallback", async () => {
  const d = await readyWA("email");
  const c = await claim(d.id);
  await consent(false, "", 1);
  expect(await preflight(d.id, c.token)).toMatchObject({
    allowed: false,
    reason: "consent_revoked",
  });
  expect(await listJobs()).toHaveLength(1);
});
it("invalidates a changed profile number and reconsented policy snapshot rather than rerouting", async () => {
  const d = await readyWA("email");
  const c = await claim(d.id);
  await phone("+5548999990002");
  await consent(true, "+5548999990002", 2);
  expect(await preflight(d.id, c.token)).toMatchObject({
    allowed: false,
    reason: "endpoint_changed",
  });
  expect(await listJobs()).toHaveLength(1);
});
it("blocks unavailable low-quality senders and honors workspace WhatsApp suppressions", async () => {
  const d = await readyWA();
  await db`update wa_cloud_numbers set quality_rating='RED' where phone_number_id='123456789'`;
  expect(await claim(d.id)).toMatchObject({ result: "suppressed", reason: "sender_unavailable" });
  await db`update wa_cloud_numbers set quality_rating='GREEN' where phone_number_id='123456789'`;
  await enqueue({ channels: ["whatsapp"], fallback: "none" }, U, "1");
  const next = required((await listJobs()).find((x) => x.id !== d.id));
  await db`insert into whatsapp_number_suppressions(workspace_id,phone_key,expires_at) values(${W},public.wa_phone_key('+5548999990001'),now()+interval '1 day')`;
  expect(await claim(next.id)).toMatchObject({
    result: "suppressed",
    reason: "recipient_suppressed",
  });
});
it("reserves WhatsApp budget atomically and never exceeds it across concurrent claims", async () => {
  await save({ ...waPolicy, wa_daily_budget_micros: 1000 });
  await consent();
  await consent(true, "+5548999990001", 0, C);
  await enqueue({ channels: ["whatsapp"], fallback: "none" });
  await enqueue({ channels: ["whatsapp"], fallback: "none" }, C, "1");
  const cs = await Promise.all((await listJobs()).map((x) => claim(x.id)));
  expect(cs.filter((x) => x.result === "claimed")).toHaveLength(1);
  expect(cs.find((x) => x.result === "deferred").reason).toBe("budget_exceeded");
});
it("creates at most one explicit fallback email after known WhatsApp technical failure", async () => {
  const d = await readyWA("email");
  const c = await claim(d.id);
  expect(await finish(d.id, c.token, "failed", "meta_cloud", null, "provider_rejected")).toEqual({
    updated: true,
  });
  expect((await listJobs()).map((x) => x.channel)).toEqual(["email", "whatsapp"]);
  expect(await finish(d.id, c.token, "failed", "meta_cloud", null, "provider_rejected")).toEqual({
    updated: false,
  });
  const email = required((await listJobs()).find((x) => x.channel === "email"));
  expect((await claim(email.id)).result).toBe("claimed");
});
it("does not fallback after unknown or accepted WhatsApp transmission", async () => {
  const d = await readyWA("email");
  const c = await claim(d.id);
  expect(await finish(d.id, c.token, "uncertain", "meta_cloud", null, "transport_unknown")).toEqual(
    { updated: true },
  );
  expect(await listJobs()).toHaveLength(1);
  await enqueue({ channels: ["whatsapp"], fallback: "email" }, U, "1");
  const next = required((await listJobs()).find((x) => x.id !== d.id));
  const c2 = await claim(next.id);
  expect(await finish(next.id, c2.token, "accepted", "meta_cloud", "wamid.fixture")).toEqual({
    updated: true,
  });
  expect(await listJobs()).toHaveLength(2);
  await expect(finish(next.id, c2.token, "accepted", "meta_cloud", null)).resolves.toEqual({
    updated: false,
  });
});
it("revalidates fallback email preferences and never fabricates delivered email receipts", async () => {
  const d = await readyWA("email");
  const c = await claim(d.id);
  await finish(d.id, c.token, "failed", "meta_cloud", null, "provider_rejected");
  const e = required((await listJobs()).find((x) => x.channel === "email"));
  await db`update profiles set notification_preferences='{"workflow":{"email":false}}' where id=${U}`;
  expect(await claim(e.id)).toMatchObject({ result: "suppressed", reason: "preferences_disabled" });
});
it("keeps private state inaccessible through real JWT APIs and rejects forged tokens", async () => {
  await readyEmail();
  for (const table of [
    "notification_delivery_intents",
    "notification_delivery_consents",
    "notification_delivery_policies",
  ])
    expect((await request("/" + table + "?select=*")).status).toBe(403);
  for (const rpc of [
    "notification_worker_list",
    "notification_delivery_claim",
    "notification_delivery_preflight",
  ]) {
    const params =
      rpc === "notification_worker_list"
        ? { p_limit: 1 }
        : rpc === "notification_delivery_claim"
          ? { p_id: (await job()).id }
          : { p_id: (await job()).id, p_token: randomUUID() };
    expect((await request("/rpc/" + rpc, params)).status).toBe(403);
  }
  expect((await request("/workflow_deliveries?select=lease_token,endpoint_hash")).status).toBe(403);
  expect(
    (
      await request(
        "/rpc/notification_delivery_capabilities",
        { p_workspace: W },
        U,
        fixtureJwt("authenticated", U, "not-the-fixture-secret"),
      )
    ).status,
  ).toBe(401);
  expect(
    (
      await request(
        "/rpc/notification_worker_list",
        { p_limit: 1 },
        U,
        fixtureJwt("service_role", U),
      )
    ).status,
  ).toBe(403);
});
it("filters real delivery history by self workspace permission and current source visibility", async () => {
  await save();
  await enqueue();
  await enqueue(undefined, C, "1");
  expect((await history()).items).toHaveLength(1);
  expect((await history(U, "workspace")).items).toHaveLength(2);
  await db`delete from job_role_permission_overrides where role_id=${ROLE} and permission_key='system.notification_deliveries.view.workspace'`;
  expect((await history()).items).toHaveLength(1);
  await expect(history(U, "workspace")).rejects.toMatchObject({ code: "42501" });
  await db`update job_role_permission_overrides set effect='deny' where role_id=${ROLE} and permission_key='techsales.deals.view.workspace'`;
  expect((await history()).items).toHaveLength(0);
  const raw = await request("/workflow_deliveries?select=id,status,reason_code,recipient");
  expect(raw).toMatchObject({ status: 200, payload: [] });
});
it("lists real workflow notification rules including nested drafts without creating another rule engine", async () => {
  await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${W},${ROLE},'system.workflows.view.workspace','grant') on conflict(workspace_id,role_id,permission_key) do update set effect='grant'`;
  await db`update workflows set draft_actions='[{"type":"condition","then":[{"type":"send_notification","title":"Draft"}]}]' where id=${WF}`;
  const r = await withRole(
    "authenticated",
    U,
    async (tx) => (await tx`select notification_delivery_rules(${W}) r`)[0].r,
  );
  expect(r.items).toHaveLength(1);
  expect(r.items[0]).toMatchObject({ id: WF, enabled: true });
  await db`update job_role_permission_overrides set effect='deny' where role_id=${ROLE} and permission_key='system.workflows.view.workspace'`;
  const denied = await withRole(
    "authenticated",
    U,
    async (tx) => (await tx`select notification_delivery_rules(${W}) r`)[0].r,
  );
  expect(denied.items).toHaveLength(0);
});

it("counts old backlog by the new reservation instant without charging retries twice", async () => {
  await save({ ...policy, email_daily_limit: 1 });
  await enqueue();
  const first = await job();
  await db`update workflow_deliveries set created_at=now()-interval '3 days' where id=${first.id}`;
  const c = await claim(first.id);
  expect(c.result).toBe("claimed");
  await finish(first.id, c.token);
  await enqueue(undefined, C, "1");
  const pending = required((await listJobs()).find((x) => x.id !== first.id));
  expect(await claim(pending.id)).toMatchObject({ result: "deferred", reason: "quota_exceeded" });
  expect(
    (
      await db`select notification_reserved_at>now()-interval '1 minute' as fresh from workflow_deliveries where id=${first.id}`
    )[0].fresh,
  ).toBe(true);
});
it("protects new delivery jobs from the legacy unfenced claim and finish APIs", async () => {
  const d = await readyEmail();
  const original = (await db`select idempotency_key from workflow_deliveries where id=${d.id}`)[0];
  const old = await withRole(
    "service_role",
    null,
    async (tx) =>
      (
        await tx`select workflow_delivery_claim(${W},${WF},${original.idempotency_key},'email','0','user:fixture') r`
      )[0].r,
  );
  expect(old.result).toBe("forbidden");
  await withRole(
    "service_role",
    null,
    (tx) =>
      tx`select workflow_delivery_finish(${original.idempotency_key},'sent','fixture','fake',null,null)`,
  );
  expect((await listJobs())[0].status).toBe("queued");
  const legacy = await withRole(
    "service_role",
    null,
    async (tx) =>
      (
        await tx`select workflow_delivery_claim(${W},${WF},'fixture-legacy','email','0','fixture@example.invalid') r`
      )[0].r,
  );
  expect(legacy.result).toBe("claimed");
});
const receipt = async (
  delivery: { id: string; idempotencyKey: string; token: string },
  status = "delivered",
  overrides: Record<string, unknown> = {},
) => {
  const mid = randomUUID(),
    conversation = randomUUID();
  await db`insert into whatsapp_conversations(id,workspace_id,owner_id,assigned_to,wa_phone_number_id) values(${conversation},${W},${A},${U},'123456789')`;
  const r = {
    ws: W,
    from: "+554861360001",
    to: "+5548999990001",
    providerId: "wamid.fixture",
    key: delivery.idempotencyKey,
    token: delivery.token,
    ...overrides,
  };
  await db`insert into whatsapp_messages(id,workspace_id,conversation_id,direction,provider,from_number,to_number,wa_message_id,status,raw) values(${mid},${String(r.ws)},${conversation},'outbound','meta',${String(r.from)},${String(r.to)},${String(r.providerId)},'queued',${db.json({ source: { notification_delivery_id: delivery.id, idempotency_key: r.key, attempt_token: r.token } })})`;
  await withRole(
    "service_role",
    null,
    (tx) => tx`update whatsapp_messages set status=${status} where id=${mid}`,
  );
  return mid;
};
it("accepts authenticated matching WhatsApp receipts monotonically and acknowledges the receipt-before-finish race", async () => {
  const d = await readyWA();
  const c = await claim(d.id);
  const message = await receipt(c, "read");
  expect((await listJobs())[0].status).toBe("read");
  expect(await finish(d.id, c.token, "accepted", "meta_cloud", "wamid.fixture")).toEqual({
    updated: true,
  });
  expect((await listJobs())[0].status).toBe("read");
  await withRole(
    "service_role",
    null,
    (tx) => tx`update whatsapp_messages set status='delivered' where id=${message}`,
  );
  expect((await listJobs())[0].status).toBe("read");
  await withRole(
    "service_role",
    null,
    (tx) => tx`update whatsapp_messages set status='failed' where id=${message}`,
  );
  expect((await listJobs())[0].status).toBe("read");
  expect(await finish(d.id, randomUUID(), "accepted", "meta_cloud", "wamid.fixture")).toEqual({
    updated: false,
  });
  expect(await finish(d.id, c.token, "accepted", "meta_cloud", "different-id")).toEqual({
    updated: false,
  });
});
it("ignores forged workspace sender destination correlation and provider receipt identifiers", async () => {
  const d = await readyWA();
  const c = await claim(d.id);
  await finish(d.id, c.token, "accepted", "meta_cloud", "wamid.fixture");
  for (const forged of [
    { ws: B },
    { from: "+5548111111111" },
    { to: "+5548222222222" },
    { key: "wrong-key" },
    { token: randomUUID() },
    { providerId: "wrong-provider-id" },
  ]) {
    await receipt(c, "read", forged);
    expect((await listJobs())[0].status).toBe("accepted");
  }
  await receipt(c, "delivered");
  expect((await listJobs())[0].status).toBe("delivered");
});
it("never accepts a receipt forged through an authenticated non-service session", async () => {
  const d = await readyWA();
  const c = await claim(d.id);
  const mid = await receipt(c, "queued");
  await db`update whatsapp_messages set status='read' where id=${mid}`;
  expect((await listJobs())[0].status).toBe("in_flight");
  const response = await request("/whatsapp_messages?select=id");
  expect(response.status).toBe(403);
});
it("invalidates changed policy template and active sender before the provider POST", async () => {
  const d = await readyWA();
  const c = await claim(d.id);
  await save({ ...waPolicy, wa_template_name: "another_template" }, 1);
  expect(await preflight(d.id, c.token)).toMatchObject({
    allowed: false,
    reason: "endpoint_changed",
  });
  await enqueue({ channels: ["whatsapp"], fallback: "none" }, U, "1");
  const next = required((await listJobs()).find((x) => x.id !== d.id));
  const nextClaim = await claim(next.id);
  await db`update wa_cloud_connections set enabled=false where id=${X}`;
  expect(await preflight(next.id, nextClaim.token)).toMatchObject({
    allowed: false,
    reason: "sender_unavailable",
  });
});
it("validates settings permissions and source boundaries through real HTTP JWT sessions", async () => {
  expect((await request("/rpc/notification_delivery_settings", { p_workspace: W })).status).toBe(
    200,
  );
  await db`delete from job_role_permission_overrides where role_id=${ROLE} and permission_key='system.notification_settings.view.workspace'`;
  expect((await request("/rpc/notification_delivery_settings", { p_workspace: W })).status).toBe(
    403,
  );
  await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${W},${ROLE},'system.notification_settings.view.workspace','deny')`;
  expect((await request("/rpc/notification_delivery_settings", { p_workspace: W })).status).toBe(
    403,
  );
  expect(
    (await request("/rpc/notification_delivery_capabilities", { p_workspace: W }, F)).status,
  ).toBe(403);
  await db`update workspace_members set status='inactive' where workspace_id=${W} and user_id=${U}`;
  expect(
    (await request("/rpc/notification_delivery_capabilities", { p_workspace: W })).status,
  ).toBe(403);
});
it("hides destinations tokens snapshots raw errors and provider content from history", async () => {
  const d = await readyEmail();
  const c = await claim(d.id);
  await finish(d.id, c.token);
  const response = await request("/rpc/notification_delivery_history", { p_workspace: W });
  expect(response.status).toBe(200);
  const body = JSON.stringify(response.payload);
  for (const forbidden of [
    "@fixture.invalid",
    "+5548",
    "lease_token",
    "endpoint_hash",
    "Private source snapshot",
    "Fixture notice",
  ])
    expect(body).not.toContain(forbidden);
  expect(response.payload.items[0]).toMatchObject({
    channel: "email",
    status: "accepted",
    attempts: 1,
    provider_id: null,
  });
});

it("respects an additional restrictive source policy on claim and personal history", async () => {
  const d = await readyEmail();
  const blocked = await withRole("service_role", null, async (tx) => {
    await tx`select set_config('test.notification_hidden',${X},true)`;
    return (await tx`select notification_delivery_claim(${d.id}) r`)[0].r;
  });
  expect(blocked).toMatchObject({ result: "suppressed", reason: "recipient_unavailable" });
  const hidden = await withRole("authenticated", U, async (tx) => {
    await tx`select set_config('test.notification_hidden',${X},true)`;
    return (await tx`select notification_delivery_history(${W}) r`)[0].r;
  });
  expect(hidden.items).toHaveLength(0);
});
it("suppresses a disabled workspace channel during preflight and invalidates its lease", async () => {
  const d = await readyEmail();
  const c = await claim(d.id);
  await save({ ...policy, email_enabled: false }, 1);
  expect(await preflight(d.id, c.token)).toMatchObject({
    allowed: false,
    result: "suppressed",
    reason: "policy_disabled",
  });
  expect(await finish(d.id, c.token)).toEqual({ updated: false });
});
it("paginates history without duplicates and validates filters and cursor input", async () => {
  await db`insert into notification_delivery_intents(workspace_id,workflow_id,run_id,workflow_version,step_path,source_table,source_id,recipient_user_id,delivery_config,payload_content_neutral)
 select ${W},${WF},${RUN},1,'page-'||n,'deals',${X},${U},'{"channels":["email"],"fallback":"none"}','{}' from generate_series(1,53)n`;
  await db`insert into workflow_deliveries(workspace_id,workflow_id,idempotency_key,step_path,channel,recipient,status,attempts,next_attempt_at,notification_intent_id)
 select workspace_id,workflow_id,'nfd:'||id||':email',step_path,'email','user:'||recipient_user_id,'queued',0,now(),id from notification_delivery_intents`;
  const first = await history();
  expect(first.items).toHaveLength(50);
  expect(first.nextCursor).not.toBeNull();
  const second = await history(U, "own", null, first.nextCursor);
  expect(second.items).toHaveLength(3);
  expect(second.nextCursor).toBeNull();
  expect(new Set([...first.items, ...second.items].map((x) => x.id)).size).toBe(53);
  await expect(history(U, "own", null, { id: "bad", createdAt: "bad" })).rejects.toMatchObject({
    code: "22023",
  });
  expect((await history(U, "own", "slack")).items).toEqual([]);
});
it("filters notification workflow rules before the display limit and never exposes another workspace", async () => {
  await db`insert into workflows(id,workspace_id,owner_id,execution_user_id,entity,name,updated_at) select gen_random_uuid(),${W},${A},${A},'deals','Unrelated workflow',now()+interval '1 day' from generate_series(1,110)`;
  await db`update workflows set actions='[{"type":"send_notification","title":"Central"}]' where id=${WF}`;
  await db`insert into workflows(id,workspace_id,owner_id,execution_user_id,entity,actions) values(gen_random_uuid(),${B},${A},${A},'deals','[{"type":"send_notification"}]')`;
  const r = await withRole(
    "authenticated",
    U,
    async (tx) => (await tx`select notification_delivery_rules(${W}) r`)[0].r,
  );
  expect(r.items.map((x: { id: string }) => x.id)).toEqual([WF]);
  expect(r.truncated).toBe(false);
});
it("counts a new backlog reservation in the legacy quota without changing legacy row timing", async () => {
  const d = await readyEmail();
  await db`update workflow_deliveries set created_at=now()-interval '3 days' where id=${d.id}`;
  const c = await claim(d.id);
  await finish(d.id, c.token);
  await db`insert into workflow_send_policies(workspace_id,email_daily_limit) values(${W},1)`;
  const old = await withRole(
    "service_role",
    null,
    async (tx) =>
      (
        await tx`select workflow_delivery_claim(${W},${WF},'legacy-after-backlog','email','step','fixture@example.invalid') r`
      )[0].r,
  );
  expect(old.result).toBe("quota");
});

it("requires WhatsApp administration for raw quota cost budget disabling and currency changes", async () => {
  await save(waPolicy);
  await db`update job_role_permission_overrides set effect='deny' where role_id=${ROLE} and permission_key='system.whatsapp.manage.workspace'`;
  for (const patch of [
    { whatsapp_daily_limit: 20 },
    { wa_estimated_unit_micros: 2000 },
    { wa_daily_budget_micros: 20000 },
    { whatsapp_enabled: false },
    { currency: "USD" },
  ])
    await expect(save({ ...waPolicy, ...patch }, 1)).rejects.toMatchObject({ code: "42501" });
  expect((await save({ ...waPolicy, email_daily_limit: 20 }, 1)).revision).toBe(2);
});
it("binds late WhatsApp receipts to the exact attempt token while preserving uncertainty", async () => {
  const d = await readyWA("email");
  let c = await claim(d.id);
  const old = c;
  await finish(d.id, c.token, "retry_scheduled", "meta_cloud", null, "provider_rate_limited");
  await db`update workflow_deliveries set next_attempt_at=now() where id=${d.id}`;
  c = await claim(d.id);
  expect(c.token).not.toBe(old.token);
  await receipt(old, "read");
  expect((await listJobs())[0].status).toBe("in_flight");
  await db`update workflow_deliveries set lease_until=now()-interval '1 second' where id=${d.id}`;
  expect((await claim(d.id)).result).toBe("uncertain");
  await receipt({ ...c, token: randomUUID() }, "delivered");
  expect((await listJobs())[0].status).toBe("uncertain");
  await receipt(c, "delivered");
  expect((await listJobs())[0].status).toBe("delivered");
  expect(await listJobs()).toHaveLength(1);
  expect(await finish(d.id, c.token, "accepted", "meta_cloud", "wamid.fixture")).toEqual({
    updated: false,
  });
});
