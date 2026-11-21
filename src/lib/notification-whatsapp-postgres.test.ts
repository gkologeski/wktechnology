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
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import {
  db,
  W,
  B,
  A,
  U,
  C,
  F,
  N,
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
import { setupNotificationWhatsAppReceived } from "../../tests/fixtures/notification-whatsapp-received";

beforeAll(async () => setupNotificationWhatsAppReceived(db), 30000);
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

describe("Meta template administration account boundary", () => {
  const actions = ["view", "create", "update", "delete"] as const;
  const target = `cloud:${X}`;
  const viewKeys = [
    "system.whatsapp_templates.view.workspace",
    "system.channels.view.workspace",
    "system.whatsapp.view.workspace",
  ];
  const permission = (action: string) => `system.whatsapp_templates.${action}.workspace`;
  const context = (
    action = "view",
    account: string | null = target,
    workspace: string | null = W,
    actor = U,
    token?: string,
  ) =>
    request(
      "/rpc/wa_template_admin_context",
      {
        p_workspace: workspace,
        p_action: action,
        p_target: account,
      },
      actor,
      token,
    );

  beforeEach(async () => {
    await db.begin(async (tx) => {
      for (const key of [...viewKeys, ...actions.map(permission)])
        await tx`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect)
          values(${W},${ROLE},${key},'grant') on conflict(workspace_id,role_id,permission_key) do update set effect='grant'`;
      await tx`update wa_cloud_connections set label='Fixture WABA',waba_id='111111111111',credentials_ciphertext='synthetic-private-template-secret' where id=${X}`;
    });
  });

  it("permits authorized Meta template actions with a minimal account projection", async () => {
    for (const action of actions) {
      const result = await context(action);
      expect(result.status).toBe(200);
      expect(result.payload).toEqual({
        actor: U,
        workspace: W,
        readOnly: false,
        capabilities: { view: true, create: true, update: true, delete: true },
        targets: [
          {
            id: target,
            provider: "cloud",
            label: "Fixture WABA",
            wabaId: "111111111111",
            enabled: true,
            numbers: [{ id: sender, phone: "+554861360001", label: "+554861360001" }],
          },
        ],
      });
      expect(JSON.stringify(result.payload)).not.toMatch(
        /credentials_ciphertext|synthetic-private-template-secret|api_version|connection_id|webhook/,
      );
    }
    expect((await request("/wa_cloud_connections?select=id,enabled,waba_id")).status).toBe(403);
    expect((await request("/wa_cloud_connections?select=credentials_ciphertext")).status).toBe(403);
  });

  it("rejects Meta template actions without their exact workspace key", async () => {
    for (const action of actions) {
      await db`delete from job_role_permission_overrides where workspace_id=${W} and role_id=${ROLE} and permission_key=${permission(action)}`;
      for (const scope of ["own", "team"])
        await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect)
          values(${W},${ROLE},${`system.whatsapp_templates.${action}.${scope}`},'grant')`;
      expect((await context(action)).status).toBe(403);
      await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect)
        values(${W},${ROLE},${permission(action)},'grant')`;
    }
  });

  it("honors explicit deny for Meta template actions including the workspace owner", async () => {
    await db`insert into user_job_roles(role_id,user_id,workspace_id,owner_id) values(${ROLE},${A},${W},${W})`;
    for (const action of actions) {
      expect((await context(action, target, W, A)).status).toBe(200);
      await db`update job_role_permission_overrides set effect='deny' where workspace_id=${W} and role_id=${ROLE} and permission_key=${permission(action)}`;
      expect((await context(action)).status).toBe(403);
      expect((await context(action, target, W, A)).status).toBe(403);
      await db`update job_role_permission_overrides set effect='grant' where workspace_id=${W} and role_id=${ROLE} and permission_key=${permission(action)}`;
    }
  });

  it("rejects foreign workspace and actor for Meta template actions", async () => {
    const foreign = randomUUID();
    await db`insert into wa_cloud_connections(id,workspace_id,label,waba_id,enabled) values(${foreign},${B},'Foreign private account','999999999999',true)`;
    await db`insert into wa_cloud_numbers(phone_number_id,connection_id,workspace_id,display_phone_number) values('999999999',${foreign},${B},'+559999999999')`;
    for (const action of actions) {
      expect((await context(action, `cloud:${foreign}`)).status).toBe(403);
      expect((await context(action, target, B)).status).toBe(403);
      expect((await context(action, target, W, F)).status).toBe(403);
    }
    await db`update profiles set active_workspace_id=${B} where id=${U}`;
    for (const action of actions) expect((await context(action)).status).toBe(403);
  });

  it("rejects inactive membership for Meta template actions including the owner", async () => {
    await db`update workspace_members set status='inactive' where workspace_id=${W} and user_id in(${U},${A})`;
    for (const action of actions) {
      expect((await context(action)).status).toBe(403);
      expect((await context(action, target, W, A)).status).toBe(403);
    }
  });

  it("blocks external template mutations in a read-only role session", async () => {
    const session = randomUUID();
    await db`insert into view_as_sessions(session_id,mode) values(${session},'role')`;
    for (const action of ["create", "update", "delete"]) {
      await expect(
        withRole(
          "authenticated",
          U,
          async (tx) => tx`select wa_template_admin_context(${W},${action},${target})`,
          { session_id: session },
        ),
      ).rejects.toMatchObject({ code: "42501" });
    }
    const read = await withRole(
      "authenticated",
      U,
      async (tx) => (await tx`select wa_template_admin_context(${W},'view',${target}) c`)[0].c,
      { session_id: session },
    );
    expect(read).toMatchObject({
      readOnly: true,
      capabilities: { view: true, create: false, update: false, delete: false },
    });
  });

  it("requires every base view key for all Meta template actions", async () => {
    for (const key of viewKeys) {
      await db`delete from job_role_permission_overrides where workspace_id=${W} and role_id=${ROLE} and permission_key=${key}`;
      for (const action of actions) expect((await context(action)).status).toBe(403);
      await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${W},${ROLE},${key},'grant')`;
    }
  });

  it("keeps template view-only permission separate from provider mutations", async () => {
    for (const action of ["create", "update", "delete"])
      await db`delete from job_role_permission_overrides where workspace_id=${W} and role_id=${ROLE} and permission_key=${permission(action)}`;
    expect(await context()).toMatchObject({
      status: 200,
      payload: { capabilities: { view: true, create: false, update: false, delete: false } },
    });
    for (const action of ["create", "update", "delete"])
      expect((await context(action)).status).toBe(403);
  });

  it("rejects null actors, anon, service and malformed template targets before private lookup", async () => {
    const boundary = (
      await db`select p.prosecdef,p.provolatile,p.proowner::regrole::text owner,p.proconfig,
      has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated,
      has_function_privilege('anon',p.oid,'EXECUTE') anonymous,
      has_function_privilege('service_role',p.oid,'EXECUTE') service
      from pg_proc p where p.oid='public.wa_template_admin_context(uuid,text,text)'::regprocedure`
    )[0];
    expect(boundary).toEqual({
      prosecdef: true,
      provolatile: "s",
      owner: "postgres",
      proconfig: ["search_path=public, pg_temp"],
      authenticated: true,
      anonymous: false,
      service: false,
    });
    for (const action of actions) {
      expect((await context(action, target, null)).status).toBe(403);
      expect((await context(action, target, W, U, fixtureJwt("authenticated"))).status).toBe(403);
      for (const role of ["anon", "service_role"] as const)
        expect([401, 403]).toContain(
          (await context(action, target, W, U, fixtureJwt(role))).status,
        );
    }
    for (const account of [
      "cloud:../secrets",
      `cloud:${randomUUID()}`,
      `lovable:${randomUUID()}`,
      "x".repeat(1000),
    ])
      expect((await context("view", account)).status).toBe(403);
    expect((await context("manage")).status).toBe(403);
    expect(
      (
        await request("/rpc/wa_template_admin_context", {
          p_workspace: W,
          p_action: null,
          p_target: target,
        })
      ).status,
    ).toBe(403);
    for (const action of ["create", "update", "delete"])
      expect((await context(action, null)).status).toBe(403);
    await expect(
      withRole(
        "authenticated",
        U,
        (tx) => tx`select wa_template_admin_context(${W},'view',${target})`,
        { role: "service_role" },
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("groups numbers by WABA connection and limits legacy accounts to the workspace registry", async () => {
    const legacy = randomUUID(),
      archived = randomUUID(),
      foreign = randomUUID(),
      foreignConnection = randomUUID();
    await db`insert into wa_cloud_numbers(phone_number_id,connection_id,workspace_id,display_phone_number,verified_name) values('123456790',${X},${W},'+554861360002','Second number')`;
    await db`insert into wa_cloud_connections(id,workspace_id,label,waba_id,enabled) values(${foreignConnection},${B},'Foreign Meta account','999999999999',true)`;
    await db`insert into wa_cloud_numbers(phone_number_id,connection_id,workspace_id,display_phone_number) values('999999999',${foreignConnection},${B},'+559999999999'),('999999998',${foreignConnection},${W},'+559999999998')`;
    await db`insert into service_channel_accounts(id,workspace_id,channel,source_key,label,display_name,enabled,archived_at) values
      (${legacy},${W},'whatsapp','223456789','+5548999990001','Legacy account',false,null),
      (${archived},${W},'whatsapp','223456790','Archived legacy','',true,now()),
      (${foreign},${B},'whatsapp','223456791','Foreign legacy','',true,null),
      (${randomUUID()},${W},'whatsapp',${sender},'Same direct number','',true,null),
      (${randomUUID()},${W},'email','223456792','Other channel','',true,null),
      (${randomUUID()},${W},'whatsapp','not-a-number','Invalid source','',true,null)`;
    const result = await context("view", null);
    expect(result.status).toBe(200);
    expect(result.payload.targets).toHaveLength(2);
    expect(result.payload.targets[0]).toMatchObject({
      id: target,
      provider: "cloud",
      wabaId: "111111111111",
    });
    expect(result.payload.targets[0].numbers.map((n: { id: string }) => n.id)).toEqual([
      sender,
      "123456790",
    ]);
    expect(result.payload.targets[1]).toEqual({
      id: `lovable:${legacy}`,
      provider: "lovable",
      label: "+5548999990001",
      wabaId: null,
      enabled: true,
      numbers: [{ id: "223456789", phone: "+5548999990001", label: "Legacy account" }],
    });
    expect(JSON.stringify(result.payload)).not.toMatch(
      /999999999999|999999999|999999998|Foreign|Archived/,
    );
    expect((await context("update", `lovable:${legacy}`)).status).toBe(200);
    expect((await context("view", `lovable:${archived}`)).status).toBe(403);
    expect((await context("view", `lovable:${foreign}`)).status).toBe(403);
    // A second genuinely authorized tenant gets only its own accounts, not
    // merely an empty catalogue caused by lacking the new permission keys.
    const foreignRole = randomUUID();
    await db`insert into job_roles(id,workspace_id) values(${foreignRole},${B})`;
    await db`insert into user_job_roles(role_id,user_id,workspace_id,owner_id) values(${foreignRole},${F},${B},${B})`;
    for (const key of [...viewKeys, ...actions.map(permission)])
      await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect)
        values(${B},${foreignRole},${key},'grant') on conflict(workspace_id,role_id,permission_key) do update set effect='grant'`;
    const otherTenant = await context("view", null, B, F);
    expect(otherTenant.status).toBe(200);
    expect(otherTenant.payload.targets.map((item: { id: string }) => item.id)).toEqual([
      `cloud:${foreignConnection}`,
      `lovable:${foreign}`,
    ]);
    expect(JSON.stringify(otherTenant.payload)).not.toContain("111111111111");
    expect(otherTenant.payload.targets[0].numbers).toEqual([
      { id: "999999999", phone: "+559999999999", label: "+559999999999" },
    ]);
  });

  it("allows management reads before webhook activation but blocks disabled account mutations", async () => {
    await db`update wa_cloud_connections set webhook_verified_at=null where id=${X}`;
    await db`update wa_cloud_numbers set quality_rating='RED',status='DISCONNECTED',available=false where phone_number_id=${sender}`;
    expect((await context("create")).status).toBe(200);
    await db`update wa_cloud_connections set enabled=false where id=${X}`;
    expect(await context()).toMatchObject({
      status: 200,
      payload: { targets: [{ enabled: false }] },
    });
    for (const action of ["create", "update", "delete"])
      expect((await context(action)).status).toBe(403);
    expect((await db`select count(*)::integer n from notification_delivery_intents`)[0].n).toBe(0);
  });

  it("bounds and orders the template account and number catalogues without exposing credentials", async () => {
    await db`insert into wa_cloud_numbers(phone_number_id,connection_id,workspace_id,display_phone_number)
      select (300000000+n)::text,${X},${W},'+55'||(300000000+n)::text from generate_series(1,105)n`;
    await db`insert into service_channel_accounts(id,workspace_id,channel,source_key,label,enabled)
      select md5('template-fixture-'||n)::uuid,${W},'whatsapp',(400000000+n)::text,'Legacy '||lpad(n::text,3,'0'),true from generate_series(1,105)n`;
    const result = await context("view", null);
    expect(result.status).toBe(200);
    expect(result.payload.targets).toHaveLength(100);
    expect(result.payload.targets[0].numbers).toHaveLength(100);
    expect(result.payload.targets.map((item: { label: string }) => item.label)).toEqual([
      "Fixture WABA",
      ...Array.from({ length: 99 }, (_, i) => `Legacy ${String(i + 1).padStart(3, "0")}`),
    ]);
    const last = (await db`select id from service_channel_accounts where label='Legacy 105'`)[0].id;
    expect((await context("view", `lovable:${last}`)).payload.targets).toHaveLength(1);
  });
});

// The complete production SQL executes over signed synthetic JWTs and canonical
// source RLS. No authorization function is replaced by a permissive fixture.
describe("WhatsApp received Workflow occurrence", () => {
  const sharedKey = "shared.message.received";
  const wf = "e2000000-0000-4000-8000-000000000001";
  const cloudSource = "cloud:" + X;
  const noticeTitle = "Nova mensagem de WhatsApp recebida";
  async function configure(
    selection: Record<string, postgres.JSONValue | undefined> = {},
    actions: postgres.JSONValue[] = [],
  ) {
    await db`insert into workflows(id,workspace_id,owner_id,execution_user_id,entity,enabled,status,published_version,trigger,actions,last_published_at)
      values(${wf},${W},${A},${U},'whatsapp_messages',true,'published',1,${db.json({ event: "updated", notification_event: { key: sharedKey, ...selection } })},${db.json(actions)},clock_timestamp())`;
  }
  async function envelope(
    options: {
      lovable?: boolean;
      old?: boolean;
      outbound?: boolean;
      noMarkers?: boolean;
      call?: boolean;
      status?: boolean;
    } = {},
  ) {
    const message = randomUUID(),
      conversation = randomUUID(),
      webhook = randomUUID();
    const phone = options.lovable ? "987654321" : sender;
    const display = options.lovable ? "+554861369999" : "+554861360001";
    const wamid = "wamid.synthetic." + message;
    const [time] =
      await db`select floor(extract(epoch from clock_timestamp()))::bigint::text stamp`;
    const raw = {
      id: wamid,
      from: "5548999990000",
      timestamp: options.old ? "1600000000" : time.stamp,
      type: options.call ? "call" : "text",
      text: { body: "Private customer text MUST NOT enter Workflow" },
    };
    let source = cloudSource;
    if (options.lovable) {
      const [existing] =
        await db`select id from service_channel_accounts where workspace_id=${W} and channel='whatsapp' and source_key=${phone}`;
      if (!existing) {
        await db`insert into service_channel_accounts(id,workspace_id,channel,source_key,label,display_name,enabled) values(${conversation},${W},'whatsapp',${phone},'Lovable account','Lia',false)`;
      }
      source = "lovable:" + (existing?.id ?? conversation);
    }
    const value = {
      metadata: { phone_number_id: phone, display_phone_number: display },
      ...(options.status
        ? { statuses: [{ id: wamid, status: "delivered" }] }
        : { messages: [raw] }),
      ...(!options.lovable && !options.noMarkers
        ? { _verified_connection_id: X, _verified_workspace_id: W }
        : {}),
    };
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: options.lovable ? "98765432101" : "12345678901",
          changes: [{ field: "messages", value }],
        },
      ],
    };
    await db`insert into whatsapp_conversations(id,workspace_id,owner_id,assigned_to,wa_phone_number_id,twilio_number,contact_phone) values(${conversation},${W},${W},${U},${phone},${display},'+5548999990000')`;
    await db`insert into whatsapp_webhook_events(id,delivery_id,event,payload,workspace_id)
      values(${webhook},${options.lovable ? "lovable:" + webhook : "cloud:" + X + ":" + webhook},'whatsapp.message',${db.json(payload)},${W})`;
    await db`insert into whatsapp_messages(id,workspace_id,owner_id,conversation_id,direction,provider,from_number,to_number,wa_message_id,status,raw)
      values(${message},${W},${W},${conversation},${options.outbound ? "outbound" : "inbound"},'meta','+5548999990000',${display},${wamid},'received',${db.json({ ...raw, _cloud_phone_number_id: phone })})`;
    return { message, conversation, webhook, source };
  }
  const mint = (m: { message: string; webhook: string }) =>
    withRole(
      "service_role",
      null,
      async (tx) =>
        (await tx`select notification_whatsapp_received(${m.message},${m.webhook}) id`)[0].id as
          | string
          | null,
    );
  const eventCheck = (event: string) =>
    withRole(
      "service_role",
      null,
      async (tx) => (await tx`select notification_business_event_check(${event},${wf},1) ok`)[0].ok,
    );
  async function dispatch(
    event: string,
    rules: postgres.JSONValue[] = [{ kind: "source_responsible" }],
    delivery: Record<string, postgres.JSONValue> = { channels: ["inapp"], fallback: "none" },
  ) {
    const [e] = await db`select * from workflow_events where id=${event}`;
    const run = randomUUID();
    await db`insert into workflow_runs(id,workspace_id,owner_id,workflow_id,event_id,entity,entity_id) values(${run},${W},${A},${wf},${event},'whatsapp_messages',${e.entity_id})`;
    return withRole(
      "service_role",
      null,
      async (tx) =>
        (
          await tx`select notification_workflow_dispatch_v2(${wf},${run},1,'whatsapp_messages',${e.entity_id},${tx.json(rules)},${noticeTitle},null,'0',${tx.json(delivery)}) r`
        )[0].r,
    );
  }
  const sources = (actor = U, workspace = W) =>
    request("/rpc/notification_whatsapp_sources", { p_workspace: workspace }, actor);
  const observe = (phone: string | null = "987654321", display: string | null = "+554861369999") =>
    withRole(
      "service_role",
      null,
      async (tx) =>
        (await tx`select notification_whatsapp_gateway_observe(${phone},${display}) bound`)[0]
          .bound as boolean,
    );

  it("allows an authorized active Workflow WhatsApp member", async () => {
    const r = await sources();
    expect(r.status).toBe(200);
    expect(r.payload).toMatchObject({
      workspace_id: W,
      sources: [{ id: cloudSource, numbers: [{ id: sender, phone: "+554861360001" }] }],
    });
    await configure();
    const m = await envelope();
    const event = await mint(m);
    expect(event).toEqual(expect.any(String));
    expect(await eventCheck(event!)).toBe(true);
    expect(
      await withRole(
        "authenticated",
        U,
        async (tx) => (await tx`select id from whatsapp_messages where id=${m.message}`).length,
      ),
    ).toBe(1);
  });
  it("denies Workflow WhatsApp sources without the permission key", async () => {
    expect((await sources(N)).status).toBe(403);
    await db`delete from job_role_permission_overrides where permission_key='techsales.inbox.whatsapp.view.workspace' and role_id=${ROLE}`;
    expect((await sources()).status).toBe(403);
  });
  it("preserves an explicit Workflow WhatsApp deny", async () => {
    await db`update job_role_permission_overrides set effect='deny' where permission_key='techsales.inbox.whatsapp.view.workspace' and role_id=${ROLE}`;
    expect((await sources()).status).toBe(403);
    await configure();
    const event = await mint(await envelope());
    expect(await eventCheck(event!)).toBe(false);
  });
  it("denies Workflow WhatsApp references from a foreign workspace", async () => {
    expect((await sources(F)).status).toBe(403);
    expect((await sources(U, B)).status).toBe(403);
    await configure();
    const m = await envelope();
    expect(
      await withRole(
        "authenticated",
        F,
        async (tx) => (await tx`select id from whatsapp_messages where id=${m.message}`).length,
      ),
    ).toBe(0);
  });
  it("denies an inactive Workflow WhatsApp member", async () => {
    await db`update workspace_members set status='inactive' where workspace_id=${W} and user_id=${U}`;
    expect((await sources()).status).toBe(403);
    await configure();
    const event = await mint(await envelope());
    expect(await eventCheck(event!)).toBe(false);
  });
  it("mints one sanitized Cloud occurrence and reuses it on concurrent retry", async () => {
    await configure({ source_keys: [cloudSource], phone_number_ids: [sender] });
    const m = await envelope();
    const [a, b] = await Promise.all([mint(m), mint(m)]);
    expect(a).toEqual(b);
    expect(a).not.toBeNull();
    const [e] = await db`select * from workflow_events where id=${a}`;
    expect(Object.keys(e.after).sort()).toEqual(
      [
        "id",
        "workspace_id",
        "owner_id",
        "conversation_id",
        "direction",
        "source_key",
        "phone_number_id",
        "provider",
        "occurred_at",
        "message_type",
        "assigned_to",
      ].sort(),
    );
    expect(e.after).toMatchObject({
      id: m.message,
      conversation_id: m.conversation,
      provider: "cloud",
      source_key: cloudSource,
      direction: "inbound",
      assigned_to: U,
    });
    expect(JSON.stringify(e.after)).not.toContain("Private customer");
    expect(
      await db`select id from workflow_events where notification_event_key=${sharedKey}`,
    ).toHaveLength(1);
    expect(
      await db`select * from notification_business_event_proofs where event_key=${sharedKey}`,
    ).toHaveLength(1);
  });
  it("accepts signed Lovable ingress independently of the SDR enabled switch", async () => {
    await configure();
    const m = await envelope({ lovable: true });
    expect(await db`select id from wa_phone_numbers`).toHaveLength(0);
    expect(await db`select id from wa_business_accounts`).toHaveLength(0);
    expect((await sources()).payload.sources.map((s: { id: string }) => s.id)).not.toContain(
      m.source,
    );
    expect(await mint(m)).toBeNull();
    expect(await observe()).toBe(true);
    const listed = await sources();
    expect(listed.payload.sources).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: m.source })]),
    );
    const event = await mint(m);
    expect(event).not.toBeNull();
    expect((await db`select after from workflow_events where id=${event}`)[0].after.provider).toBe(
      "lovable",
    );
    expect(await eventCheck(event!)).toBe(true);
  });
  it("rejects historic, outbound, status and unverified incoming envelopes", async () => {
    await configure();
    for (const options of [
      { old: true },
      { outbound: true },
      { status: true },
      { noMarkers: true },
      { call: true },
    ])
      expect(await mint(await envelope(options))).toBeNull();
    expect(
      await db`select id from workflow_events where notification_event_key=${sharedKey}`,
    ).toHaveLength(0);
  });
  it("keeps preactivation and pre-reenable messages out of the queue", async () => {
    const old = await envelope();
    await configure();
    expect(await mint(old)).toBeNull();
    const m = await envelope();
    await db`update workflows set enabled=false where id=${wf}`;
    await db`update workflows set enabled=true where id=${wf}`;
    expect(await mint(m)).toBeNull();
    expect(await mint(await envelope())).not.toBeNull();
  });
  it("rejects account-number mismatches and readonly source mutations", async () => {
    for (const selection of [
      { source_keys: ["cloud:" + randomUUID()] },
      { phone_number_ids: ["999999999"] },
    ])
      await expect(configure(selection)).rejects.toMatchObject({ code: "42501" });
    for (const type of [
      "set_field",
      "assign_to",
      "send_whatsapp",
      "send_email",
      "sdr_agent",
      "associate_records",
    ])
      await expect(configure({}, [{ type }])).rejects.toMatchObject({ code: "42501" });
    await configure();
    const m = await envelope();
    expect(
      await withRole(
        "service_role",
        null,
        async (tx) =>
          (
            await tx`select sales_worker_authorize('workflows',${wf},${tx.json([{ workflow_version: 1 }, { record_table: "whatsapp_messages", id: m.message, action: "update" }])}) ok`
          )[0].ok,
      ),
    ).toBe(false);
  });
  it("forbids clients from minting or forging canonical WhatsApp events", async () => {
    await configure();
    const m = await envelope();
    expect(
      (
        await request("/rpc/notification_whatsapp_received", {
          p_message: m.message,
          p_webhook: m.webhook,
        })
      ).status,
    ).toBe(403);
    await expect(
      withRole(
        "service_role",
        null,
        async (tx) =>
          tx`insert into workflow_events(workspace_id,owner_id,entity,entity_id,notification_event_key,event_type,after) values(${W},${A},'whatsapp_messages',${m.message},${sharedKey},'updated',${tx.json({ body: "forged", id: m.message })})`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("delivers to the conversation assignee without a creator or CEO fallback", async () => {
    const rules = [{ kind: "source_responsible" }];
    await configure({}, [
      {
        type: "send_notification",
        title: noticeTitle,
        recipients: rules,
        delivery: { channels: ["inapp"], fallback: "none" },
      },
    ]);
    const m = await envelope(),
      event = await mint(m);
    expect(await eventCheck(event!)).toBe(true);
    await dispatch(event!, rules);
    expect(await db`select user_id,link from notifications where title=${noticeTitle}`).toEqual([
      { user_id: U, link: "/inbox/whatsapp?conversation=" + m.conversation },
    ]);
    await db`update whatsapp_conversations set assigned_to=null where id=${m.conversation}`;
    const next = await envelope();
    await db`update whatsapp_conversations set assigned_to=null where id=${next.conversation}`;
    await dispatch((await mint(next))!, rules);
    expect(await db`select id from notifications where title=${noticeTitle}`).toHaveLength(1);
  });
  it("reuses the existing unread Inbox notice in both dispatchers and the delivery ledger", async () => {
    const rules = [{ kind: "source_responsible" }],
      delivery = { channels: ["inapp"], fallback: "none" };
    await configure({}, [
      { type: "send_notification", title: noticeTitle, recipients: rules, delivery },
    ]);
    const m = await envelope(),
      event = (await mint(m))!,
      legacy = randomUUID();
    await db`insert into notifications(id,workspace_id,owner_id,user_id,type,title,body,link,entity,entity_id)
      values(${legacy},${W},${W},${U},'message','Nova mensagem na Inbox','Aviso existente','/inbox/whatsapp','inbox_conversation',${m.conversation})`;
    expect(await dispatch(event, rules)).toMatchObject({ sent: 0, duplicate: 1 });
    expect(
      await db`select notification_id,event_key from notification_delivery_intents where workflow_id=${wf}`,
    ).toEqual([{ notification_id: legacy, event_key: sharedKey }]);
    expect(await db`select id from notifications where user_id=${U}`).toEqual([{ id: legacy }]);
    const [run] =
      await db`select id from workflow_runs where workflow_id=${wf} and event_id=${event}`;
    expect(
      await withRole(
        "service_role",
        null,
        async (tx) =>
          (
            await tx`select notification_workflow_dispatch(${wf},${run.id},1,'whatsapp_messages',${m.message},${tx.json(rules)},${noticeTitle},null,'0') r`
          )[0].r,
      ),
    ).toMatchObject({ sent: 0, duplicate: 1 });
    expect(
      (
        await db`select event_key from notification_workspace_context where notification_id=${legacy}`
      )[0].event_key,
    ).toBe(sharedKey);
    const listed = await request("/rpc/notification_center_list", {
      p_workspace: W,
      p_category: "message",
    });
    expect(listed.status).toBe(200);
    expect(listed.payload.items.map((x: { id: string }) => x.id)).toContain(legacy);
  });
  it("revalidates a disconnected Cloud account and an archived Lovable account before dispatch", async () => {
    const rules = [{ kind: "source_responsible" }];
    await configure({}, [
      {
        type: "send_notification",
        title: noticeTitle,
        recipients: rules,
        delivery: { channels: ["inapp"], fallback: "none" },
      },
    ]);
    const cloud = await envelope(),
      first = (await mint(cloud))!;
    expect(await eventCheck(first)).toBe(true);
    await db`update wa_cloud_connections set enabled=false where id=${X}`;
    expect(await eventCheck(first)).toBe(false);
    await expect(dispatch(first)).rejects.toMatchObject({ code: "42501" });
    await db`update wa_cloud_connections set enabled=true where id=${X}`;
    const lovable = await envelope({ lovable: true });
    expect(await observe()).toBe(true);
    const second = (await mint(lovable))!;
    expect(await eventCheck(second)).toBe(true);
    await db`update service_channel_accounts set archived_at=clock_timestamp() where id=${lovable.source.slice(8)}`;
    expect(await eventCheck(second)).toBe(false);
    await expect(dispatch(second)).rejects.toMatchObject({ code: "42501" });
    expect(await db`select id from notifications`).toHaveLength(0);
  });
  it("intersects two real account and number filters and invalidates an older published version", async () => {
    const registry = await envelope({ lovable: true });
    expect(await observe()).toBe(true);
    await expect(
      configure({ source_keys: [cloudSource], phone_number_ids: ["987654321"] }),
    ).rejects.toMatchObject({ code: "42501" });
    await configure({ source_keys: [cloudSource, registry.source], phone_number_ids: [sender] });
    expect(await mint(await envelope({ lovable: true }))).toBeNull();
    const allowed = await envelope(),
      event = (await mint(allowed))!;
    expect(await eventCheck(event)).toBe(true);
    await db`update workflows set published_version=2,last_published_at=clock_timestamp() where id=${wf}`;
    expect(await eventCheck(event)).toBe(false);
    const fresh = (await mint(await envelope()))!;
    expect(
      await withRole(
        "service_role",
        null,
        async (tx) =>
          (await tx`select notification_business_event_check(${fresh},${wf},2) ok`)[0].ok,
      ),
    ).toBe(true);
    expect(
      await withRole(
        "service_role",
        null,
        async (tx) =>
          (await tx`select notification_business_event_check(${event},${wf},2) ok`)[0].ok,
      ),
    ).toBe(false);
  });
  it("preserves a canonical resume proof and rejects altered payloads or hashes", async () => {
    await configure();
    const m = await envelope(),
      parent = (await mint(m))!,
      run = randomUUID(),
      child = randomUUID();
    await db`insert into workflow_runs(id,workspace_id,owner_id,workflow_id,event_id,entity,entity_id) values(${run},${W},${A},${wf},${parent},'whatsapp_messages',${m.message})`;
    await withRole(
      "service_role",
      null,
      (
        tx,
      ) => tx`insert into workflow_events(id,workspace_id,owner_id,entity,entity_id,event_type,before,after,notification_event_key,notification_parent_event_id,resume_workflow_id,workflow_version,resume_cursor)
      select ${child},workspace_id,owner_id,entity,entity_id,event_type,before,after,notification_event_key,id,${wf},1,1 from workflow_events where id=${parent}`,
    );
    expect(await eventCheck(child)).toBe(true);
    await expect(
      withRole(
        "service_role",
        null,
        (
          tx,
        ) => tx`insert into workflow_events(id,workspace_id,owner_id,entity,entity_id,event_type,before,after,notification_event_key,notification_parent_event_id,resume_workflow_id,workflow_version,resume_cursor)
      select gen_random_uuid(),workspace_id,owner_id,entity,entity_id,event_type,before,after||'{"source_key":"cloud:forged"}'::jsonb,notification_event_key,id,${wf},1,2 from workflow_events where id=${parent}`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await db`update notification_business_event_proofs set payload_hash='forged-private-hash' where event_id=${parent}`;
    expect(await eventCheck(parent)).toBe(false);
    expect(await eventCheck(child)).toBe(false);
  });
  it("keeps the new notice in the message category and hides it when source access is revoked", async () => {
    const rules = [{ kind: "source_responsible" }];
    await configure({}, [
      {
        type: "send_notification",
        title: noticeTitle,
        recipients: rules,
        delivery: { channels: ["inapp"], fallback: "none" },
      },
    ]);
    const event = (await mint(await envelope()))!;
    await dispatch(event, rules);
    const listed = await request("/rpc/notification_center_list", {
      p_workspace: W,
      p_category: "message",
      p_module: "crm",
    });
    expect(listed.status).toBe(200);
    expect(listed.payload.items).toHaveLength(1);
    expect(listed.payload.items[0]).toMatchObject({
      title: noticeTitle,
      moduleKey: "crm",
      entity: "whatsapp_messages",
    });
    await db`update job_role_permission_overrides set effect='deny' where role_id=${ROLE} and permission_key='techsales.inbox.whatsapp.view.workspace'`;
    const denied = await request("/rpc/notification_center_list", {
      p_workspace: W,
      p_category: "message",
    });
    expect(denied.status).toBe(200);
    expect(denied.payload.items).toHaveLength(0);
  });
  it("queues a neutral consented external delivery and fails closed if the receiving account disconnects", async () => {
    const rules = [{ kind: "source_responsible" }],
      delivery = { channels: ["email"], fallback: "none" };
    await save();
    await db`update profiles set notification_preferences='{"message":{"email":true}}' where id=${U}`;
    await configure({}, [
      { type: "send_notification", title: noticeTitle, recipients: rules, delivery },
    ]);
    const event = (await mint(await envelope()))!;
    expect(await dispatch(event, rules, delivery)).toMatchObject({ queued: 1 });
    const [intent] =
      await db`select id,payload_content_neutral from notification_delivery_intents where workflow_id=${wf}`;
    expect(intent.payload_content_neutral).toMatchObject({
      title: "Atualização no TechERP",
      body: "Consulte a central de notificações do TechERP.",
    });
    expect(JSON.stringify(intent.payload_content_neutral)).not.toContain("Private customer");
    const [job] =
      await db`select id from workflow_deliveries where notification_intent_id=${intent.id}`;
    const claimed = await claim(job.id);
    expect(claimed).toMatchObject({ result: "claimed" });
    expect(await preflight(job.id, claimed.token)).toMatchObject({ allowed: true });
    await db`update wa_cloud_connections set enabled=false where id=${X}`;
    expect(await preflight(job.id, claimed.token)).toMatchObject({ allowed: false });
  });
  it("rejects a persisted message that does not match the signed sender", async () => {
    await configure();
    const m = await envelope();
    await db`update whatsapp_messages set from_number='+5548999990002' where id=${m.message}`;
    expect(await mint(m)).toBeNull();
    await db`update whatsapp_messages set from_number='+5548999990000' where id=${m.message}`;
    await db`update whatsapp_conversations set contact_phone='+5548999990003' where id=${m.conversation}`;
    expect(await mint(m)).toBeNull();
  });

  it("preserves policy-bound OIDs and shows only authorized WhatsApp events and runs through HTTP", async () => {
    const rules = [{ kind: "source_responsible" }];
    await configure({}, [
      {
        type: "send_notification",
        title: noticeTitle,
        recipients: rules,
        delivery: { channels: ["inapp"], fallback: "none" },
      },
    ]);
    const m = await envelope(),
      event = (await mint(m))!;
    await dispatch(event);
    const [bound] =
      await db`select count(*)::integer n from pg_depend d join pg_policy p on d.classid='pg_policy'::regclass and p.oid=d.objid where d.refclassid='pg_proc'::regclass and d.refobjid='public.sales_event_reference_access(text,uuid)'::regprocedure and p.polrelid in('workflow_events'::regclass,'workflow_runs'::regclass)`;
    expect(bound.n).toBeGreaterThanOrEqual(2);
    expect(await request("/workflow_events?id=eq." + event + "&select=id,after")).toMatchObject({
      status: 200,
      payload: [{ id: event, after: { source_key: cloudSource } }],
    });
    expect(
      (await request("/workflow_runs?workflow_id=eq." + wf + "&select=id")).payload,
    ).toHaveLength(1);
    expect(
      (await request("/workflow_events?id=eq." + event + "&select=id", undefined, F)).payload,
    ).toEqual([]);
    await db`update job_role_permission_overrides set effect='deny' where role_id=${ROLE} and permission_key='techsales.inbox.whatsapp.view.workspace'`;
    expect((await request("/workflow_events?id=eq." + event + "&select=id")).payload).toEqual([]);
    expect((await request("/workflow_runs?workflow_id=eq." + wf + "&select=id")).payload).toEqual(
      [],
    );
  });
  it("matches canonical Brazilian mobile variants in both directions without turning a fixed line into a mobile", async () => {
    await configure();
    for (const [raw, persisted] of [
      ["554899990000", "+5548999990000"],
      ["5548999990000", "+554899990000"],
      ["554830121055", "+554830121055"],
    ]) {
      const m = await envelope();
      await db`update whatsapp_webhook_events set payload=jsonb_set(payload,'{entry,0,changes,0,value,messages,0,from}',${db.json(raw)}) where id=${m.webhook}`;
      await db`update whatsapp_messages set from_number=${persisted},raw=jsonb_set(raw,'{from}',${db.json(raw)}) where id=${m.message}`;
      await db`update whatsapp_conversations set contact_phone=${persisted} where id=${m.conversation}`;
      expect(await mint(m)).not.toBeNull();
    }
    const fixed = await envelope();
    await db`update whatsapp_webhook_events set payload=jsonb_set(payload,'{entry,0,changes,0,value,messages,0,from}','"554830121055"') where id=${fixed.webhook}`;
    await db`update whatsapp_messages set from_number='+5548930121055' where id=${fixed.message}`;
    await db`update whatsapp_conversations set contact_phone='+5548930121055' where id=${fixed.conversation}`;
    expect(await mint(fixed)).toBeNull();
  });
  it("keeps the proof valid after authorized reassignment and resolves only the current conversation assignee", async () => {
    const rules = [{ kind: "source_responsible" }];
    await configure({}, [
      {
        type: "send_notification",
        title: noticeTitle,
        recipients: rules,
        delivery: { channels: ["inapp"], fallback: "none" },
      },
    ]);
    const m = await envelope(),
      event = (await mint(m))!;
    await db`update whatsapp_conversations set assigned_to=${C} where id=${m.conversation}`;
    expect(await eventCheck(event)).toBe(true);
    await dispatch(event);
    expect(await db`select user_id from notifications where title=${noticeTitle}`).toEqual([
      { user_id: C },
    ]);
    expect(
      (await db`select after from workflow_events where id=${event}`)[0].after.assigned_to,
    ).toBe(U);
  });
  it("rejects minting in a readonly role session and never exposes private proof tables", async () => {
    await configure();
    const m = await envelope(),
      session = randomUUID();
    await db`insert into view_as_sessions(session_id,mode) values(${session},'role')`;
    await expect(
      withRole(
        "service_role",
        null,
        (tx) => tx`select notification_whatsapp_received(${m.message},${m.webhook})`,
        { session_id: session },
      ),
    ).rejects.toMatchObject({ code: "42501" });
    expect((await request("/notification_whatsapp_activations?select=*")).status).toBe(403);
    expect((await request("/notification_business_event_proofs?select=*")).status).toBe(403);
    expect(
      await db`select id from workflow_events where notification_event_key=${sharedKey}`,
    ).toHaveLength(0);
  });
  it("reserves gateway observations to the service without exposing its private binding", async () => {
    await envelope({ lovable: true });
    const args = { p_phone: "987654321", p_display: "+55 (48) 6136-9999" };
    expect((await request("/rpc/notification_whatsapp_gateway_observe", args)).status).toBe(403);
    expect(
      (await request("/rpc/notification_whatsapp_gateway_observe", args, U, fixtureJwt("anon")))
        .status,
    ).toBe(401);
    expect(
      (
        await request(
          "/rpc/notification_whatsapp_gateway_observe",
          args,
          U,
          fixtureJwt("service_role", U),
        )
      ).status,
    ).toBe(403);
    const authorized = await request(
      "/rpc/notification_whatsapp_gateway_observe",
      args,
      U,
      fixtureJwt("service_role"),
    );
    expect(authorized).toEqual({ status: 200, payload: true });
    const [binding] =
      await db`select workspace_id,phone_number_id,display_phone_number from notification_whatsapp_gateway_binding`;
    expect(binding).toEqual({
      workspace_id: W,
      phone_number_id: "987654321",
      display_phone_number: "+554861369999",
    });
    for (const role of ["authenticated", "anon", "service_role"] as const)
      expect(
        (
          await request(
            "/notification_whatsapp_gateway_binding?select=*",
            undefined,
            U,
            fixtureJwt(role, role === "authenticated" ? U : undefined),
          )
        ).status,
      ).toBe(role === "anon" ? 401 : 403);
    for (const [phone, display] of [
      [null, "+554861369999"],
      ["987654321", null],
      ["not-an-id", "+554861369999"],
      ["987654321", "not a phone"],
    ])
      await expect(observe(phone, display)).rejects.toMatchObject({ code: "22023" });
  });
  it("uses the observed Lovable account and number filters without any optional WABA mirrors", async () => {
    const registry = await envelope({ lovable: true });
    expect(await observe()).toBe(true);
    await configure({ source_keys: [registry.source], phone_number_ids: ["987654321"] });
    expect(await mint(await envelope())).toBeNull();
    const inbound = await envelope({ lovable: true }),
      event = (await mint(inbound))!;
    expect(event).not.toBeNull();
    expect(await eventCheck(event)).toBe(true);
    const [row] = await db`select after from workflow_events where id=${event}`;
    expect(row.after).toMatchObject({
      source_key: registry.source,
      phone_number_id: "987654321",
      provider: "lovable",
    });
    expect(Object.keys(row.after).sort()).toEqual(
      [
        "id",
        "workspace_id",
        "owner_id",
        "conversation_id",
        "direction",
        "source_key",
        "phone_number_id",
        "provider",
        "occurred_at",
        "message_type",
        "assigned_to",
      ].sort(),
    );
    expect(JSON.stringify(row.after)).not.toContain("Private customer");
    expect(await db`select id from wa_phone_numbers`).toHaveLength(0);
    expect(await db`select id from wa_business_accounts`).toHaveLength(0);
  });
  it("invalidates existing Lovable proofs when the SDK connection is unavailable or unmapped", async () => {
    await configure();
    const m = await envelope({ lovable: true });
    expect(await observe()).toBe(true);
    const event = (await mint(m))!;
    expect(await eventCheck(event)).toBe(true);
    expect(await observe(null, null)).toBe(false);
    expect(await eventCheck(event)).toBe(false);
    expect(await db`select singleton from notification_whatsapp_gateway_binding`).toHaveLength(0);
    expect(await observe()).toBe(true);
    expect(await eventCheck(event)).toBe(true);
    expect(await observe("246813579", "+554830121055")).toBe(false);
    expect(await eventCheck(event)).toBe(false);
    expect((await sources()).payload.sources.map((s: { id: string }) => s.id)).not.toContain(
      m.source,
    );
    expect(await db`select id from wa_phone_numbers`).toHaveLength(0);
  });
  it("fails closed on the same Lovable source key registered in another tenant", async () => {
    await configure();
    const m = await envelope({ lovable: true });
    expect(await observe()).toBe(true);
    const event = (await mint(m))!,
      other = randomUUID();
    expect(await eventCheck(event)).toBe(true);
    await db`insert into service_channel_accounts(id,workspace_id,channel,source_key,label) values(${other},${B},'whatsapp','987654321','Other tenant account')`;
    expect(await eventCheck(event)).toBe(false);
    expect((await sources()).payload.sources.map((s: { id: string }) => s.id)).not.toContain(
      m.source,
    );
    expect(await observe()).toBe(false);
    expect(await db`select singleton from notification_whatsapp_gateway_binding`).toHaveLength(0);
    await db`update service_channel_accounts set archived_at=clock_timestamp() where id=${other}`;
    expect(await observe()).toBe(true);
    expect(await eventCheck(event)).toBe(true);
  });
  it("derives the gateway workspace only from the unique registry and never from a persisted message", async () => {
    await configure();
    const m = await envelope({ lovable: true });
    expect(await observe()).toBe(true);
    const event = (await mint(m))!;
    await db`update service_channel_accounts set archived_at=clock_timestamp() where id=${m.source.slice(8)}`;
    const foreign = randomUUID();
    await db`insert into service_channel_accounts(id,workspace_id,channel,source_key,label) values(${foreign},${B},'whatsapp','987654321','Foreign registry owner')`;
    expect(await observe()).toBe(true);
    expect(
      (await db`select account_id,workspace_id from notification_whatsapp_gateway_binding`)[0],
    ).toEqual({ account_id: foreign, workspace_id: B });
    expect(await eventCheck(event)).toBe(false);
    expect(await mint(m)).toBeNull();
    expect(
      (await sources()).payload.sources.every((s: { id: string }) => !s.id.startsWith("lovable:")),
    ).toBe(true);
  });
  it("rejects a gateway phone already owned by a Cloud account in any workspace", async () => {
    await configure();
    const m = await envelope({ lovable: true });
    expect(await observe()).toBe(true);
    const event = (await mint(m))!,
      connection = randomUUID();
    expect(await eventCheck(event)).toBe(true);
    await db`insert into wa_cloud_connections(id,workspace_id,enabled,webhook_verified_at) values(${connection},${B},true,now())`;
    await db`insert into wa_cloud_numbers(phone_number_id,connection_id,workspace_id,display_phone_number,status,available) values('987654321',${connection},${B},'+554861369999','CONNECTED',true)`;
    expect(await eventCheck(event)).toBe(false);
    expect(await observe()).toBe(false);
    expect((await sources()).payload.sources.map((s: { id: string }) => s.id)).not.toContain(
      m.source,
    );
  });
  it("uses optional mirrors only to reject contradictory tenant display or signed WABA identities", async () => {
    await configure();
    const m = await envelope({ lovable: true });
    expect(await observe()).toBe(true);
    const event = (await mint(m))!,
      business = randomUUID(),
      number = randomUUID();
    expect(await eventCheck(event)).toBe(true);
    await db`insert into wa_business_accounts(id,workspace_id,waba_id,status) values(${business},${W},'98765432101','disconnected')`;
    await db`insert into wa_phone_numbers(id,workspace_id,waba_id,phone_number_id,display_phone_number) values(${number},${W},${business},'987654321','+554861369999')`;
    // SDK status remains authoritative: a stale mirror status does not block it.
    expect(await eventCheck(event)).toBe(true);
    await db`update wa_business_accounts set waba_id='11111111111' where id=${business}`;
    expect(await eventCheck(event)).toBe(false);
    await db`update wa_business_accounts set waba_id='98765432101' where id=${business}`;
    await db`update wa_phone_numbers set display_phone_number='+554861369998' where id=${number}`;
    expect(await eventCheck(event)).toBe(false);
    await db`update wa_phone_numbers set display_phone_number='+554861369999',workspace_id=${B} where id=${number}`;
    expect(await eventCheck(event)).toBe(false);
    await db`delete from wa_phone_numbers where id=${number}`;
    await db`delete from wa_business_accounts where id=${business}`;
    expect(await eventCheck(event)).toBe(true);
  });
  it("replaces a previously observed gateway phone and blocks its old occurrence", async () => {
    await configure();
    const m = await envelope({ lovable: true });
    expect(await observe()).toBe(true);
    const event = (await mint(m))!,
      replacement = randomUUID();
    expect(await eventCheck(event)).toBe(true);
    await db`insert into service_channel_accounts(id,workspace_id,channel,source_key,label) values(${replacement},${W},'whatsapp','246813579','Replacement gateway')`;
    expect(await observe("246813579", "+554830121055")).toBe(true);
    expect(await eventCheck(event)).toBe(false);
    const listed = (await sources()).payload.sources;
    expect(listed.map((s: { id: string }) => s.id)).not.toContain(m.source);
    expect(listed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "lovable:" + replacement,
          numbers: [{ id: "246813579", label: "Replacement gateway", phone: "+554830121055" }],
        }),
      ]),
    );
    expect(await db`select singleton from notification_whatsapp_gateway_binding`).toHaveLength(1);
  });
});
