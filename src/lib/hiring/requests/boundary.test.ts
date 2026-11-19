import { it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertPreparation } from "./boundary.server";
vi.mock("@/lib/access-control/enforce.server", () => ({
  getActiveWorkspaceId: vi.fn(async () => "workspace"),
}));
function client(allowed: boolean) {
  return { rpc: vi.fn(async () => ({ data: allowed, error: null })) } as unknown as SupabaseClient;
}
it("preparation boundary permits allowed actor", async () => {
  expect(await assertPreparation(client(true), "actor", "professional", "view")).toBe("workspace");
});
it("preparation boundary denies absent key", async () => {
  await expect(assertPreparation(client(false), "actor", "professional", "view")).rejects.toThrow(
    "Sem permissão",
  );
});
it("preparation boundary denies explicit deny", async () => {
  await expect(assertPreparation(client(false), "actor", "supplier", "create")).rejects.toThrow(
    "Sem permissão",
  );
});
it("preparation boundary denies foreign workspace", async () => {
  await expect(assertPreparation(client(false), "actor", "supplier", "update")).rejects.toThrow(
    "Sem permissão",
  );
});
it("preparation boundary denies inactive member", async () => {
  await expect(assertPreparation(client(false), "actor", "professional", "cancel")).rejects.toThrow(
    "Sem permissão",
  );
});
