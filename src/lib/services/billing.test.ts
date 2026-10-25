import { describe, it, expect, vi } from "vitest";
import { tickServicesBilling } from "./billing.server";
function client(results: Array<{ data: unknown; error: unknown }>) {
  const rpc = vi.fn(async () => results.shift());
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "not", "lte", "order"]) query[method] = () => query;
  query.limit = async () => ({
    data: [
      { id: "a", workspace_id: "tenant-a" },
      { id: "b", workspace_id: "tenant-b" },
    ],
    error: null,
  });
  const from = vi.fn(() => query);
  return { db: { from, rpc } as never, from, rpc };
}
describe("scheduled service billing delegation", () => {
  it("submits only source IDs and leaves atomic authorization/ownership to the database", async () => {
    const { db, rpc, from } = client([
      { data: { authorized: true, generated: true }, error: null },
      { data: { authorized: true, skippedOwned: true }, error: null },
    ]);
    expect(await tickServicesBilling(db)).toEqual({
      scanned: 2,
      generated: 1,
      skippedOwned: 1,
      skippedDuplicates: 0,
      updateErrors: 0,
    });
    expect(from).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenNthCalledWith(1, "service_bill_checked", {
      p_service: "a",
      p_mode: "tick",
      p_starts: null,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "service_bill_checked", {
      p_service: "b",
      p_mode: "tick",
      p_starts: null,
    });
  });
  it("does not bill a revoked delegate and does not count a duplicate as a new invoice", async () => {
    const { db } = client([
      { data: { authorized: false }, error: null },
      { data: { authorized: true, duplicate: true }, error: null },
    ]);
    expect(await tickServicesBilling(db)).toEqual({
      scanned: 2,
      generated: 0,
      skippedOwned: 0,
      skippedDuplicates: 1,
      updateErrors: 0,
    });
  });
  it("a failed atomic transaction creates no reported invoice and does not stop other tenants", async () => {
    const { db } = client([
      { data: null, error: { message: "transaction rejected" } },
      { data: { authorized: true, generated: true }, error: null },
    ]);
    expect(await tickServicesBilling(db)).toEqual({
      scanned: 2,
      generated: 1,
      skippedOwned: 0,
      skippedDuplicates: 0,
      updateErrors: 1,
    });
  });
});
