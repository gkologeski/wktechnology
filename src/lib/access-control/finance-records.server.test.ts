import type { SupabaseClient } from "@supabase/supabase-js";
import { it, expect, vi } from "vitest";
import { assertFinanceEntry, assertFinancePayment } from "./finance-records.server";
it.each([false, null, "true", {}])("fails closed on non-boolean authorization %s", async (data) => {
  const client = {
    rpc: vi.fn().mockResolvedValue({ data, error: null }),
  } as unknown as SupabaseClient;
  await expect(assertFinanceEntry(client, "entry", "update")).rejects.toThrow("sem permissão");
  await expect(assertFinancePayment(client, "entry", "create")).rejects.toThrow("Sem permissão");
});
it("a database failure cannot be turned into an authorized financial mutation", async () => {
  const client = {
    rpc: vi.fn().mockResolvedValue({ data: true, error: { message: "Unavailable" } }),
  } as unknown as SupabaseClient;
  await expect(assertFinanceEntry(client, "entry", "cancel")).rejects.toThrow("Unavailable");
});
it("posting and editing use separate database actions with the caller-bound client", async () => {
  const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
  const client = { rpc } as unknown as SupabaseClient;
  await assertFinanceEntry(client, "entry", "update");
  await assertFinancePayment(client, "entry", "create");
  expect(rpc.mock.calls).toEqual([
    ["finance_entry_access", { _entry: "entry", _action: "update" }],
    ["finance_payment_access", { _entry: "entry", _action: "create" }],
  ]);
  expect(rpc.mock.contexts).toEqual([client, client]);
});
