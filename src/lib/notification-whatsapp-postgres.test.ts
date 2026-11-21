import { PostgrestClient } from "@supabase/postgrest-js";
const cloudTest = vi.hoisted(() => ({ admin: null as any, inbound: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    return cloudTest.admin;
  },
}));
vi.mock("@/lib/ai/provider-resolver.server", () => ({
  decryptApiKey: async () =>
    JSON.stringify({ appSecret: "synthetic-p7-secret", verifyToken: "synthetic-verify" }),
}));
vi.mock("@/lib/whatsapp/meta-channel.server", () => ({
  normalizePhone: (phone: string) => phone.replace(/\D/g, ""),
}));
vi.mock("@/lib/prospecting/sdr/ingest.server", () => ({ ingestInboundForSdr: cloudTest.inbound }));
vi.mock("@/lib/inbox/identity-resolution.server", () => ({
  identityColumns: () => ({}),
  resolveInboxIdentity: vi.fn(),
}));
vi.mock("@/lib/inbox-auto-assignment.server", () => ({ autoAssignInboxConversation: vi.fn() }));
vi.mock("./whatsapp/inbound-media.server", () => ({ storeInboundMedia: vi.fn() }));
import { handleCloudWebhook } from "./whatsapp/cloud-webhook.server";
import { processEvent } from "./whatsapp/webhook-processor.server";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  RUN,
  reset,
  withRole,
  request,
  fixtureJwt,
  fixtureHttpBase,
} from "../../tests/fixtures/notification-deliveries";

beforeEach(reset);
const sender = "123456789";
const recipient = "+5548999990001";
const policy = {
  email_enabled: true,
  whatsapp_enabled: true,
  email_daily_limit: 10,
  whatsapp_daily_limit: 10,
  wa_sender_id: sender,
  wa_template_name: "techerp_update",
  wa_template_language: "pt_BR",
  wa_estimated_unit_micros: 1000,
  wa_daily_budget_micros: 10000,
  currency: "BRL",
};
const settings = (actor = U, workspace = W) =>
  request("/rpc/notification_delivery_settings", { p_workspace: workspace }, actor);
const save = () =>
  withRole(
    "authenticated",
    U,
    async (tx) =>
      (await tx`select notification_delivery_settings_save(${W},${tx.json(policy)},0) r`)[0].r,
  );
const consent = (revision = 0, workspace = W) =>
  withRole(
    "authenticated",
    U,
    async (tx) =>
      (
        await tx`select save_notification_delivery_consent(${workspace},true,${recipient},${revision}) r`
      )[0].r,
  );
const jobs = () =>
  db`select id,channel,status,reason_code,attempts,notification_connection_id,lease_token,notification_attempt_token,provider_id,notification_reserved_at from workflow_deliveries where notification_intent_id is not null order by created_at,id`;
const enqueue = (step = "0", fallback = "email") =>
  withRole(
    "service_role",
    null,
    async (tx) =>
      (
        await tx`select notification_workflow_dispatch_v2(${WF},${RUN},1,'deals',${X},${tx.json([{ kind: "user", id: U }])},'Fixture notice',null,${step},${tx.json({ channels: ["whatsapp"], fallback })}) r`
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
const finish = (
  id: string,
  token: string,
  status = "accepted",
  providerId: string | null = "wamid.p7",
  reason: string | null = null,
  retryAfterSeconds: number | null = status === "retry_scheduled" ? 120 : null,
) =>
  withRole(
    "service_role",
    null,
    async (tx) =>
      (
        await tx`select notification_delivery_finish(${id},${token},${status},'meta_cloud',${providerId},${reason},${retryAfterSeconds}) r`
      )[0].r,
  );
type ReceiptInput = {
  workspace: string;
  connection: string;
  sender: string;
  wamid: string;
  recipient: string;
  status: string;
  errorCode: string | null;
};
const receipt = (patch: Partial<ReceiptInput> = {}) => {
  const input = {
    workspace: W,
    connection: X,
    sender,
    wamid: "wamid.p7",
    recipient,
    status: "delivered",
    errorCode: null,
    ...patch,
  };
  return withRole(
    "service_role",
    null,
    async (tx) =>
      (
        await tx`select notification_whatsapp_receipt(${input.workspace},${input.connection},${input.sender},${input.wamid},${input.recipient},${input.status},${input.errorCode}) r`
      )[0].r,
  );
};
const ready = async () => {
  await save();
  await consent();
  await enqueue();
  return claim((await jobs())[0].id);
};

it("WhatsApp guardrails allow authorized member", async () => {
  expect(await settings()).toMatchObject({
    status: 200,
    payload: { policy: { whatsapp_enabled: false } },
  });
  expect((await save()).revision).toBe(1);
  expect((await consent()).consent).toMatchObject({
    phone: recipient,
    revision: 1,
    revokedAt: null,
  });
});
it("WhatsApp guardrails reject missing permission", async () => {
  await db`delete from job_role_permission_overrides where role_id=${ROLE} and permission_key='system.notification_settings.view.workspace'`;
  expect(await settings()).toMatchObject({ status: 403, payload: { code: "42501" } });
  await expect(save()).rejects.toMatchObject({ code: "42501" });
});
it("WhatsApp guardrails reject explicit deny", async () => {
  await db`update job_role_permission_overrides set effect='deny' where role_id=${ROLE} and permission_key='system.notification_settings.manage.workspace'`;
  await expect(save()).rejects.toMatchObject({ code: "42501" });
  expect((await db`select count(*)::int n from notification_delivery_policies`)[0].n).toBe(0);
});
it("WhatsApp guardrails reject foreign workspace", async () => {
  expect(await settings(F)).toMatchObject({ status: 403, payload: { code: "42501" } });
  expect(await settings(U, B)).toMatchObject({ status: 403, payload: { code: "42501" } });
  await expect(consent(0, B)).rejects.toMatchObject({ code: "42501" });
});
it("WhatsApp guardrails reject inactive member", async () => {
  await db`update workspace_members set status='inactive' where workspace_id=${W} and user_id=${U}`;
  expect(await settings()).toMatchObject({ status: 403, payload: { code: "42501" } });
  await expect(consent()).rejects.toMatchObject({ code: "42501" });
});

it("revokes all personal WhatsApp consents after canonical phone changes and never restores old authorization", async () => {
  await consent();
  await db`insert into notification_delivery_consents(workspace_id,user_id,phone,granted_at,revision) values(${B},${U},${recipient},now(),1),(${W},${C},${recipient},now(),1)`;
  await db`update profiles set phone='+5548999990002' where id=${U}`;
  await db`update profiles set phone=${recipient} where id=${U}`;
  const own =
    await db`select revision,revoked_at from notification_delivery_consents where user_id=${U}`;
  expect(own).toHaveLength(2);
  expect(own.every((row) => row.revision === 3 && row.revoked_at)).toBe(true);
  expect(
    (
      await db`select revision,revoked_at from notification_delivery_consents where user_id=${C}`
    )[0],
  ).toMatchObject({ revision: 1, revoked_at: null });
  await expect(consent(1)).rejects.toMatchObject({ code: "PT409" });
  await db`update profiles set phone=${recipient} where id=${U}`;
  expect(
    (
      await db`select revision from notification_delivery_consents where user_id=${U} and workspace_id=${W}`
    )[0].revision,
  ).toBe(3);
  expect((await consent(3)).consent).toMatchObject({ revision: 4, revokedAt: null });
});
it("revokes consent across profile deletion and recreation and increments the personal phone RPC only once", async () => {
  await consent();
  const changed = await withRole(
    "authenticated",
    U,
    async (tx) =>
      (
        await tx`select notification_delivery_profile_phone(${W},'+5548999990002',${recipient}) r`
      )[0].r,
  );
  expect(changed).toEqual({ phone: "+5548999990002" });
  expect(
    (await db`select revision from notification_delivery_consents where user_id=${U}`)[0].revision,
  ).toBe(2);
  await db`delete from profiles where id=${U}`;
  expect(
    (await db`select count(*)::int n from notification_delivery_consents where user_id=${U}`)[0].n,
  ).toBe(0);
  await db`insert into profiles(id,active_workspace_id,phone,notification_preferences) values(${U},${W},${recipient},'{}')`;
  const own = await withRole(
    "authenticated",
    U,
    async (tx) => (await tx`select get_notification_delivery_consent(${W}) r`)[0].r,
  );
  expect(own).toEqual({ phone: recipient, consent: null });
});
it("pins the first WhatsApp connection and suppresses a different connection before retry or POST", async () => {
  const c = await ready();
  expect(c.connectionId).toBe(X);
  expect(await preflight(c.id, c.token)).toMatchObject({ allowed: true, connectionId: X });
  const other = randomUUID();
  await db`insert into wa_cloud_connections(id,workspace_id,enabled,webhook_verified_at) values(${other},${W},true,now())`;
  await db`update wa_cloud_numbers set connection_id=${other} where phone_number_id=${sender}`;
  expect(await preflight(c.id, c.token)).toMatchObject({
    allowed: false,
    result: "suppressed",
    reason: "endpoint_changed",
  });
  expect((await jobs())[0].notification_connection_id).toBe(X);
  expect(await jobs()).toHaveLength(1);
  await db`update wa_cloud_numbers set connection_id=${X} where phone_number_id=${sender}`;
  await enqueue("1");
  const d = (await jobs()).find((row) => row.id !== c.id)!;
  const next = await claim(d.id);
  await finish(d.id, next.token, "retry_scheduled", null, "provider_rate_limited");
  await db`update workflow_deliveries set next_attempt_at=now() where id=${d.id}`;
  await db`update wa_cloud_numbers set connection_id=${other} where phone_number_id=${sender}`;
  expect(await claim(d.id)).toMatchObject({ result: "suppressed", reason: "endpoint_changed" });
  expect(await jobs()).toHaveLength(2);
});
it("preserves uncertainty for historical unpinned attempts without inventing a connection or fallback", async () => {
  const c = await ready();
  await db`update workflow_deliveries set notification_connection_id=null where id=${c.id}`;
  expect(await preflight(c.id, randomUUID())).toMatchObject({ allowed: false });
  expect((await jobs())[0].status).toBe("in_flight");
  expect(await preflight(c.id, c.token)).toMatchObject({
    allowed: false,
    result: "uncertain",
    reason: "connection_unproven",
  });
  expect((await jobs())[0]).toMatchObject({
    status: "uncertain",
    notification_connection_id: null,
  });
  await enqueue("1");
  const second = (await jobs()).find((row) => row.id !== c.id)!;
  const retry = await claim(second.id);
  await finish(second.id, retry.token, "retry_scheduled", null, "provider_rate_limited");
  await db`update workflow_deliveries set next_attempt_at=now(),notification_connection_id=null where id=${second.id}`;
  expect(await claim(second.id)).toMatchObject({
    result: "uncertain",
    reason: "connection_unproven",
  });
  expect(await jobs()).toHaveLength(2);
});
it("acknowledges pinned WhatsApp receipts without an Inbox projection and preserves monotonic deduplication", async () => {
  const c = await ready();
  expect(await receipt()).toEqual({ matched: false, updated: false });
  expect(await finish(c.id, c.token)).toEqual({ updated: true });
  expect((await db`select count(*)::int n from whatsapp_messages`)[0].n).toBe(0);
  expect(await receipt()).toEqual({ matched: true, updated: true });
  expect(await receipt()).toEqual({ matched: true, updated: false });
  expect(await receipt({ status: "sent" })).toEqual({ matched: true, updated: false });
  expect(await receipt({ status: "read", recipient: recipient.slice(1) })).toEqual({
    matched: true,
    updated: true,
  });
  expect(await receipt({ status: "failed" })).toEqual({ matched: true, updated: false });
  expect((await jobs())[0]).toMatchObject({ status: "read", provider_id: "wamid.p7" });
  expect(await jobs()).toHaveLength(1);
});
it("rejects wrong WhatsApp receipt identities and keeps acknowledgement service-only", async () => {
  const c = await ready();
  await finish(c.id, c.token);
  for (const patch of [
    { workspace: B },
    { connection: randomUUID() },
    { sender: "987654321" },
    { wamid: "wamid.foreign" },
    { recipient: "+5548999990002" },
    { status: "received" },
  ])
    expect(await receipt(patch)).toEqual({ matched: false, updated: false });
  const body = {
    p_workspace: W,
    p_connection: X,
    p_sender: sender,
    p_wamid: "wamid.p7",
    p_recipient: recipient,
    p_status: "read",
  };
  expect((await request("/rpc/notification_whatsapp_receipt", body)).status).toBe(403);
  expect(
    (await request("/rpc/notification_whatsapp_receipt", body, U, fixtureJwt("service_role", U)))
      .status,
  ).toBe(403);
  await db`update workflow_deliveries set notification_attempt_token=null where id=${c.id}`;
  expect(await receipt()).toEqual({ matched: false, updated: false });
  expect((await jobs())[0].status).toBe("accepted");
});
it("accepts historical receipts after disablement revocation and lease loss without sending or fallback", async () => {
  const c = await ready();
  await finish(c.id, c.token);
  await db`update workflow_deliveries set status='uncertain',lease_token=null,lease_until=null where id=${c.id}`;
  await db`update wa_cloud_numbers set available=false,quality_rating='RED' where phone_number_id=${sender}`;
  await db`update wa_cloud_connections set enabled=false where id=${X}`;
  await db`update notification_delivery_policies set whatsapp_enabled=false where workspace_id=${W}`;
  await db`update profiles set phone='+5548999990002' where id=${U}`;
  await db`update workspace_members set status='inactive' where workspace_id=${W} and user_id=${U}`;
  const reservedAt = (await jobs())[0].notification_reserved_at;
  expect(await receipt()).toEqual({ matched: true, updated: true });
  expect((await jobs())[0]).toMatchObject({
    status: "delivered",
    notification_connection_id: X,
    notification_reserved_at: reservedAt,
  });
  expect(await jobs()).toHaveLength(1);
});
it("never falls back after WhatsApp rate or reputation refusal including exhausted retries", async () => {
  let c = await ready();
  for (let attempt = 1; attempt <= 4; attempt++) {
    expect(await finish(c.id, c.token, "retry_scheduled", null, "provider_rate_limited")).toEqual({
      updated: true,
    });
    if (attempt < 4) {
      await db`update workflow_deliveries set next_attempt_at=now() where id=${c.id}`;
      await db`update notification_whatsapp_health set paused_until=now()-interval '1 second' where connection_id=${X}`;
      c = await claim(c.id);
      expect(c.result).toBe("claimed");
    }
  }
  expect((await jobs())[0]).toMatchObject({
    status: "failed",
    reason_code: "provider_rate_limited",
    attempts: 4,
  });
  expect(await jobs()).toHaveLength(1);
  await db`update notification_whatsapp_health set paused_until=now()-interval '1 second' where connection_id=${X}`;
  await enqueue("1");
  const second = (await jobs()).find((row) => row.id !== c.id)!;
  const next = await claim(second.id);
  expect(await finish(next.id, randomUUID(), "failed", null, "provider_rate_limited")).toEqual({
    updated: false,
  });
  expect(await finish(next.id, next.token, "failed", null, "provider_rate_limited")).toEqual({
    updated: true,
  });
  expect((await jobs()).every((row) => row.channel === "whatsapp")).toBe(true);
  expect(await jobs()).toHaveLength(2);
});

it("never queues email fallback for cached low or unknown WhatsApp quality at claim and preflight", async () => {
  const first = await ready();
  await db`update wa_cloud_numbers set quality_rating='YELLOW' where phone_number_id=${sender}`;
  expect(await preflight(first.id, first.token)).toMatchObject({
    allowed: false,
    result: "suppressed",
    reason: "provider_rate_limited",
  });
  for (const [index, quality] of ["RED", "UNKNOWN", null].entries()) {
    await db`update wa_cloud_numbers set quality_rating=${quality} where phone_number_id=${sender}`;
    await enqueue(String(index + 1));
    const pending = (await jobs()).find((row) => row.status === "queued")!;
    expect(await claim(pending.id)).toMatchObject({
      result: "suppressed",
      reason: "provider_rate_limited",
    });
  }
  expect(await jobs()).toHaveLength(4);
  expect(
    (await jobs()).every(
      (row) => row.channel === "whatsapp" && row.reason_code === "provider_rate_limited",
    ),
  ).toBe(true);
});

async function cloudFixture() {
  cloudTest.admin = new PostgrestClient(fixtureHttpBase(), {
    headers: { Authorization: `Bearer ${fixtureJwt("service_role")}` },
  });
  await db`update wa_cloud_connections set credentials_ciphertext='synthetic-only',waba_id='829300001',api_version='v23.0' where id=${X}`;
  cloudTest.inbound.mockClear();
}
function signedStatus(status = "delivered", recipientId = recipient.slice(1), senderId = sender) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "829300001",
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: senderId },
              statuses: [
                { id: "wamid.p7", recipient_id: recipientId, status, timestamp: "1795190400" },
              ],
            },
          },
        ],
      },
    ],
  };
}
async function signedCloudRequest(payload: unknown, valid = true) {
  const body = JSON.stringify(payload);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("synthetic-p7-secret"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  const signature = Array.from(mac, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return new Request("https://fixture.test/cloud", {
    method: "POST",
    body,
    headers: { "x-hub-signature-256": `sha256=${valid ? signature : "0".repeat(64)}` },
  });
}
it("reconciles a genuinely signed Cloud webhook through the real processor and JWT ledger without Inbox projection", async () => {
  const c = await ready();
  await finish(c.id, c.token);
  await cloudFixture();
  expect((await handleCloudWebhook(await signedCloudRequest(signedStatus()), X)).status).toBe(200);
  expect((await jobs())[0]).toMatchObject({ status: "delivered", provider_id: "wamid.p7" });
  expect(
    (await db`select processed_at,workspace_id from whatsapp_webhook_events`)[0],
  ).toMatchObject({ processed_at: expect.any(Date), workspace_id: W });
  expect((await db`select count(*)::int n from whatsapp_messages`)[0].n).toBe(0);
  expect((await handleCloudWebhook(await signedCloudRequest(signedStatus("read")), X)).status).toBe(
    200,
  );
  expect((await handleCloudWebhook(await signedCloudRequest(signedStatus()), X)).status).toBe(200);
  expect((await jobs())[0].status).toBe("read");
  expect(await jobs()).toHaveLength(1);
  expect(cloudTest.inbound).not.toHaveBeenCalled();
});
it("queues an early signed receipt until acceptance binds the wamid then reconciles it without resending", async () => {
  const c = await ready();
  await cloudFixture();
  expect((await handleCloudWebhook(await signedCloudRequest(signedStatus()), X)).status).toBe(200);
  expect((await jobs())[0].status).toBe("in_flight");
  const event = (
    await db`select id,event,payload,attempts,processed_at from whatsapp_webhook_events`
  )[0];
  expect(event.processed_at).toBeNull();
  expect(event.attempts).toBe(1);
  await finish(c.id, c.token);
  expect(await processEvent(cloudTest.admin, event as any)).toBe(true);
  expect((await jobs())[0].status).toBe("delivered");
  expect(await jobs()).toHaveLength(1);
});
it("rejects a bad HMAC before storage and never applies signed wrong sender or destination receipts", async () => {
  const c = await ready();
  await finish(c.id, c.token);
  await cloudFixture();
  expect(
    (await handleCloudWebhook(await signedCloudRequest(signedStatus(), false), X)).status,
  ).toBe(401);
  expect((await db`select count(*)::int n from whatsapp_webhook_events`)[0].n).toBe(0);
  expect(
    (
      await handleCloudWebhook(
        await signedCloudRequest(signedStatus("read", recipient.slice(1), "999999999")),
        X,
      )
    ).status,
  ).toBe(403);
  expect(
    (await handleCloudWebhook(await signedCloudRequest(signedStatus("read", "5548999990002")), X))
      .status,
  ).toBe(200);
  expect((await jobs())[0].status).toBe("accepted");
  expect((await db`select processed_at from whatsapp_webhook_events`)[0].processed_at).toBeNull();
});
it("reconciles a late signed receipt for an unavailable disabled sender without enabling inbound", async () => {
  const c = await ready();
  await finish(c.id, c.token);
  await cloudFixture();
  await db`update wa_cloud_numbers set available=false where phone_number_id=${sender}`;
  await db`update wa_cloud_connections set enabled=false where id=${X}`;
  expect((await handleCloudWebhook(await signedCloudRequest(signedStatus("read")), X)).status).toBe(
    200,
  );
  expect((await jobs())[0].status).toBe("read");
  expect((await db`select enabled from wa_cloud_connections where id=${X}`)[0].enabled).toBe(false);
  expect(
    (await db`select available from wa_cloud_numbers where phone_number_id=${sender}`)[0].available,
  ).toBe(false);
  const inbound = signedStatus() as any;
  inbound.entry[0].changes[0].value.statuses = [];
  inbound.entry[0].changes[0].value.messages = [
    { id: "wamid.inbound", from: recipient.slice(1), type: "text", text: { body: "synthetic" } },
  ];
  expect((await handleCloudWebhook(await signedCloudRequest(inbound), X)).status).toBe(403);
  expect(cloudTest.inbound).not.toHaveBeenCalled();
});
it("keeps disabled connection inbound events quarantined when the background processor retries", async () => {
  await cloudFixture();
  await db`update wa_cloud_connections set enabled=false where id=${X}`;
  const inbound = signedStatus() as any;
  inbound.entry[0].changes[0].value.statuses = [];
  inbound.entry[0].changes[0].value.messages = [
    { id: "wamid.inbound", from: recipient.slice(1), type: "text", text: { body: "synthetic" } },
  ];
  expect((await handleCloudWebhook(await signedCloudRequest(inbound), X)).status).toBe(200);
  const event = (await db`select id,event,payload,attempts from whatsapp_webhook_events`)[0];
  expect(await processEvent(cloudTest.admin, event as any)).toBe(false);
  expect(cloudTest.inbound).not.toHaveBeenCalled();
  expect((await db`select count(*)::int n from whatsapp_messages`)[0].n).toBe(0);
});

it("preserves a provider cooldown beyond one hour after a read-only WhatsApp preflight refusal", async () => {
  const c = await ready();
  expect(
    await withRole(
      "service_role",
      null,
      async (tx) =>
        (
          await tx`select notification_delivery_finish(${c.id},${c.token},'retry_scheduled','meta_cloud',null,'provider_preflight_unavailable',7200) r`
        )[0].r,
    ),
  ).toEqual({ updated: true });
  expect(
    (
      await db`select next_attempt_at>=now()+interval '7190 seconds' as cooldown_preserved from workflow_deliveries where id=${c.id}`
    )[0].cooldown_preserved,
  ).toBe(true);
  expect((await jobs())[0]).toMatchObject({
    status: "retry_scheduled",
    reason_code: "provider_preflight_unavailable",
    attempts: 1,
  });
  expect(await claim(c.id)).toMatchObject({ result: "deferred" });
  expect(await jobs()).toHaveLength(1);
});

it("shares a two-hour WhatsApp cooldown with queued jobs before attempts quota or budget are reserved", async () => {
  const first = await ready();
  await enqueue("1");
  const pending = (await jobs()).find((row) => row.id !== first.id)!;
  expect(
    await finish(first.id, first.token, "retry_scheduled", null, "provider_rate_limited", 7200),
  ).toEqual({ updated: true });
  expect(await claim(pending.id)).toMatchObject({
    result: "deferred",
    reason: "provider_rate_limited",
  });
  const untouched = (
    await db`select attempts,notification_reserved_at,notification_cost_micros,next_attempt_at>=now()+interval '7190 seconds' as cooldown_preserved from workflow_deliveries where id=${pending.id}`
  )[0];
  expect(untouched).toMatchObject({
    attempts: 0,
    notification_reserved_at: null,
    notification_cost_micros: null,
    cooldown_preserved: true,
  });
  expect(
    (
      await db`select revision,whatsapp_enabled from notification_delivery_policies where workspace_id=${W}`
    )[0],
  ).toEqual({ revision: 1, whatsapp_enabled: true });
  expect((await request("/notification_whatsapp_health?select=*")).status).toBe(403);
  expect((await request("/notification_whatsapp_suppression_receipts?select=*")).status).toBe(403);
  expect(await jobs()).toHaveLength(2);
});

it("defers another in-flight WhatsApp job when a concurrent attempt starts a connection cooldown", async () => {
  const first = await ready();
  await enqueue("1");
  const second = await claim((await jobs()).find((row) => row.id !== first.id)!.id);
  expect(second.result).toBe("claimed");
  await finish(
    first.id,
    first.token,
    "retry_scheduled",
    null,
    "provider_preflight_unavailable",
    7200,
  );
  expect(await preflight(second.id, second.token)).toMatchObject({
    allowed: false,
    result: "deferred",
    reason: "provider_preflight_unavailable",
  });
  expect((await jobs()).find((row) => row.id === second.id)).toMatchObject({
    status: "retry_scheduled",
    attempts: 1,
    lease_token: null,
  });
  expect(await finish(second.id, second.token)).toEqual({ updated: false });
  expect((await jobs()).every((row) => row.channel === "whatsapp")).toBe(true);
});

it("disables only WhatsApp after an unbounded reputation refusal and requires explicit authorized reactivation with CAS", async () => {
  const first = await ready();
  await enqueue("1");
  const previous = await claim((await jobs()).find((row) => row.id !== first.id)!.id);
  await finish(
    previous.id,
    previous.token,
    "retry_scheduled",
    null,
    "provider_preflight_unavailable",
    120,
  );
  expect(
    await finish(first.id, first.token, "failed", null, "provider_rate_limited", null),
  ).toEqual({ updated: true });
  const disabled = await settings();
  expect(disabled.payload).toMatchObject({
    revision: 2,
    policy: { email_enabled: true, whatsapp_enabled: false },
  });
  expect(
    (
      await db`select paused_until='infinity'::timestamptz as indefinitely_paused from notification_whatsapp_health where connection_id=${X}`
    )[0].indefinitely_paused,
  ).toBe(true);
  await enqueue("2");
  const pending = (await jobs()).find((row) => row.status === "queued")!;
  expect(await claim(pending.id)).toMatchObject({
    result: "suppressed",
    reason: "provider_rate_limited",
  });
  const reactivate = (revision: number) =>
    withRole(
      "authenticated",
      U,
      async (tx) =>
        (
          await tx`select notification_delivery_settings_save(${W},${tx.json(policy)},${revision}) r`
        )[0].r,
    );
  await expect(reactivate(1)).rejects.toMatchObject({ code: "PT409" });
  await db`update job_role_permission_overrides set effect='deny' where role_id=${ROLE} and permission_key='system.whatsapp.manage.workspace'`;
  await expect(reactivate(2)).rejects.toMatchObject({ code: "42501" });
  await db`update job_role_permission_overrides set effect='grant' where role_id=${ROLE} and permission_key='system.whatsapp.manage.workspace'`;
  expect(await reactivate(2)).toMatchObject({ revision: 3, policy: { whatsapp_enabled: true } });
  expect(
    (
      await db`select count(*)::int n from notification_whatsapp_health where workspace_id=${W} and paused_until='infinity'::timestamptz`
    )[0].n,
  ).toBe(0);
  expect(
    (
      await db`select paused_until>=now()+interval '110 seconds' as finite_cooldown_preserved from notification_whatsapp_health where connection_id=${X}`
    )[0].finite_cooldown_preserved,
  ).toBe(true);
  await db`update notification_whatsapp_health set paused_until=now()-interval '1 second',cooldown_until=now()-interval '1 second' where connection_id=${X}`;
  await db`update workflow_deliveries set next_attempt_at=now() where id=${previous.id}`;
  expect(await claim(previous.id)).toMatchObject({
    result: "suppressed",
    reason: "endpoint_changed",
  });
  await enqueue("3");
  const fresh = (await jobs()).find((row) => row.status === "queued")!;
  expect(await claim(fresh.id)).toMatchObject({ result: "claimed", connectionId: X });
  expect((await jobs()).every((row) => row.channel === "whatsapp")).toBe(true);
});

it("records a missing-Inbox 131026 suppression once across duplicate receipts and a later projection", async () => {
  const c = await ready();
  await finish(c.id, c.token);
  expect(await receipt({ status: "failed" })).toEqual({
    matched: true,
    updated: true,
  });
  expect((await db`select count(*)::int n from whatsapp_number_suppressions`)[0].n).toBe(0);
  expect(await receipt({ status: "failed", errorCode: "131026" })).toEqual({
    matched: true,
    updated: false,
  });
  const original = (
    await db`select error_count,expires_at from whatsapp_number_suppressions where workspace_id=${W}`
  )[0];
  expect(original.error_count).toBe(1);
  expect(await receipt({ status: "failed", errorCode: "131026" })).toEqual({
    matched: true,
    updated: false,
  });
  await db`insert into whatsapp_messages(workspace_id,direction,to_number,wa_message_id,status,error_code) values(${W},'outbound',${recipient},'wamid.p7','failed','131026')`;
  expect(
    (
      await db`select error_count,expires_at from whatsapp_number_suppressions where workspace_id=${W}`
    )[0],
  ).toEqual(original);
  await db`insert into whatsapp_messages(workspace_id,direction,to_number,wa_message_id,status,error_code) values(${W},'outbound',${recipient},'wamid.p7.another','failed','131026')`;
  expect(
    (await db`select error_count from whatsapp_number_suppressions where workspace_id=${W}`)[0]
      .error_count,
  ).toBe(2);
  expect(
    (
      await db`select count(*)::int n from notification_whatsapp_suppression_receipts where workspace_id=${W}`
    )[0].n,
  ).toBe(2);
  expect(await jobs()).toHaveLength(1);
});

it("suppresses 131049 callbacks only on an applied failed transition and ignores codes or regressions outside the allowlist", async () => {
  const c = await ready();
  await finish(c.id, c.token);
  expect(await receipt({ status: "delivered", errorCode: "131049" })).toEqual({
    matched: true,
    updated: true,
  });
  expect(await receipt({ status: "failed", errorCode: "131049" })).toEqual({
    matched: true,
    updated: false,
  });
  expect((await db`select count(*)::int n from whatsapp_number_suppressions`)[0].n).toBe(0);
  await enqueue("1");
  const second = await claim((await jobs()).find((row) => row.id !== c.id)!.id);
  await enqueue("2");
  const unsupported = await claim((await jobs()).find((row) => row.status === "queued")!.id);
  await finish(unsupported.id, unsupported.token, "accepted", "wamid.unsupported");
  expect(
    await receipt({ wamid: "wamid.unsupported", status: "failed", errorCode: "999999" }),
  ).toEqual({ matched: true, updated: true });
  expect((await db`select count(*)::int n from whatsapp_number_suppressions`)[0].n).toBe(0);
  await finish(second.id, second.token, "accepted", "wamid.engagement");
  expect(
    await receipt({ wamid: "wamid.engagement", status: "failed", errorCode: "131049" }),
  ).toEqual({ matched: true, updated: true });
  expect(
    (
      await db`select reason,error_count,last_error_code from whatsapp_number_suppressions where workspace_id=${W}`
    )[0],
  ).toMatchObject({ reason: "engagement_limit", error_count: 1, last_error_code: "131049" });
  expect(
    await receipt({ wamid: "wamid.engagement", status: "failed", errorCode: "131049" }),
  ).toEqual({ matched: true, updated: false });
  expect(
    (await db`select count(*)::int n from notification_whatsapp_suppression_receipts`)[0].n,
  ).toBe(1);
  expect((await jobs()).every((row) => row.channel === "whatsapp")).toBe(true);
});

it("preserves a shared finite cooldown without email fallback after four read-only WhatsApp refusals", async () => {
  let current = await ready();
  for (let attempt = 1; attempt <= 4; attempt++) {
    expect(
      await finish(
        current.id,
        current.token,
        "retry_scheduled",
        null,
        "provider_preflight_unavailable",
        7200,
      ),
    ).toEqual({ updated: true });
    if (attempt < 4) {
      await db`update notification_whatsapp_health set paused_until=now()-interval '1 second' where connection_id=${X}`;
      await db`update workflow_deliveries set next_attempt_at=now() where id=${current.id}`;
      current = await claim(current.id);
      expect(current.result).toBe("claimed");
    }
  }
  expect((await jobs())[0]).toMatchObject({
    status: "failed",
    reason_code: "provider_preflight_unavailable",
    attempts: 4,
  });
  expect(
    (
      await db`select paused_until>=now()+interval '7190 seconds' as cooldown_preserved from notification_whatsapp_health where connection_id=${X}`
    )[0].cooldown_preserved,
  ).toBe(true);
  expect(
    (
      await db`select whatsapp_enabled,revision from notification_delivery_policies where workspace_id=${W}`
    )[0],
  ).toEqual({ whatsapp_enabled: true, revision: 1 });
  expect(await jobs()).toHaveLength(1);
});

it("checks the signed sender and destination against an existing Inbox projection before mutating either history", async () => {
  const c = await ready();
  await finish(c.id, c.token);
  await cloudFixture();
  const conversation = randomUUID(),
    message = randomUUID();
  const from = (
    await db`select display_phone_number from wa_cloud_numbers where phone_number_id=${sender}`
  )[0].display_phone_number;
  await db`insert into whatsapp_conversations(id,workspace_id,owner_id,assigned_to,wa_phone_number_id) values(${conversation},${W},${U},${U},${sender})`;
  await db`insert into whatsapp_messages(id,workspace_id,conversation_id,direction,provider,from_number,to_number,wa_message_id,status,raw)
    values(${message},${W},${conversation},'outbound','meta',${from},${recipient},'wamid.p7','accepted',${db.json({ source: { notification_delivery_id: c.id, idempotency_key: c.idempotencyKey, attempt_token: c.token, connection_id: X } })})`;
  expect(
    (await handleCloudWebhook(await signedCloudRequest(signedStatus("read", "5548999990002")), X))
      .status,
  ).toBe(200);
  expect((await jobs())[0].status).toBe("accepted");
  expect(
    (await db`select status,read_at from whatsapp_messages where id=${message}`)[0],
  ).toMatchObject({ status: "accepted", read_at: null });
  await db`insert into wa_cloud_numbers(workspace_id,connection_id,phone_number_id,display_phone_number,quality_rating,status,available) values(${W},${X},'987654321','+5548000000000','GREEN','CONNECTED',true)`;
  expect(
    (
      await handleCloudWebhook(
        await signedCloudRequest(signedStatus("read", recipient.slice(1), "987654321")),
        X,
      )
    ).status,
  ).toBe(200);
  expect((await jobs())[0].status).toBe("accepted");
  expect((await db`select status from whatsapp_messages where id=${message}`)[0].status).toBe(
    "accepted",
  );
  expect((await handleCloudWebhook(await signedCloudRequest(signedStatus("read")), X)).status).toBe(
    200,
  );
  expect((await jobs())[0].status).toBe("read");
  expect((await db`select status from whatsapp_messages where id=${message}`)[0].status).toBe(
    "read",
  );
});

describe("notification WhatsApp sender catalogue", () => {
  const requiredKeys = [
    "system.notification_settings.view.workspace",
    "system.channels.view.workspace",
    "system.whatsapp.view.workspace",
  ] as const;
  const catalogue = (workspace = W, actor = U, token?: string) =>
    request("/rpc/notification_whatsapp_senders", { p_workspace: workspace }, actor, token);

  beforeEach(async () => {
    await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect)
    values(${W},${ROLE},'system.whatsapp.view.workspace','grant')`;
  });

  it("returns the authorized sender DTO and eligibility without exposing or granting Cloud credentials", async () => {
    // Read access must not require manage. All provider state is synthetic and
    // local; the RPC does not consult Meta, create policies, or queue deliveries.
    await db`update job_role_permission_overrides set effect='deny' where workspace_id=${W} and role_id=${ROLE}
    and permission_key in('system.whatsapp.manage.workspace','system.notification_settings.manage.workspace')`;
    const disabled = randomUUID(),
      unverified = randomUUID(),
      foreign = randomUUID(),
      missing = randomUUID();
    await db`insert into wa_cloud_connections(id,workspace_id,enabled,webhook_verified_at) values
    (${disabled},${W},false,now()),(${unverified},${W},true,null),(${foreign},${B},true,now())`;
    const variants = [
      {
        id: "200000001",
        connection: X,
        available: true,
        status: "CONNECTED",
        quality: "GREEN",
        reason: null,
      },
      {
        id: "200000002",
        connection: X,
        available: false,
        status: "CONNECTED",
        quality: "GREEN",
        reason: "sender_unavailable",
      },
      {
        id: "200000003",
        connection: X,
        available: true,
        status: "DISCONNECTED",
        quality: "GREEN",
        reason: "sender_unavailable",
      },
      {
        id: "200000004",
        connection: disabled,
        available: true,
        status: "CONNECTED",
        quality: "RED",
        reason: "connection_unavailable",
      },
      {
        id: "200000005",
        connection: unverified,
        available: true,
        status: "CONNECTED",
        quality: "RED",
        reason: "webhook_unverified",
      },
      {
        id: "200000006",
        connection: X,
        available: true,
        status: "CONNECTED",
        quality: "YELLOW",
        reason: "quality_not_high",
      },
      {
        id: "200000007",
        connection: X,
        available: true,
        status: "CONNECTED",
        quality: null,
        reason: "quality_not_high",
      },
      {
        id: "200000008",
        connection: X,
        available: true,
        status: "CONNECTED",
        quality: "HIGH",
        reason: null,
      },
      {
        id: "200000009",
        connection: missing,
        available: true,
        status: "CONNECTED",
        quality: "GREEN",
        reason: "connection_unavailable",
      },
      {
        id: "200000010",
        connection: foreign,
        available: true,
        status: "CONNECTED",
        quality: "GREEN",
        reason: "connection_unavailable",
      },
      {
        id: "200000011",
        connection: X,
        available: true,
        status: null,
        quality: null,
        reason: "sender_unavailable",
      },
    ];
    for (const variant of variants)
      await db`insert into wa_cloud_numbers(phone_number_id,connection_id,workspace_id,display_phone_number,verified_name,quality_rating,status,available,synced_at)
      values(${variant.id},${variant.connection},${W},${"+55" + variant.id},'',${variant.quality},${variant.status},${variant.available},null)`;
    await db`insert into wa_cloud_numbers(phone_number_id,connection_id,workspace_id,display_phone_number,quality_rating,status,available)
    values('999999999',${foreign},${B},'+559999999999','GREEN','CONNECTED',true)`;
    const response = await catalogue();
    expect(response.status).toBe(200);
    const items = response.payload.items as Record<string, unknown>[];
    expect(items).toHaveLength(variants.length + 1);
    for (const variant of variants) {
      const row = items.find((item) => item.id === variant.id)!;
      expect(Object.keys(row).sort()).toEqual([
        "available",
        "eligible",
        "id",
        "label",
        "phone",
        "quality",
        "reason",
        "status",
        "syncedAt",
      ]);
      expect(row).toMatchObject({
        phone: "+55" + variant.id,
        label: "+55" + variant.id,
        available: variant.available && variant.status === "CONNECTED",
        quality: variant.quality,
        status: variant.status,
        syncedAt: null,
        eligible: variant.reason === null,
        reason: variant.reason,
      });
    }
    expect(items.some((item) => item.id === "999999999")).toBe(false);
    expect(
      (await request("/wa_cloud_connections?select=id,enabled,webhook_verified_at")).status,
    ).toBe(403);
    expect((await request("/wa_cloud_connections?select=credentials_ciphertext")).status).toBe(403);
    expect(
      await withRole(
        "authenticated",
        U,
        async (tx) =>
          (
            await tx`select has_table_privilege(current_user,'public.wa_cloud_connections','SELECT') allowed`
          )[0].allowed,
      ),
    ).toBe(false);
    await db`update wa_cloud_numbers set display_phone_number='',verified_name=null where phone_number_id in('200000001','200000002')`;
    const emptyLabels = await catalogue();
    expect(
      emptyLabels.payload.items
        .slice(0, 2)
        .map((item: { id: string; label: string }) => ({ id: item.id, label: item.label })),
    ).toEqual([
      { id: "200000001", label: "Número conectado" },
      { id: "200000002", label: "Número conectado" },
    ]);
    await db`insert into wa_cloud_numbers(phone_number_id,connection_id,workspace_id,display_phone_number,quality_rating,status,available)
    select (300000000+n)::text,${X},${W},'+55'||(300000000+n)::text,'GREEN','CONNECTED',true from generate_series(1,105) n`;
    expect((await catalogue()).payload.items).toHaveLength(100);
    expect((await db`select count(*)::integer n from notification_delivery_policies`)[0].n).toBe(0);
    expect((await db`select count(*)::integer n from notification_delivery_intents`)[0].n).toBe(0);
  });

  it("rejects each missing required workspace view key, anonymous calls and service calls", async () => {
    for (const key of requiredKeys) {
      await db`delete from job_role_permission_overrides where workspace_id=${W} and role_id=${ROLE} and permission_key=${key}`;
      expect((await catalogue()).status).toBe(403);
      await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${W},${ROLE},${key},'grant')`;
    }
    await db`delete from job_role_permission_overrides where workspace_id=${W} and role_id=${ROLE} and permission_key='system.whatsapp.view.workspace'`;
    for (const scope of ["own", "team"])
      await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${W},${ROLE},${"system.whatsapp.view." + scope},'grant')`;
    expect((await catalogue()).status).toBe(403);
    expect([401, 403]).toContain((await catalogue(W, U, fixtureJwt("anon"))).status);
    expect([401, 403]).toContain((await catalogue(W, U, fixtureJwt("service_role"))).status);
    expect((await catalogue(W, U, fixtureJwt("authenticated"))).status).toBe(403);
  });

  it("honors explicit deny over grants and over the active workspace owner", async () => {
    await db`insert into user_job_roles(role_id,user_id,workspace_id,owner_id) values(${ROLE},${A},${W},${W})`;
    expect((await catalogue(W, A)).status).toBe(200);
    for (const key of requiredKeys) {
      await db`update job_role_permission_overrides set effect='deny' where workspace_id=${W} and role_id=${ROLE} and permission_key=${key}`;
      expect((await catalogue()).status).toBe(403);
      expect((await catalogue(W, A)).status).toBe(403);
      await db`update job_role_permission_overrides set effect='grant' where workspace_id=${W} and role_id=${ROLE} and permission_key=${key}`;
    }
  });

  it("rejects another workspace or foreign actor and cannot project foreign connection metadata", async () => {
    expect(
      (await request("/rpc/notification_whatsapp_senders", { p_workspace: null })).status,
    ).toBe(403);
    expect((await catalogue(B)).status).toBe(403);
    expect((await catalogue(W, F)).status).toBe(403);
    await db`update profiles set active_workspace_id=${B} where id=${U}`;
    expect((await catalogue(W)).status).toBe(403);
    expect((await catalogue(B)).status).toBe(403);
  });

  it("rejects inactive membership despite retained grants and workspace ownership", async () => {
    await db`update workspace_members set status='inactive' where workspace_id=${W} and user_id in(${U},${A})`;
    expect((await catalogue()).status).toBe(403);
    expect((await catalogue(W, A)).status).toBe(403);
  });
});
