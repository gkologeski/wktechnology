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
  expect(mock.rpc).toHaveBeenCalledWith("unipile_receive_message", {
    p_account: "local-account",
    p_message: "message",
    p_chat: "chat",
    p_sender: "person",
    p_body: "Podemos conversar?",
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
