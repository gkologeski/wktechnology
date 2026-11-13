import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ensurePersonalScope, unipileAuthRequest } from "./auth-provider.server";
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("UNIPILE_API_KEY", "test-account-key");
  vi.stubEnv("UNIPILE_SERVICE_KEY", "test-service-key");
  vi.stubEnv("UNIPILE_API_BASE_URL", "https://api.unipile.com/v2");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
it("reuses only the exact active personal scope", async () => {
  fetchMock.mockResolvedValue(
    Response.json({
      items: [
        { id: "foreign", reference: "other", status: "active" },
        { id: "personal", reference: "reference", status: "active" },
      ],
    }),
  );
  expect(await ensurePersonalScope("reference")).toBe("personal");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][1].headers["X-API-KEY"]).toBe("test-service-key");
});
it("creates a missing scope with its exact reference", async () => {
  fetchMock
    .mockResolvedValueOnce(Response.json({ items: [] }))
    .mockResolvedValueOnce(Response.json({ id: "new", reference: "reference", status: "active" }));
  expect(await ensurePersonalScope("reference")).toBe("new");
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).reference).toBe("reference");
});
it("rejects a disabled scope instead of recreating or adopting it", async () => {
  fetchMock.mockResolvedValue(
    Response.json({ items: [{ id: "scope", reference: "reference", status: "disabled" }] }),
  );
  await expect(ensurePersonalScope("reference")).rejects.toThrow("indisponível");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it("never follows a redirect carrying the provider key", async () => {
  fetchMock.mockResolvedValue(
    new Response("", { status: 302, headers: { location: "https://elsewhere.test" } }),
  );
  await expect(unipileAuthRequest("/accounts/exact")).rejects.toThrow("302");
  expect(fetchMock.mock.calls[0][1].redirect).toBe("manual");
});
it("does not expose a provider response containing credentials", async () => {
  fetchMock.mockResolvedValue(new Response("private-value", { status: 401 }));
  await expect(unipileAuthRequest("/accounts/exact")).rejects.not.toThrow("private-value");
});
