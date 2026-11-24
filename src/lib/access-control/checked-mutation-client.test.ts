import { describe, it, expect, vi } from "vitest";
import { checkedMutationClient } from "./checked-mutation-client";
function client(data: unknown, server = false) {
  const select = vi.fn(() => query),
    query = {
      select,
      update: () => query,
      delete: () => query,
      eq: (..._args: unknown[]) => query,
      then: (resolve: (v: unknown) => unknown) => resolve({ data, error: null }),
    };
  return { db: checkedMutationClient({ from: () => query }, { server }), select };
}
describe("association writes", () => {
  it("server rejects a zero-row single-record edit even when the caller ignores error", async () => {
    const c = client([], true);
    await expect(c.db.from().update().eq("id", "missing")).rejects.toMatchObject({ code: "42501" });
  });
  it("server preserves an intentional empty bulk cleanup", async () => {
    const c = client([], true);
    const result = await c.db.from().delete().eq("parent_id", "empty");
    expect((result as { error: unknown }).error).toBeNull();
  });
  it("does not turn an RLS zero-row update into success", async () => {
    const c = client([]),
      r = await c.db.from().update().eq();
    expect((r as { error: { code: string } }).error.code).toBe("42501");
    expect(c.select).toHaveBeenCalledWith("id");
  });
  it("preserves an authorized update", async () => {
    const c = client([{ id: "record" }]),
      r = await c.db.from().update().eq();
    expect((r as { error: unknown }).error).toBeNull();
  });
  it("keeps ordinary empty reads as empty reads", async () => {
    const c = client([]),
      r = await c.db.from().select();
    expect((r as { error: unknown }).error).toBeNull();
    expect(c.select).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["proposal_template_services", "template_id"],
    ["deal_contacts", "deal_id"],
    ["segment_members", "segment_id"],
    ["chat_conversation_members", "conversation_id"],
    ["sdr_material_offers", "material_id"],
  ])(
    "projects the composite key column %s -> %s instead of non-existent id",
    async (table, expectedColumn) => {
      const c = client([{ [expectedColumn]: "k1" }], false);
      const r = await (
        c.db as { from: (t: string) => Record<string, (...a: unknown[]) => unknown> }
      )
        .from(table)
        .delete();
      expect((r as { error: unknown }).error).toBeNull();
      expect(c.select).toHaveBeenCalledWith(expectedColumn);
    },
  );

  it("still blocks zero-row client deletes on composite-key tables without id", async () => {
    const c = client([], false);
    const r = await (c.db as { from: (t: string) => Record<string, (...a: unknown[]) => unknown> })
      .from("deal_contacts")
      .delete();
    expect((r as { error: { code: string } }).error.code).toBe("42501");
    expect(c.select).toHaveBeenCalledWith("deal_id");
  });
});
