import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
const mock = vi.hoisted(() => ({ account: vi.fn(), rpc: vi.fn(), load: vi.fn(), get: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: unknown) => options }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mock.account }) }) }),
    rpc: mock.rpc,
  },
}));
vi.mock("./client.server", () => ({ loadAccountCtx: mock.load, getLinkedinChatMessage: mock.get }));
import { parseUnipileWebhook, hydrateV2Message } from "./webhook-events.server";
import { Route } from "@/routes/api/public/unipile/webhook";
const event = () => ({
  type: "message.new",
  account_id: "acc_owner",
  payload: {
    object: "Message",
    id: "message",
    chat_id: "chat",
    sender_id: "person",
    text: "Podemos conversar?",
    is_sender: false,
    timestamp: "2026-11-21T23:30:00.000Z",
  },
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("UNIPILE_WEBHOOK_SECRET", "test-endpoint-key");
  mock.account.mockResolvedValue({
    data: {
      id: "local-account",
      owner_id: "owner",
      workspace_id: "workspace",
      status: "connected",
    },
    error: null,
  });
  mock.rpc.mockResolvedValue({ data: { duplicate: false }, error: null });
  mock.load.mockResolvedValue({ accountId: "local-account", unipileAccountId: "acc_owner" });
  mock.get.mockResolvedValue(event().payload);
});
afterEach(() => vi.unstubAllEnvs());
async function receive(payload: unknown, key = "test-endpoint-key") {
  const body = JSON.stringify(payload),
    t = Math.floor(Date.now() / 1000),
    signature = `t=${t},v0=${createHmac("sha256", key).update(`${t}.${body}`).digest("hex")}`;
  return (Route as any).server.handlers.POST({
    request: new Request("https://app.example/api/public/unipile/webhook", {
      method: "POST",
      headers: { "unipile-signature": signature },
      body,
    }),
  });
}
it("parses the documented v2 message.new envelope and Message payload", () => {
  const parsed = parseUnipileWebhook(event());
  expect(parsed).toMatchObject({
    kind: "message_received",
    unipileAccountId: "acc_owner",
    message: {
      messageId: "message",
      chatId: "chat",
      senderProviderId: "person",
      text: "Podemos conversar?",
      isSelfSent: false,
      needsHydration: false,
    },
  });
});
it("recognizes sent messages inside the v2 payload as echoes", () => {
  const e = event();
  e.payload.is_sender = true;
  expect(parseUnipileWebhook(e).message?.isSelfSent).toBe(true);
});
it("retains legacy message_received ingestion", () => {
  expect(
    parseUnipileWebhook({
      event: "message_received",
      account_id: "acc_owner",
      message_id: "message",
      chat_id: "chat",
      sender: { provider_id: "person" },
      text: "Resposta",
    }),
  ).toMatchObject({
    kind: "message_received",
    message: { senderProviderId: "person", text: "Resposta" },
  });
});
it("does not classify read receipts or message updates as replies", () => {
  for (const type of ["message.receipt.read", "message.update", "message.delete"])
    expect(parseUnipileWebhook({ ...event(), type }).kind).toBe("unknown");
});
it("marks removal as disconnection and never treats it as enrollment", () =>
  expect(parseUnipileWebhook({ type: "account.remove", account_id: "acc_owner" }).kind).toBe(
    "account_disconnected",
  ));
it("persists a signed v2 inbound through the private deduplicating journal", async () => {
  expect((await receive(event())).status).toBe(200);
  expect(mock.rpc).toHaveBeenCalledWith("unipile_signed_inbound_commit", {
    p_account: "local-account",
    p_message: "message",
    p_chat: "chat",
    p_sender: "person",
    p_body: "Podemos conversar?",
    p_envelope_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    p_occurred: "2026-11-21T23:30:00.000Z",
    p_live: true,
    p_self: false,
  });
  expect(mock.get).not.toHaveBeenCalled();
});
it("never enqueues an outgoing echo as a customer reply", async () => {
  const e = event();
  e.payload.is_sender = true;
  expect((await receive(e)).status).toBe(200);
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("rejects an invalid signature before account lookup or message ingestion", async () => {
  expect((await receive(event(), "foreign-secret")).status).toBe(401);
  expect(mock.account).not.toHaveBeenCalled();
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("hydrates a reduced event using its exact account, chat and message", async () => {
  const e = event();
  delete (e.payload as any).sender_id;
  expect((await receive(e)).status).toBe(200);
  expect(mock.load).toHaveBeenCalledWith("owner", "workspace");
  expect(mock.get).toHaveBeenCalledWith(
    { accountId: "local-account", unipileAccountId: "acc_owner" },
    { chatId: "chat", messageId: "message" },
  );
});
it("refuses hydration without a known chat or with a replaced account", async () => {
  expect(await hydrateV2Message("acc_owner", "message", null)).toBeNull();
  expect(mock.get).not.toHaveBeenCalled();
  mock.load.mockResolvedValue({ unipileAccountId: "other" });
  expect(await hydrateV2Message("acc_owner", "message", "chat")).toBeNull();
  expect(mock.get).not.toHaveBeenCalled();
});
it("refuses provider hydration from another message or conversation", async () => {
  mock.get.mockResolvedValue({ ...event().payload, id: "another-message" });
  expect(await hydrateV2Message("acc_owner", "message", "chat")).toBeNull();
  mock.get.mockResolvedValue({ ...event().payload, chat_id: "another-chat" });
  expect(await hydrateV2Message("acc_owner", "message", "chat")).toBeNull();
});
it("returns retryable failure instead of acknowledging a message not persisted", async () => {
  mock.rpc.mockResolvedValue({ data: null, error: { message: "database unavailable" } });
  expect((await receive(event())).status).toBe(503);
});

it("pauses a locked provider account without mistaking history sync failure for a disconnection", () => {
  expect(parseUnipileWebhook({ type: "account.locked", account_id: "acc_owner" }).kind).toBe(
    "account_failed",
  );
  expect(
    parseUnipileWebhook({ type: "account.initial_sync.failed", account_id: "acc_owner" }).kind,
  ).toBe("unknown");
});

it("persists signed history without promoting it to a live occurrence", async () => {
  await receive({ ...event(), is_history: true });
  expect(mock.rpc).toHaveBeenCalledWith(
    "unipile_signed_inbound_commit",
    expect.objectContaining({ p_live: false }),
  );
  expect(parseUnipileWebhook({ ...event(), is_history: "true" }).message?.live).toBe(false);
});

it("uses the confirmed message timestamp from exact provider hydration, not local time", async () => {
  const e = event();
  delete (e.payload as Partial<typeof e.payload>).timestamp;
  delete (e.payload as Partial<typeof e.payload>).sender_id;
  await receive(e);
  expect(mock.get).toHaveBeenCalled();
  expect(mock.rpc).toHaveBeenCalledWith(
    "unipile_signed_inbound_commit",
    expect.objectContaining({ p_live: true, p_occurred: "2026-11-21T23:30:00.000Z" }),
  );
});

it("normalizes a signed seconds timestamp without guessing a local time", () => {
  const payload = { ...event(), payload: { ...event().payload, timestamp: 1795303800 } };
  expect(parseUnipileWebhook(payload).message?.occurredAt).toBe(
    new Date(1795303800000).toISOString(),
  );
});

it("does not promote a malformed provider timestamp", () => {
  expect(
    parseUnipileWebhook({ ...event(), payload: { ...event().payload, timestamp: "not-a-date" } })
      .message?.occurredAt,
  ).toBeNull();
});

it("never uses the v2 envelope creation date or timestamp as the message date", async () => {
  const payload = {
    type: "message.new",
    account_id: "acc_owner",
    created_at: "2026-11-22T00:28:00Z",
    timestamp: "2026-11-22T00:28:00Z",
    payload: { ...event().payload, timestamp: undefined, created_at: "2026-11-22T00:28:00Z" },
  };
  expect(parseUnipileWebhook(payload).message?.occurredAt).toBeNull();
  mock.get.mockResolvedValue({ ...event().payload, timestamp: undefined });
  await receive(payload);
  expect(mock.rpc).toHaveBeenCalledWith(
    "unipile_signed_inbound_commit",
    expect.objectContaining({ p_occurred: null, p_live: false }),
  );
});
it("recognizes v1 sent messages by documented account_info and attendee_provider_id", async () => {
  const payload = {
    event: "message_received",
    account_id: "acc_owner",
    account_info: { user_id: "person" },
    sender: { attendee_provider_id: "person" },
    message_id: "message",
    chat_id: "chat",
    message: "Sent from another device",
    timestamp: "2026-11-21T23:30:00Z",
  };
  expect(parseUnipileWebhook(payload).message).toMatchObject({
    isSelfSent: true,
    senderProviderId: "person",
    occurredAt: "2026-11-21T23:30:00.000Z",
  });
  expect((await receive(payload)).status).toBe(200);
  expect(mock.rpc).not.toHaveBeenCalled();
  expect(mock.get).not.toHaveBeenCalled();
});
it("requires provider hydration when message.new omits direction, even with a body", async () => {
  const payload = { ...event(), payload: { ...event().payload, is_sender: undefined } };
  mock.get.mockResolvedValue({ ...event().payload, is_sender: true });
  expect((await receive(payload)).status).toBe(200);
  expect(mock.get).toHaveBeenCalled();
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("fails closed when hydration cannot establish sent or received direction", async () => {
  const payload = { ...event(), payload: { ...event().payload, is_sender: undefined } };
  mock.get.mockResolvedValue({ ...event().payload, is_sender: undefined });
  expect((await receive(payload)).status).toBe(503);
  expect(mock.rpc).not.toHaveBeenCalled();
});
it.each(["2026-11-21T22:00:00.000Z", "2026-11-22T00:00:00.000Z"])(
  "retains original provider time across a reconnection envelope and replay: %s",
  async (timestamp) => {
    const payload = {
      ...event(),
      created_at: "2026-11-22T00:28:00Z",
      payload: { ...event().payload, timestamp },
    };
    await receive(payload);
    await receive({ ...payload, created_at: "2026-11-22T00:29:00Z" });
    expect(mock.rpc).toHaveBeenCalledTimes(2);
    for (const [name, args] of mock.rpc.mock.calls) {
      expect(name).toBe("unipile_signed_inbound_commit");
      expect(args).toMatchObject({ p_occurred: timestamp, p_self: false });
    }
  },
);
it("does not promote history during hydration even when the provider returns a recent message", async () => {
  await receive({
    ...event(),
    is_history: true,
    payload: { ...event().payload, sender_id: undefined, timestamp: undefined },
  });
  expect(mock.get).toHaveBeenCalled();
  expect(mock.rpc).toHaveBeenCalledWith(
    "unipile_signed_inbound_commit",
    expect.objectContaining({ p_live: false, p_occurred: "2026-11-21T23:30:00.000Z" }),
  );
});
