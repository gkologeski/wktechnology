import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, expect, it, vi } from "vitest";
import { readHrPrivate, mergeHrPrivate, protectHrPrivatePayload } from "./hr-private.server";
const rpc = vi.fn();
const client = { rpc } as unknown as SupabaseClient;
beforeEach(() => {
  rpc.mockReset();
});
it("batches and deduplicates without accepting workspace or actor", async () => {
  rpc.mockResolvedValue({ data: [], error: null });
  await readHrPrivate(client, "people_sensitive", [
    ...Array.from({ length: 401 }, (_, i) => String(i)),
    "0",
  ]);
  expect(rpc).toHaveBeenCalledTimes(3);
  for (const [name, args] of rpc.mock.calls) {
    expect(name).toBe("hr_private_fields");
    expect(Object.keys(args).sort()).toEqual(["_ids", "_parent", "_resource"]);
    expect(args._ids.length).toBeLessThanOrEqual(200);
  }
});
it("rejects an RPC error even if stale allowed data is returned", async () => {
  rpc.mockResolvedValue({ data: [{ id: "row", can_update: true }], error: { message: "offline" } });
  await expect(readHrPrivate(client, "people_sensitive", ["row"])).rejects.toThrow("verificar");
});
it("a hidden blank payload cannot erase a stored private value", async () => {
  rpc.mockResolvedValue({
    data: [{ id: "row", can_view: false, can_update: false, fields: {} }],
    error: null,
  });
  const payload = { full_name: "New name", bank: null };
  await protectHrPrivatePayload(client, "people_sensitive", "row", null, payload, ["bank"]);
  expect(payload).toEqual({ full_name: "New name" });
});
it("read-only private access cannot write nonblank values", async () => {
  rpc.mockResolvedValue({
    data: [{ id: "row", can_view: true, can_update: false, fields: { bank: "existing" } }],
    error: null,
  });
  await expect(
    protectHrPrivatePayload(client, "people_sensitive", "row", null, { bank: "forged" }, ["bank"]),
  ).rejects.toThrow("Sem permissão");
});
it("permitted explicit null clears a private field; omitted fields stay omitted", async () => {
  rpc.mockResolvedValue({
    data: [{ id: "row", can_view: true, can_update: true, fields: {} }],
    error: null,
  });
  const payload = { bank: null };
  await protectHrPrivatePayload(client, "people_sensitive", "row", null, payload, [
    "bank",
    "monthly_cost",
  ]);
  expect(payload).toEqual({ bank: null });
});
it("an ordinary edit without private fields does not fetch private data", async () => {
  await protectHrPrivatePayload(client, "people_sensitive", "row", null, { full_name: "Name" }, [
    "bank",
  ]);
  expect(rpc).not.toHaveBeenCalled();
});
it("new child private writes check the actual parent instead of an invented child", async () => {
  rpc.mockResolvedValue({
    data: [{ id: "person", can_view: true, can_update: true, fields: {} }],
    error: null,
  });
  await protectHrPrivatePayload(
    client,
    "one_on_ones_private",
    null,
    "person",
    { private_notes: "private" },
    ["private_notes"],
  );
  expect(rpc).toHaveBeenCalledWith("hr_private_fields", {
    _resource: "one_on_ones_private",
    _ids: ["person"],
    _parent: true,
  });
});
it("hidden rows are merged with null private values, preserving normal data", async () => {
  rpc.mockResolvedValue({
    data: [{ id: "row", can_view: false, can_update: false, fields: {} }],
    error: null,
  });
  const [r] = await mergeHrPrivate(client, "allocations_financial", [
    { id: "row", status: "active" },
  ]);
  expect(r).toEqual({
    id: "row",
    status: "active",
    billable_rate: null,
    cost_rate: null,
    can_view_private: false,
    can_update_private: false,
  });
});
