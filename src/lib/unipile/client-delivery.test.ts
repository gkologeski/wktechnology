import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  insert: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { rpc: mocks.rpc, from: () => ({ update: mocks.update, insert: mocks.insert }) },
}));
import { sendLinkedinMessage, fetchProfile, verifyApiKey } from "./client.server";
const ctx = { accountId: "account", ownerId: "owner", unipileAccountId: "provider" };
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("UNIPILE_API_KEY", "test-key");
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.update.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockResolvedValue({ error: null });
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
  expect(mocks.update.mock.calls[0][0].last_error).toBe("provider_limit");
  expect(mocks.rpc.mock.calls[1][1].p_status).toBe("not_started");
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
