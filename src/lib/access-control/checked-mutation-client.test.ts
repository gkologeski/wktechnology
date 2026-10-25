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
});
