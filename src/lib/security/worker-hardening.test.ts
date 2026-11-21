import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertSalesWorker } from "@/lib/access-control/sales-worker.server";
function fixture(data: boolean, error: string | null = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error: error ? { message: error } : null });
  const client = { rpc } as unknown as SupabaseClient;
  const effect = vi.fn();
  return {
    rpc,
    effect,
    invoke: async () => {
      await assertSalesWorker(client, "email_broadcasts", "synthetic-campaign", [
        { table: "contacts", id: "synthetic-recipient" },
      ]);
      effect();
    },
  };
}
it("worker permits the current authorized source and recipient", async () => {
  const x = fixture(true);
  await x.invoke();
  expect(x.rpc).toHaveBeenCalledWith("sales_worker_authorize", {
    p_source: "email_broadcasts",
    p_id: "synthetic-campaign",
    p_refs: [{ table: "contacts", id: "synthetic-recipient" }],
  });
  expect(x.effect).toHaveBeenCalledOnce();
});
it("worker blocks missing permission before any effect", async () => {
  const x = fixture(false);
  await expect(x.invoke()).rejects.toThrow();
  expect(x.effect).not.toHaveBeenCalled();
});
it("worker blocks explicit database deny before any effect", async () => {
  const x = fixture(false, "explicit deny");
  await expect(x.invoke()).rejects.toThrow("explicit deny");
  expect(x.effect).not.toHaveBeenCalled();
});
it("worker blocks foreign workspace source before any effect", async () => {
  const x = fixture(false, "foreign workspace");
  await expect(x.invoke()).rejects.toThrow("foreign workspace");
  expect(x.effect).not.toHaveBeenCalled();
});
it("worker blocks inactive execution actor before any effect", async () => {
  const x = fixture(false, "inactive member");
  await expect(x.invoke()).rejects.toThrow("inactive member");
  expect(x.effect).not.toHaveBeenCalled();
});
