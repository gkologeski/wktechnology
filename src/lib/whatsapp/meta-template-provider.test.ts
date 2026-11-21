import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ single: vi.fn(), decrypt: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mocks.single }) }) }) }),
  },
}));
vi.mock("@/lib/ai/provider-resolver.server", () => ({ decryptApiKey: mocks.decrypt }));
import {
  allProviderTemplates,
  safeTemplateProviderError,
  templateProvider,
  uploadTemplateBytes,
} from "./meta-template-provider.server";
import { MetaCloudError } from "./cloud-api.server";
import type { MetaTemplateTarget } from "./meta-template-types";
const target: MetaTemplateTarget = {
  id: "cloud:11111111-1111-4111-8111-111111111111",
  provider: "cloud",
  label: "Test account",
  wabaId: "1234512345",
  enabled: true,
  numbers: [{ id: "9876598765", phone: "+554800000000", label: "Test sender" }],
};
const credentials = { accessToken: "server-only-template-access-token", apiVersion: "v27.0" };
let network: ReturnType<typeof vi.fn>;
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  network = vi.fn();
  vi.stubGlobal("fetch", network);
  mocks.single.mockResolvedValue({
    data: {
      id: target.id.slice(6),
      waba_id: target.wabaId,
      enabled: true,
      api_version: "v27.0",
      credentials_ciphertext: "not-for-client",
    },
    error: null,
  });
  mocks.decrypt.mockResolvedValue(JSON.stringify({ accessToken: credentials.accessToken }));
  vi.stubEnv("LOVABLE_API_KEY", "server-lovable-key");
  vi.stubEnv("WHATSAPP_API_KEY", "server-connection-key");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("Meta template provider transport", () => {
  it("uses the authorized WABA and an exact template id on deletion without credentials in URLs", async () => {
    const provider = await templateProvider("workspace", target);
    network.mockResolvedValue(response({ success: true }));
    await provider.remove("5678956789", "monthly_update");
    const [url, init] = network.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://graph.facebook.com");
    expect(parsed.pathname).toBe("/v27.0/1234512345/message_templates");
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      hsm_id: "5678956789",
      name: "monthly_update",
    });
    expect(init.method).toBe("DELETE");
    expect(init.headers.Authorization).toBe(`Bearer ${credentials.accessToken}`);
    expect(String(url)).not.toContain(credentials.accessToken);
    expect(init.redirect).toBe("manual");
    expect(network).toHaveBeenCalledTimes(1);
  });
  it("does not follow pagination URLs returned by a provider", async () => {
    const provider = await templateProvider("workspace", target);
    network
      .mockResolvedValueOnce(
        response({
          data: [],
          paging: {
            next: "https://evil.invalid?access_token=stolen",
            cursors: { after: "cursor&x=evil" },
          },
        }),
      )
      .mockResolvedValueOnce(response({ data: [] }));
    await allProviderTemplates(provider);
    expect(network).toHaveBeenCalledTimes(2);
    expect(new URL(network.mock.calls[1][0]).origin).toBe("https://graph.facebook.com");
    expect(new URL(network.mock.calls[1][0]).searchParams.get("after")).toBe("cursor&x=evil");
    expect(JSON.stringify(network.mock.calls.map(([url]) => String(url)))).not.toContain(
      "evil.invalid",
    );
  });
  it("fails on repeated or incomplete pagination instead of returning a partial catalogue", async () => {
    const provider = await templateProvider("workspace", target);
    network.mockImplementation(async () =>
      response({ data: [], paging: { next: "ignored", cursors: { after: "repeat" } } }),
    );
    await expect(allProviderTemplates(provider)).rejects.toThrow("repetiu o cursor");
    expect(network).toHaveBeenCalledTimes(2);
    network.mockResolvedValue(response({ data: [], paging: { next: "ignored" } }));
    await expect(provider.page()).rejects.toThrow("página incompleta");
  });
  it("binds the global Lovable connector to the registered workspace phone before reading models", async () => {
    const legacy = {
      ...target,
      id: "lovable:11111111-1111-4111-8111-111111111111",
      provider: "lovable" as const,
      wabaId: null,
    };
    network.mockResolvedValue(response({ id: "foreign123" }));
    await expect(templateProvider("workspace", legacy)).rejects.toThrow("não corresponde");
    expect(network).toHaveBeenCalledTimes(1);
    expect(network.mock.calls[0][0]).toBe(
      "https://connector-gateway.lovable.dev/whatsapp/phone_number?fields=id",
    );
  });
  it("uses documented name-wide deletion and never pretends Lovable can edit in place", async () => {
    const legacy = {
      ...target,
      id: "lovable:11111111-1111-4111-8111-111111111111",
      provider: "lovable" as const,
      wabaId: null,
    };
    network
      .mockResolvedValueOnce(response({ id: target.numbers[0].id }))
      .mockResolvedValueOnce(response({ success: true }));
    const provider = await templateProvider("workspace", legacy);
    await expect(provider.update("5678956789", {})).rejects.toThrow("não edita");
    await provider.remove("5678956789", "customer_notice");
    expect(network.mock.calls[1][0]).toBe(
      "https://connector-gateway.lovable.dev/whatsapp/message_templates?name=customer_notice",
    );
    expect(network.mock.calls[1][1].method).toBe("DELETE");
    expect(network).toHaveBeenCalledTimes(2);
  });
  it("rejects foreign or disabled Cloud connection metadata before decrypting secrets", async () => {
    mocks.single.mockResolvedValue({ data: { waba_id: "foreign", enabled: true }, error: null });
    await expect(templateProvider("workspace", target)).rejects.toThrow("indisponível");
    expect(mocks.decrypt).not.toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
    mocks.single.mockResolvedValue({
      data: { waba_id: target.wabaId, enabled: false },
      error: null,
    });
    await expect(templateProvider("workspace", target)).rejects.toThrow("indisponível");
  });
  it("redacts provider bodies and marks an unknown mutation as uncertain without retrying", async () => {
    const provider = await templateProvider("workspace", target);
    network.mockResolvedValue(
      response(
        {
          error: {
            code: 200,
            message: "secret-provider-value",
            access_token: "token-never-visible",
          },
        },
        403,
      ),
    );
    let failure: unknown;
    try {
      await provider.create({ name: "test" });
    } catch (error) {
      failure = error;
    }
    const safe = safeTemplateProviderError(failure, true);
    expect(safe.message).toContain("whatsapp_business_management");
    expect(safe.message).not.toMatch(/secret-provider-value|token-never-visible/);
    expect(network).toHaveBeenCalledTimes(1);
    expect(safeTemplateProviderError(new Error("raw-secret"), true)).toMatchObject({
      uncertain: true,
    });
    expect(safeTemplateProviderError(new MetaCloudError(503), true)).toMatchObject({
      uncertain: true,
    });
  });
  it("uploads selected bytes through an opaque signed session and checks access before both writes", async () => {
    network
      .mockResolvedValueOnce(response({ id: "upload:QXBwVXBsb2Fk?sig=opaqueSignature" }))
      .mockResolvedValueOnce(response({ h: "opaque-media-handle" }));
    const before = vi.fn().mockResolvedValue(undefined),
      bytes = new Uint8Array([137, 80, 78, 71]);
    expect(
      await uploadTemplateBytes(credentials, "1234512345", bytes, "image/png", "png", before),
    ).toBe("opaque-media-handle");
    expect(before).toHaveBeenCalledTimes(2);
    expect(network).toHaveBeenCalledTimes(2);
    expect(network.mock.calls[0][0].pathname).toBe("/v27.0/1234512345/uploads");
    const [url, init] = network.mock.calls[1];
    expect(url.origin).toBe("https://graph.facebook.com");
    expect(url.pathname).toBe("/v27.0/upload:QXBwVXBsb2Fk");
    expect(url.searchParams.get("sig")).toBe("opaqueSignature");
    expect(init.headers.Authorization).toBe(`OAuth ${credentials.accessToken}`);
    expect(init.headers.file_offset).toBe("0");
    expect(init.body).toEqual(bytes);
    expect(String(url)).not.toContain(credentials.accessToken);
  });
  it("refuses unsafe upload sessions and revocation between upload steps", async () => {
    network.mockResolvedValueOnce(response({ id: "upload:../other?access_token=bad" }));
    await expect(
      uploadTemplateBytes(
        credentials,
        "1234512345",
        new Uint8Array([1]),
        "image/png",
        "png",
        async () => {},
      ),
    ).rejects.toThrow("segura");
    expect(network).toHaveBeenCalledTimes(1);
    network.mockClear().mockResolvedValue(response({ id: "upload:opaque?sig=safe" }));
    const before = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("revoked"));
    await expect(
      uploadTemplateBytes(
        credentials,
        "1234512345",
        new Uint8Array([1]),
        "image/png",
        "png",
        before,
      ),
    ).rejects.toThrow("revoked");
    expect(network).toHaveBeenCalledTimes(1);
  });
});
