import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  insert: vi.fn(),
  fetch: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: mocks.rpc,
    from: () => ({ update: mocks.update, insert: mocks.insert, select: mocks.select }),
  },
}));
import {
  sendLinkedinMessage,
  sendLinkedinChatReply,
  listLinkedinChats,
  getLinkedinChatMessage,
  normalizeSendMessageResult,
  fetchProfile,
  verifyApiKey,
} from "./client.server";
const ctx = { accountId: "account", ownerId: "owner", unipileAccountId: "provider" };
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("UNIPILE_API_KEY", "test-key");
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.update.mockReturnValue({ eq: mocks.eq });
  const chain = {
    eq: mocks.eq,
    select: mocks.select,
    maybeSingle: mocks.maybeSingle,
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
  };
  mocks.eq.mockReturnValue(chain);
  mocks.select.mockReturnValue(chain);
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  mocks.update.mockImplementation(() => ({
    ...chain,
    eq: () => ({
      ...chain,
      eq: () => ({
        ...chain,
        eq: () => ({
          ...chain,
          select: () => ({ maybeSingle: async () => ({ data: { id: "receipt" }, error: null }) }),
        }),
      }),
    }),
  }));
  mocks.insert.mockResolvedValue({ error: null });
  mocks.rpc.mockImplementation(async (name) => ({
    data:
      name === "unipile_delivery_begin"
        ? { ok: true, id: "receipt", token: "lease" }
        : { ok: true },
    error: null,
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("reserves a durable delivery before the provider request and confirms the receipt", async () => {
  mocks.fetch.mockResolvedValue(Response.json({ id: "message" }));
  await sendLinkedinMessage(ctx, {
    attendeeProviderId: "recipient",
    text: "Hello",
    requestKey: "step",
  });
  expect(mocks.rpc.mock.calls[0][0]).toBe("unipile_delivery_begin");
  expect(mocks.rpc.mock.calls[0][1].p_key).toMatch(/^[a-f0-9]{64}$/);
  expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.fetch.mock.invocationCallOrder[0],
  );
  expect(mocks.rpc.mock.calls[1][1].p_status).toBe("sent");
  expect(mocks.fetch.mock.calls[0][1].redirect).toBe("manual");
  expect(mocks.fetch.mock.calls[0][0]).toContain("/provider/inboxes/CLASSIC_PRIMARY/chats/send");
  expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toEqual({
    users_ids: "recipient",
    text: "Hello",
  });
});
it("returns a confirmed receipt without sending again", async () => {
  mocks.rpc.mockResolvedValue({
    data: { ok: true, cached: true, response: { id: "already-sent" } },
    error: null,
  });
  await expect(
    sendLinkedinMessage(ctx, { attendeeProviderId: "recipient", text: "Hello" }),
  ).resolves.toEqual({ id: "already-sent" });
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("records a timeout as uncertain rather than safe to retry", async () => {
  mocks.fetch.mockRejectedValue(new Error("timeout"));
  await expect(
    sendLinkedinMessage(ctx, { attendeeProviderId: "recipient", text: "Hello" }),
  ).rejects.toThrow("timeout");
  expect(mocks.rpc.mock.calls[1][1].p_status).toBe("uncertain");
});
it("blocks an uncertain previous delivery before contacting Unipile", async () => {
  mocks.rpc.mockResolvedValue({ data: { ok: false, reason: "delivery_uncertain" }, error: null });
  await expect(
    sendLinkedinMessage(ctx, { attendeeProviderId: "recipient", text: "Hello" }),
  ).rejects.toMatchObject({ code: "delivery_uncertain" });
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("persists a provider pause and records explicit rejection as not started", async () => {
  mocks.fetch.mockResolvedValue(
    new Response("limit", { status: 429, headers: { "retry-after": "120" } }),
  );
  await expect(
    sendLinkedinMessage(ctx, { attendeeProviderId: "recipient", text: "Hello" }),
  ).rejects.toMatchObject({ code: "rate_limited" });
  expect(mocks.update).toHaveBeenCalledWith(
    expect.objectContaining({ last_error: "provider_limit" }),
  );
  expect(mocks.rpc.mock.calls[1][1].p_status).toBe("not_started");
});
it("records the canonical body and exact chat before contacting the provider", async () => {
  mocks.fetch.mockResolvedValue(Response.json({ id: "reply" }));
  await sendLinkedinChatReply(ctx, { chatId: "a/b", text: "Actual reply", requestKey: "one" });
  expect(mocks.update).toHaveBeenCalledWith({
    inbox_request: {
      endpoint: "message.send",
      body: "Actual reply",
      chat_id: "a/b",
      request_fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      attempt_key: "one",
    },
  });
  expect(mocks.update.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.fetch.mock.invocationCallOrder[0] ?? 0,
  );
});
it("blocks sending when canonical request persistence fails", async () => {
  const chain = {
    eq: () => chain,
    select: () => chain,
    maybeSingle: async () => ({ data: null, error: { message: "unavailable" } }),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ error: { message: "unavailable" } }).then(resolve),
  };
  mocks.update.mockReturnValue(chain);
  await expect(
    sendLinkedinChatReply(ctx, { chatId: "chat", text: "Reply", requestKey: "one" }),
  ).rejects.toMatchObject({ code: "delivery_uncertain" });
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("same explicit attempt has one identity even with changed content, and divergent reuse is rejected", async () => {
  mocks.fetch.mockResolvedValue(Response.json({ id: "reply" }));
  await sendLinkedinChatReply(ctx, { chatId: "chat", text: "Reply", requestKey: "attempt" });
  const key = mocks.rpc.mock.calls[0]?.[1]?.p_key;
  const metadata = mocks.update.mock.calls[0]?.[0]?.inbox_request;
  expect(key).toMatch(/^[a-f0-9]{64}$/);
  expect(metadata.request_fingerprint).toMatch(/^[a-f0-9]{64}$/);
  mocks.maybeSingle.mockResolvedValue({
    data: { id: "receipt", inbox_request: metadata },
    error: null,
  });
  for (const changed of [
    { text: "Different" },
    { chatId: "another-chat" },
    { attachments: [{ filename: "file", content_type: "text/plain", data: "changed" }] },
  ])
    await expect(
      sendLinkedinChatReply(ctx, {
        chatId: "chat",
        text: "Reply",
        requestKey: "attempt",
        ...changed,
      }),
    ).rejects.toMatchObject({ code: "invalid_parameters" });
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
});
it("identical content in a new explicit attempt has an independent key; retries remain cached", async () => {
  mocks.fetch.mockImplementation(async () => Response.json({ id: "reply" }));
  await sendLinkedinChatReply(ctx, { chatId: "chat", text: "Reply", requestKey: "one" });
  await sendLinkedinChatReply(ctx, { chatId: "chat", text: "Reply", requestKey: "two" });
  const keys = mocks.rpc.mock.calls
    .filter(([n]) => n === "unipile_delivery_begin")
    .map(([, v]) => v.p_key);
  expect(keys).toHaveLength(2);
  expect(keys[0]).not.toBe(keys[1]);
  mocks.rpc.mockResolvedValue({
    data: { ok: true, cached: true, response: { id: "reply" } },
    error: null,
  });
  await sendLinkedinChatReply(ctx, { chatId: "chat", text: "Reply", requestKey: "two" });
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
});
it("preserves a legacy content-bound receipt without creating a new attempt", async () => {
  mocks.maybeSingle
    .mockResolvedValueOnce({ data: null, error: null })
    .mockResolvedValueOnce({ data: { id: "legacy" }, error: null });
  mocks.rpc.mockResolvedValue({
    data: { ok: true, cached: true, response: { id: "legacy-message" } },
    error: null,
  });
  expect(
    await sendLinkedinChatReply(ctx, {
      chatId: "chat",
      text: "Reply",
      requestKey: "legacy-attempt",
    }),
  ).toEqual({ id: "legacy-message" });
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("does not call the provider when a read budget is exhausted", async () => {
  mocks.rpc.mockResolvedValue({ data: { ok: false, reason: "daily_limit" }, error: null });
  await expect(fetchProfile(ctx, "recipient")).rejects.toMatchObject({ code: "rate_limited" });
  expect(mocks.fetch).not.toHaveBeenCalled();
});

it("credential validation never redirects the API key", async () => {
  mocks.fetch.mockResolvedValue(new Response("redirect", { status: 302 }));
  await expect(verifyApiKey()).resolves.toMatchObject({ ok: false, status: 302 });
  expect(mocks.fetch.mock.calls[0][1].redirect).toBe("manual");
  expect(mocks.fetch.mock.calls[0][1].signal).toBeDefined();
});

it("never treats a chat identifier as a confirmed message receipt", () => {
  expect(normalizeSendMessageResult({ object: "Chat", id: "chat-only" })).toEqual({
    messageId: null,
    chatId: "chat-only",
  });
  expect(normalizeSendMessageResult({ chat_id: "chat-only" })).toEqual({
    messageId: null,
    chatId: "chat-only",
  });
});
it("replies to the exact chat with a stable operation key", async () => {
  mocks.fetch.mockResolvedValue(Response.json({ id: "reply" }));
  await sendLinkedinChatReply(ctx, {
    chatId: "existing/chat",
    text: "Teste",
    requestKey: "stable-key",
  });
  expect(mocks.fetch.mock.calls[0][0]).toContain("/provider/chats/existing%2Fchat/messages/send");
  expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toMatchObject({ text: "Teste" });
});

it("lists personal LinkedIn chats through its Classic inbox", async () => {
  mocks.fetch.mockResolvedValue(Response.json({ data: [] }));
  await listLinkedinChats(ctx, { limit: 20 });
  expect(mocks.fetch.mock.calls[0][0]).toContain(
    "/provider/inboxes/CLASSIC_PRIMARY/chats?limit=20",
  );
});
it("normalizes the ChatStarted receipt confirmed by the provider", () => {
  expect(
    normalizeSendMessageResult({
      object: "ChatStarted",
      chat_id: "CLASSIC_chat",
      message_id: "CLASSIC_message",
    }),
  ).toEqual({ chatId: "CLASSIC_chat", messageId: "CLASSIC_message" });
});

it("hydrates only the exact opaque chat and message identifiers", async () => {
  mocks.fetch.mockResolvedValue(Response.json({ id: "message" }));
  await getLinkedinChatMessage(ctx, { chatId: "CLASSIC_a/b=", messageId: "CLASSIC_m/=" });
  expect(mocks.fetch.mock.calls[0][0]).toContain(
    "/provider/chats/CLASSIC_a%2Fb%3D/messages/CLASSIC_m%2F%3D",
  );
  expect(mocks.rpc.mock.calls[0][0]).toBe("unipile_request_reserve");
});
