import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
const state = vi.hoisted(() => ({ enabled: true, available: true, optedOut: false }));
vi.mock("@/lib/ai/provider-resolver.server", () => ({
  decryptApiKey: async () => JSON.stringify({ accessToken: "test-token" }),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from(table: string) {
      const filters: Record<string, unknown> = {};
      const query: any = {
        select: () => query,
        update: () => query,
        eq: (key: string, value: unknown) => {
          filters[key] = value;
          return query;
        },
        in: () => query,
        not: () => query,
        limit: () => query,
        single: () => query,
        maybeSingle: () => query,
        then: (resolve: any) => {
          const allowed = filters.workspace_id === "wk";
          resolve({
            error: null,
            data:
              table === "wa_cloud_numbers"
                ? allowed && filters.phone_number_id === "654321"
                  ? {
                      phone_number_id: "654321",
                      connection_id: "connection",
                      display_phone_number: "+55 48 6136-5335",
                      available: state.available,
                    }
                  : null
                : table === "wa_cloud_connections"
                  ? allowed && filters.id === "connection"
                    ? {
                        id: "connection",
                        enabled: state.enabled,
                        webhook_verified_at: "verified",
                        api_version: "v23.0",
                        waba_id: "123456",
                        credentials_ciphertext: "cipher",
                      }
                    : null
                  : state.optedOut
                    ? [{ id: "optout" }]
                    : [],
          });
        },
      };
      return query;
    },
  },
}));
import { resolveCloudNumber, sendCloudPayload } from "./cloud-runtime.server";
beforeEach(() => {
  state.enabled = true;
  state.available = true;
  state.optedOut = false;
});
afterEach(() => vi.unstubAllGlobals());
describe("cloud runtime sender isolation", () => {
  it("cloud runtime allows mapped active workspace", async () => {
    expect(await resolveCloudNumber("wk", "654321")).toMatchObject({
      workspaceId: "wk",
      phoneNumberId: "654321",
      provider: "cloud",
      displayPhoneNumber: "+554861365335",
    });
  });
  it("cloud runtime rejects missing sender capability", async () => {
    await expect(sendCloudPayload("wk", "999999", {})).rejects.toThrow("não pertence");
  });
  it("cloud runtime rejects explicitly disabled connection", async () => {
    state.enabled = false;
    await expect(resolveCloudNumber("wk", "654321")).rejects.toThrow("indisponível");
  });
  it("cloud runtime rejects foreign workspace sender", async () => {
    expect(await resolveCloudNumber("foreign", "654321")).toBeNull();
    await expect(sendCloudPayload("foreign", "654321", {})).rejects.toThrow("não pertence");
  });
  it("cloud runtime rejects inactive number", async () => {
    state.available = false;
    await expect(resolveCloudNumber("wk", "654321")).rejects.toThrow("indisponível");
  });
  it("cloud runtime stops template on low quality without sending", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ data: [{ name: "hello", language: "pt_BR", status: "APPROVED" }] }),
      )
      .mockResolvedValueOnce(
        Response.json({ id: "654321", status: "CONNECTED", quality_rating: "RED" }),
      );
    vi.stubGlobal("fetch", fetcher);
    await expect(
      sendCloudPayload("wk", "654321", {
        to: "5548991104003",
        type: "template",
        template: { name: "hello", language: { code: "pt_BR" } },
      }),
    ).rejects.toThrow("suspensos");
    expect(fetcher.mock.calls.every((call) => call[1].method === "GET")).toBe(true);
  });
  it("cloud runtime honors opt-out across senders", async () => {
    state.optedOut = true;
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(
      sendCloudPayload("wk", "654321", { to: "5548991104003", type: "template" }),
    ).rejects.toThrow("descadastramento");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("cloud runtime sends reply to exactly the selected number", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ messages: [{ id: "confirmed" }] }));
    vi.stubGlobal("fetch", fetcher);
    expect(
      await sendCloudPayload("wk", "654321", {
        to: "5548991104003",
        type: "text",
        text: { body: "Resposta" },
      }),
    ).toMatchObject({ messages: [{ id: "confirmed" }] });
    expect(String(fetcher.mock.calls[0][0])).toBe(
      "https://graph.facebook.com/v23.0/654321/messages",
    );
  });
});
