import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertSalesRecord } from "@/lib/access-control/sales-core.server";

const ID = "00000000-0000-0000-0000-000000000001";
const authz = (data: unknown, message?: string) =>
  ({
    rpc: vi
      .fn()
      .mockResolvedValue(message ? { data: null, error: { message } } : { data, error: null }),
  }) as unknown as SupabaseClient;

describe("permissão de cancelamento da proposta", () => {
  it("proposal cancel permits an authorized active actor", async () => {
    const c = authz(true);
    await assertSalesRecord(c, "proposals", ID, "update");
    expect(c.rpc).toHaveBeenCalledWith("sales_record_access", {
      t: "proposals",
      i: ID,
      a: "update",
    });
  });
  it("proposal cancel rejects missing permission", async () => {
    await expect(assertSalesRecord(authz(false), "proposals", ID, "update")).rejects.toThrow();
  });
  it("proposal cancel rejects explicit deny", async () => {
    await expect(
      assertSalesRecord(authz(null, "explicit deny"), "proposals", ID, "update"),
    ).rejects.toThrow();
  });
  it("proposal cancel rejects a foreign workspace", async () => {
    await expect(
      assertSalesRecord(authz(null, "foreign workspace"), "proposals", ID, "update"),
    ).rejects.toThrow();
  });
  it("proposal cancel rejects inactive membership", async () => {
    await expect(
      assertSalesRecord(authz(null, "inactive membership"), "proposals", ID, "update"),
    ).rejects.toThrow();
  });
});
