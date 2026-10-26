import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertSalesAnyArea } from "./sales-core.server";
function client(error?: string) {
  const rpc = vi.fn().mockResolvedValue({
    data: error ? null : { workspace: "workspace-a", actor: "actor" },
    error: error ? { message: error } : null,
  });
  return { rpc, value: { rpc } as unknown as SupabaseClient };
}
it("sales area permits the authorized action before work", async () => {
  const c = client();
  await expect(
    assertSalesAnyArea(c.value, "techsales.contacts", "update"),
  ).resolves.toBeUndefined();
  expect(c.rpc).toHaveBeenCalledExactlyOnceWith("sales_area_authorize", {
    r: "techsales.contacts",
    a: "update",
    t: null,
    i: null,
  });
});
it("sales area refuses missing permission", async () => {
  const c = client("missing permission");
  await expect(assertSalesAnyArea(c.value, "techsales.contacts", "update")).rejects.toThrow(
    "missing permission",
  );
});
it("sales area refuses an effective deny", async () => {
  const c = client("explicit deny");
  await expect(
    assertSalesAnyArea(c.value, "techsales.prospecting_scoring", "manage"),
  ).rejects.toThrow("explicit deny");
});
it("sales area refuses a foreign selected workspace", async () => {
  const c = client("foreign workspace");
  await expect(assertSalesAnyArea(c.value, "techsales.contacts", "update")).rejects.toThrow(
    "foreign workspace",
  );
});
it("sales area refuses an inactive execution actor", async () => {
  const c = client("inactive actor");
  await expect(
    assertSalesAnyArea(c.value, "techsales.prospecting_scoring", "manage"),
  ).rejects.toThrow("inactive actor");
});
