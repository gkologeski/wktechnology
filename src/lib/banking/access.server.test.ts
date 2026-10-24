import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, it, vi } from "vitest";
import { bankingContext } from "./access.server";
it.each([false, true, null, {}, "not-a-workspace"])(
  "rejects malformed authorization results before privileged access: %s",
  async (data) => {
    const caller = {
      rpc: vi.fn().mockResolvedValue({ data, error: null }),
    } as unknown as SupabaseClient;
    await expect(bankingContext(caller, "execute", true)).rejects.toThrow("não autorizada");
  },
);
it("fails closed when the database is unavailable, without replacing caller identity", async () => {
  const caller = {
    rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "unavailable" } }),
  } as unknown as SupabaseClient;
  await expect(bankingContext(caller, "execute", true)).rejects.toThrow("unavailable");
});
it("keeps the caller-bound client for banking reads and resolves tenant from the database", async () => {
  const w = "aaaaaaaa-0000-4000-8000-00000000000a",
    rpc = vi.fn().mockResolvedValue({ data: w, error: null });
  const caller = { rpc } as unknown as SupabaseClient;
  expect(await bankingContext(caller, "view")).toEqual({ supabase: caller, workspaceId: w });
  expect(rpc.mock.calls).toEqual([["banking_authorize", { _action: "view" }]]);
  expect(rpc.mock.contexts).toEqual([caller]);
});
