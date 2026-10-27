import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  enabled: true,
  processed: false,
  calls: [] as any[],
  storage: [] as any[],
}));
const processEvent = vi.hoisted(() => vi.fn());
vi.mock("./webhook-processor.server", () => ({ processEvent }));
vi.mock("@/lib/ai/provider-resolver.server", () => ({
  decryptApiKey: async () =>
    JSON.stringify({ appSecret: "test-app-secret", verifyToken: "verify-test" }),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from(table: string) {
      let updating = false;
      const query: any = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          state.calls.push([table, key, value]);
          return query;
        },
        update: () => {
          updating = true;
          return query;
        },
        upsert: (value: unknown) => {
          state.storage.push(value);
          return query;
        },
        maybeSingle: () => query,
        single: () => query,
        then: (resolve: any) =>
          resolve({
            error: null,
            data: updating
              ? {}
              : table === "wa_cloud_connections"
                ? {
                    id: "cc000000-0000-4000-8000-000000000001",
                    workspace_id: "wk",
                    waba_id: "123456",
                    enabled: state.enabled,
                    credentials_ciphertext: "cipher",
                  }
                : table === "wa_cloud_numbers"
                  ? [{ phone_number_id: "654321" }]
                  : { id: "event", processed_at: state.processed ? "2026-01-01" : null },
          }),
      };
      return query;
    },
  },
}));
import { handleCloudWebhook } from "./cloud-webhook.server";
const id = "cc000000-0000-4000-8000-000000000001";
const base = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "123456",
      changes: [
        {
          field: "messages",
          value: {
            metadata: { phone_number_id: "654321" },
            messages: [
              { id: "message", from: "5548991104003", type: "text", text: { body: "oi" } },
            ],
          },
        },
      ],
    },
  ],
};
async function signed(payload: unknown) {
  const body = JSON.stringify(payload);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("test-app-secret"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)),
  );
  const signature = `sha256=${Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("")}`;
  return new Request("https://example.test/webhook", {
    method: "POST",
    body,
    headers: { "x-hub-signature-256": signature },
  });
}
beforeEach(() => {
  state.enabled = true;
  state.processed = false;
  state.calls = [];
  state.storage = [];
  processEvent.mockReset();
});
describe("cloud webhook boundary", () => {
  it("cloud webhook allows signed mapped workspace", async () => {
    expect((await handleCloudWebhook(await signed(base), id)).status).toBe(200);
    expect(processEvent).toHaveBeenCalledTimes(1);
    expect(state.storage[0].payload.entry[0].changes[0].value._verified_workspace_id).toBe("wk");
  });
  it("cloud webhook rejects missing signature", async () => {
    expect(
      (
        await handleCloudWebhook(
          new Request("https://example.test", { method: "POST", body: JSON.stringify(base) }),
          id,
        )
      ).status,
    ).toBe(401);
    expect(processEvent).not.toHaveBeenCalled();
  });
  it("cloud webhook rejects invalid verification token", async () => {
    expect(
      (
        await handleCloudWebhook(
          new Request(
            "https://example.test/?hub.mode=subscribe&hub.challenge=1&hub.verify_token=wrong",
          ),
          id,
        )
      ).status,
    ).toBe(403);
    expect(state.storage).toHaveLength(0);
  });
  it("cloud webhook rejects foreign account", async () => {
    const payload = structuredClone(base);
    payload.entry[0].id = "foreign";
    expect((await handleCloudWebhook(await signed(payload), id)).status).toBe(403);
    expect(state.storage).toHaveLength(0);
  });
  it("cloud webhook keeps disabled connection dormant", async () => {
    state.enabled = false;
    expect((await handleCloudWebhook(await signed(base), id)).status).toBe(200);
    expect(state.storage).toHaveLength(1);
    expect(processEvent).not.toHaveBeenCalled();
  });
  it("cloud webhook rejects a phone belonging to another connection", async () => {
    const payload = structuredClone(base);
    payload.entry[0].changes[0].value.metadata.phone_number_id = "other";
    expect((await handleCloudWebhook(await signed(payload), id)).status).toBe(403);
  });
  it("cloud webhook does not reprocess completed delivery", async () => {
    state.processed = true;
    expect((await handleCloudWebhook(await signed(base), id)).status).toBe(200);
    expect(processEvent).not.toHaveBeenCalled();
  });
  it("cloud webhook returns exact challenge for valid capability", async () => {
    const response = await handleCloudWebhook(
      new Request(
        "https://example.test/?hub.mode=subscribe&hub.challenge=123&hub.verify_token=verify-test",
      ),
      id,
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("123");
  });
});
