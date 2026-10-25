import { afterEach, expect, it, vi } from "vitest";
import { caFetchAll } from "./contaazul-api.server";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("stops Conta Azul before the provider when access is denied", async () => {
  vi.stubEnv("CONTAAZUL_CLIENT_ID", "test");
  vi.stubEnv("CONTAAZUL_CLIENT_SECRET", "test");
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(
    caFetchAll({
      accessToken: "test",
      path: "/test",
      authorize: async () => {
        throw new Error("Permissão revogada");
      },
    }),
  ).rejects.toThrow("Permissão");
  expect(fetch).not.toHaveBeenCalled();
});
it("rechecks Conta Azul between pages and stops on revocation", async () => {
  vi.stubEnv("CONTAAZUL_CLIENT_ID", "test");
  vi.stubEnv("CONTAAZUL_CLIENT_SECRET", "test");
  const fetch = vi
    .fn()
    .mockResolvedValue({ ok: true, text: async () => JSON.stringify([{ id: 1 }]) });
  vi.stubGlobal("fetch", fetch);
  let calls = 0;
  await expect(
    caFetchAll({
      accessToken: "test",
      path: "/test",
      pageSize: 1,
      authorize: async () => {
        if (++calls > 1) throw new Error("Permissão revogada");
      },
    }),
  ).rejects.toThrow("Permissão");
  expect(fetch).toHaveBeenCalledTimes(1);
});
