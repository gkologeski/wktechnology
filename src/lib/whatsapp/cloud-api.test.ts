import { afterEach, describe, expect, it, vi } from "vitest";
import { cloudList, cloudRequest, verifyMetaSignature, MetaCloudError } from "./cloud-api.server";

const credentials = { accessToken: "secret-test-token", apiVersion: "v23.0" };
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("Meta official transport", () => {
  it("uses only the selected Meta object and bearer header", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ messages: [{ id: "m1" }] }));
    vi.stubGlobal("fetch", fetcher);
    await cloudRequest(credentials, "123456", "messages", {
      method: "POST",
      body: { to: "5548991104003" },
    });
    expect(String(fetcher.mock.calls[0][0])).toBe(
      "https://graph.facebook.com/v23.0/123456/messages",
    );
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe("Bearer secret-test-token");
    expect(fetcher.mock.calls[0][1].redirect).toBe("manual");
  });
  it.each([301, 302, 303, 307, 308])(
    "rejects redirect %s without forwarding credentials",
    async (status) => {
      const fetcher = vi.fn(async (_url, options) => {
        if (options.redirect !== "manual") throw new Error("Unsupported edge redirect mode");
        return new Response("secret-test-token", {
          status,
          headers: { Location: "https://evil.invalid" },
        });
      });
      vi.stubGlobal("fetch", fetcher);
      await expect(cloudRequest(credentials, "123456", "phone_numbers")).rejects.toThrow(
        `Meta Cloud API: falha ${status}.`,
      );
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it("rejects object path injection before sending credentials", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(cloudRequest(credentials, "../me?access_token=x", "messages")).rejects.toThrow(
      "inválido",
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not expose provider error text or retry a rejected send", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({ error: { message: "secret-test-token", code: 131049 } }, { status: 400 }),
      );
    vi.stubGlobal("fetch", fetcher);
    await expect(
      cloudRequest(credentials, "123456", "messages", { method: "POST" }),
    ).rejects.toThrow("131049");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(["7200", "86400", "99999", "3600.5"])(
    "preserves the complete Retry-After %s on a structured provider refusal",
    async (retryAfter) => {
      const fetcher = vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: { code: 130429, message: "secret-test-token" } },
            { status: 400, headers: { "Retry-After": retryAfter } },
          ),
        );
      vi.stubGlobal("fetch", fetcher);
      const error = await cloudRequest(credentials, "123456", "messages", {
        method: "POST",
      }).catch((error: unknown) => error);
      expect(error).toBeInstanceOf(MetaCloudError);
      expect(error).toMatchObject({
        status: 400,
        code: 130429,
        retryAfterSeconds: Math.ceil(Number(retryAfter)),
      });
      expect(String(error)).not.toContain("secret-test-token");
      expect(fetcher).toHaveBeenCalledOnce();
    },
  );

  it("supports the HTTP-date Retry-After without capping the provider cooldown", async () => {
    const now = Date.parse("2026-11-20T12:00:00Z");
    vi.spyOn(Date, "now").mockReturnValue(now);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("not json", {
          status: 429,
          headers: { "Retry-After": new Date(now + 7200_000).toUTCString() },
        }),
      ),
    );
    await expect(
      cloudRequest(credentials, "123456", "messages", { method: "POST" }),
    ).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: 7200,
    });
  });

  it.each(["", "invalid", "-1", "Infinity", "Thu, 01 Jan 1970 00:00:00 GMT"])(
    "ignores an unusable Retry-After %s without exposing its contents",
    async (retryAfter) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          Response.json(
            { error: { code: 130429 } },
            {
              status: 429,
              headers: { "Retry-After": retryAfter },
            },
          ),
        ),
      );
      await expect(
        cloudRequest(credentials, "123456", "messages", { method: "POST" }),
      ).rejects.toMatchObject({
        status: 429,
        retryAfterSeconds: undefined,
      });
    },
  );
  it("paginates with cursors without fetching a foreign URL", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          data: [{ id: 1 }],
          paging: { next: "https://evil.invalid/?token=secret", cursors: { after: "cursor" } },
        }),
      )
      .mockResolvedValueOnce(Response.json({ data: [{ id: 2 }] }));
    vi.stubGlobal("fetch", fetcher);
    expect(await cloudList(credentials, "123456", "phone_numbers", "id")).toEqual([
      { id: 1 },
      { id: 2 },
    ]);
    expect(String(fetcher.mock.calls[1][0])).toContain("graph.facebook.com");
    expect(String(fetcher.mock.calls[1][0])).toContain("after=cursor");
  });
  it("rejects incomplete pagination instead of removing missing numbers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ data: [], paging: { next: "next" } })),
    );
    await expect(cloudList(credentials, "123456", "phone_numbers", "id")).rejects.toThrow(
      "incompleta",
    );
  });
  it("authenticates exact webhook bytes and rejects tampering", async () => {
    const raw = new TextEncoder().encode('{"object":"whatsapp_business_account"}');
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("app-secret"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signed = new Uint8Array(await crypto.subtle.sign("HMAC", key, raw));
    const signature = `sha256=${Array.from(signed, (b) => b.toString(16).padStart(2, "0")).join("")}`;
    expect(await verifyMetaSignature(raw, signature, "app-secret")).toBe(true);
    expect(
      await verifyMetaSignature(new TextEncoder().encode("tampered"), signature, "app-secret"),
    ).toBe(false);
    expect(await verifyMetaSignature(raw, null, "app-secret")).toBe(false);
    expect(await verifyMetaSignature(raw, signature, "wrong-secret")).toBe(false);
  });
});
