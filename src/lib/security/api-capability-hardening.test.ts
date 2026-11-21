import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  key: null as null | Record<string, unknown>,
  member: null as null | { status: string },
  update: vi.fn(),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        update: (value: unknown) => {
          state.update(value);
          return chain;
        },
        maybeSingle: async () => ({
          data: table === "api_keys" ? state.key : state.member,
          error: null,
        }),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ error: null }).then(resolve),
      };
      return chain;
    },
  },
}));
import { authenticateApiKey, requireScope } from "@/lib/api-keys/auth.server";
beforeEach(() => {
  vi.clearAllMocks();
  state.key = {
    id: "key",
    owner_id: "actor",
    workspace_id: "workspace",
    scopes: ["write"],
    revoked_at: null,
    expires_at: null,
  };
  state.member = { status: "active" };
});
const request = () =>
  new Request("https://app.example.invalid", {
    headers: { authorization: "Bearer lvb_synthetic-test-key" },
  });
it("API capability permits a live key and active membership", async () => {
  expect(await authenticateApiKey(request())).toEqual({
    keyId: "key",
    ownerId: "actor",
    workspaceId: "workspace",
    scopes: ["write"],
  });
  expect(state.update).toHaveBeenCalledOnce();
});
it("API capability rejects missing key", async () => {
  expect(await authenticateApiKey(new Request("https://app.example.invalid"))).toBeNull();
  expect(state.update).not.toHaveBeenCalled();
});
it("API capability rejects revoked permission and denied scopes", async () => {
  if (!state.key) throw new Error("Missing fixture");
  state.key["revoked_at"] = "2026-01-01T00:00:00Z";
  expect(await authenticateApiKey(request())).toBeNull();
  expect(
    requireScope(
      { keyId: "key", ownerId: "actor", workspaceId: "workspace", scopes: ["read"] },
      "write",
    )?.status,
  ).toBe(403);
  expect(state.update).not.toHaveBeenCalled();
});
it("API capability rejects absent membership in the key workspace", async () => {
  state.member = null;
  expect(await authenticateApiKey(request())).toBeNull();
  expect(state.update).not.toHaveBeenCalled();
});
it("API capability rejects inactive membership", async () => {
  state.member = { status: "inactive" };
  expect(await authenticateApiKey(request())).toBeNull();
  expect(state.update).not.toHaveBeenCalled();
});
