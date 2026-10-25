import { afterEach, describe, expect, it, vi } from "vitest";
import { batchRead, getAssocMany, hsFetch } from "./hubspot-api.server";

afterEach(() => vi.unstubAllGlobals());
describe("HubSpot authorization at provider boundaries", () => {
  it("does not contact the provider when authorization is denied", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      hsFetch("/test", undefined, async () => {
        throw new Error("Sem permissão atual.");
      }),
    ).rejects.toThrow("permissão");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("revalidates between batches and does not swallow a revocation", async () => {
    vi.stubEnv("LOVABLE_API_KEY", "test");
    vi.stubEnv("HUBSPOT_API_KEY", "test");
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) });
    vi.stubGlobal("fetch", fetch);
    let calls = 0;
    await expect(
      batchRead(
        "contacts",
        Array.from({ length: 101 }, (_, i) => String(i)),
        ["email"],
        async () => {
          if (++calls > 1) throw new Error("Sem autorização atual.");
        },
      ),
    ).rejects.toThrow("autorização");
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.unstubAllEnvs();
  });
  it("never converts a permission failure into association fallback requests", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      getAssocMany("deals", ["1"], "contacts", 20, async () => {
        throw new Error("Sem permissão atual.");
      }),
    ).rejects.toThrow("permissão");
    expect(fetch).not.toHaveBeenCalled();
  });
});
