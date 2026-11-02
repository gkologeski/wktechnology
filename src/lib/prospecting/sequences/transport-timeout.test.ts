import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
import { gmailSendRaw } from "@/lib/gmail.server";
import { gatewayFetch } from "@/lib/whatsapp/gateway-channel.server";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("outbound transport boundaries", () => {
  it("Gmail bounds the request and never follows a credential redirect", async () => {
    const fetcher = vi.fn(async () => Response.json({ id: "message", threadId: "thread" }));
    vi.stubGlobal("fetch", fetcher);
    await gmailSendRaw("fake-token", "MIME");
    expect(fetcher).toHaveBeenCalledOnce();
    const init = (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.redirect).toBe("manual");
  });
  it("an aborted Gmail send is surfaced once without an implicit retry", async () => {
    const fetcher = vi.fn(async () => {
      throw new DOMException("Timeout", "TimeoutError");
    });
    vi.stubGlobal("fetch", fetcher);
    await expect(gmailSendRaw("fake-token", "MIME")).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("official gateway uses a bounded request and keeps redirects manual", async () => {
    vi.stubEnv("LOVABLE_API_KEY", "fake-lovable");
    vi.stubEnv("WHATSAPP_API_KEY", "fake-connection");
    const fetcher = vi.fn(async () => Response.json({ messages: [{ id: "wamid" }] }));
    vi.stubGlobal("fetch", fetcher);
    await gatewayFetch("/messages", { method: "POST", body: "{}" });
    const init = (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.redirect).toBe("manual");
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
