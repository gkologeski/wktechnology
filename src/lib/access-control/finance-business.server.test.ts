import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authorizeFinanceBusiness } from "./finance-business.server";
it.each([null, false, true, {}, "", "workspace"])(
  "malformed authorization cannot unlock Finance: %s",
  async (data) => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data, error: null }),
    } as unknown as SupabaseClient;
    await expect(authorizeFinanceBusiness(client, "reports")).rejects.toThrow("autorizar");
  },
);
it("passes record action through the caller and preserves database errors", async () => {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "denied" } }),
    client = { rpc } as unknown as SupabaseClient;
  await expect(authorizeFinanceBusiness(client, "invoices", "update", "record")).rejects.toThrow(
    "denied",
  );
  expect(rpc).toHaveBeenCalledWith("finance_business_authorize", {
    _resource: "invoices",
    _action: "update",
    _id: "record",
  });
  expect(rpc.mock.contexts).toEqual([client]);
});
