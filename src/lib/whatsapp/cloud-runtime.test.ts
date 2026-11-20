import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
const state = vi.hoisted(() => ({
  enabled: true,
  available: true,
  optedOut: false,
  cacheWriteError: false,
}));
vi.mock("@/lib/ai/provider-resolver.server", () => ({
  decryptApiKey: async () => JSON.stringify({ accessToken: "test-token" }),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from(table: string) {
      const filters: Record<string, unknown> = {};
      let updating = false;
      const query: any = {
        select: () => query,
        update: () => {
          updating = true;
          return query;
        },
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
            error:
              table === "wa_cloud_numbers" && updating && state.cacheWriteError
                ? { message: "cache unavailable" }
                : null,
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
import { MetaCloudError, MetaCloudPreflightError } from "./cloud-api.server";
beforeEach(() => {
  state.enabled = true;
  state.available = true;
  state.optedOut = false;
  state.cacheWriteError = false;
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

  it("fences a template POST after catalogue and quality reads when the worker lease expires", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ data: [{ name: "hello", language: "pt_BR", status: "APPROVED" }] }),
      )
      .mockResolvedValueOnce(
        Response.json({ id: "654321", status: "CONNECTED", quality_rating: "GREEN" }),
      );
    vi.stubGlobal("fetch", fetcher);
    const beforeSend = vi.fn(async () => {
      expect(fetcher).toHaveBeenCalledTimes(2);
      throw new Error("lease expired");
    });
    await expect(
      sendCloudPayload(
        "wk",
        "654321",
        {
          to: "+14155552671",
          type: "template",
          template: { name: "hello", language: { code: "pt_BR" } },
        },
        { beforeSend },
      ),
    ).rejects.toThrow("lease expired");
    expect(beforeSend).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls.every((call) => call[1].method === "GET")).toBe(true);
  });

  it("calls the worker guard exactly at the final provider POST boundary", async () => {
    let authorized = false;
    const methods: string[] = [];
    const fetcher = vi.fn(async (_url, options) => {
      methods.push(options.method);
      if (options.method === "POST") {
        expect(authorized).toBe(true);
        return Response.json({ messages: [{ id: "wamid.fake" }] });
      }
      return Response.json(
        methods.length === 1
          ? { data: [{ name: "hello", language: "pt_BR", status: "APPROVED" }] }
          : { id: "654321", status: "CONNECTED", quality_rating: "GREEN" },
      );
    });
    vi.stubGlobal("fetch", fetcher);
    await sendCloudPayload(
      "wk",
      "654321",
      {
        to: "+14155552671",
        type: "template",
        template: { name: "hello", language: { code: "pt_BR" } },
      },
      {
        beforeSend: async () => {
          expect(methods).toEqual(["GET", "GET"]);
          authorized = true;
        },
      },
    );
    expect(methods).toEqual(["GET", "GET", "POST"]);
  });

  it("passes the last live template, phone and connection to policy before final worker authorization", async () => {
    const template = {
      name: "notice",
      language: "pt_BR",
      status: "APPROVED",
      category: "UTILITY",
      components: [{ type: "BODY", text: "Neutral" }],
    };
    const phone = { id: "654321", status: "CONNECTED", quality_rating: "GREEN" };
    const order: string[] = [];
    const fetcher = vi.fn(async (_url, options) => {
      if (options.method === "POST") {
        order.push("POST");
        return Response.json({ messages: [{ id: "wamid.fake" }] });
      }
      return Response.json(order.length ? phone : { data: [template] });
    });
    fetcher.mockResolvedValueOnce(Response.json({ data: [template] }));
    fetcher.mockResolvedValueOnce(Response.json(phone));
    vi.stubGlobal("fetch", fetcher);
    const validateTemplate = vi.fn((snapshot) => {
      expect(snapshot).toEqual({ template, phone, connectionId: "connection" });
      expect(fetcher).toHaveBeenCalledTimes(2);
      order.push("policy");
    });
    await sendCloudPayload(
      "wk",
      "654321",
      {
        to: "+14155552671",
        type: "template",
        template: { name: "notice", language: { code: "pt_BR" } },
      },
      {
        validateTemplate,
        beforeSend: async () => {
          order.push("authorization");
        },
      },
    );
    expect(order).toEqual(["policy", "authorization", "POST"]);
    expect(new URL(String(fetcher.mock.calls[0][0])).searchParams.get("fields")).toContain(
      "category",
    );
  });

  it("does not rely on a successful quality cache write to enforce the live policy", async () => {
    state.cacheWriteError = true;
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          data: [{ name: "notice", language: "pt_BR", status: "APPROVED", category: "UTILITY" }],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ id: "654321", status: "CONNECTED", quality_rating: "YELLOW" }),
      );
    vi.stubGlobal("fetch", fetcher);
    const beforeSend = vi.fn();
    await expect(
      sendCloudPayload(
        "wk",
        "654321",
        {
          to: "+14155552671",
          type: "template",
          template: { name: "notice", language: { code: "pt_BR" } },
        },
        {
          beforeSend,
          validateTemplate: (snapshot) => {
            expect(snapshot.phone.quality_rating).toBe("YELLOW");
            throw new MetaCloudPreflightError("provider_rate_limited");
          },
        },
      ),
    ).rejects.toMatchObject({ reason: "provider_rate_limited" });
    expect(beforeSend).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.every((call) => call[1].method === "GET")).toBe(true);
  });

  it("distinguishes a read failure proven before POST from a later ambiguous transport error", async () => {
    const validateTemplate = vi.fn();
    const beforeSend = vi.fn();
    const body = {
      to: "+14155552671",
      type: "template",
      template: { name: "notice", language: { code: "pt_BR" } },
    };
    const fetcher = vi.fn().mockRejectedValueOnce(new TypeError("private preflight failure"));
    vi.stubGlobal("fetch", fetcher);
    const readError = await sendCloudPayload("wk", "654321", body, {
      validateTemplate,
      beforeSend,
    }).catch((error: unknown) => error);
    expect(readError).toBeInstanceOf(MetaCloudPreflightError);
    expect(readError).toMatchObject({ reason: "provider_preflight_unavailable" });
    expect(String(readError)).not.toContain("private");
    expect(beforeSend).not.toHaveBeenCalled();

    fetcher.mockResolvedValueOnce(
      Response.json({ data: [{ name: "notice", language: "pt_BR", status: "APPROVED" }] }),
    );
    fetcher.mockResolvedValueOnce(
      Response.json({ id: "654321", status: "CONNECTED", quality_rating: "GREEN" }),
    );
    fetcher.mockResolvedValueOnce(Response.json({ error: { code: 1 } }, { status: 503 }));
    const postError = await sendCloudPayload("wk", "654321", body, {
      validateTemplate,
      beforeSend,
    }).catch((error: unknown) => error);
    expect(postError).toBeInstanceOf(MetaCloudError);
    expect(postError).not.toBeInstanceOf(MetaCloudPreflightError);
    expect(beforeSend).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls.at(-1)![1].method).toBe("POST");
  });

  it("proves an opt-out before POST without calling the policy or worker guard", async () => {
    state.optedOut = true;
    const fetcher = vi.fn();
    const validateTemplate = vi.fn();
    const beforeSend = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(
      sendCloudPayload(
        "wk",
        "654321",
        { to: "+14155552671", type: "template" },
        { validateTemplate, beforeSend },
      ),
    ).rejects.toMatchObject({ reason: "recipient_suppressed" });
    expect(fetcher).not.toHaveBeenCalled();
    expect(validateTemplate).not.toHaveBeenCalled();
    expect(beforeSend).not.toHaveBeenCalled();
  });
});
