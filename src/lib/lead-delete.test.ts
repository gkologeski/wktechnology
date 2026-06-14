import { describe, it, expect, vi } from "vitest";
import { deleteLeadsByIds } from "./lead-delete";

function makeSupabaseMock(result: {
  data: { id: string }[] | null;
  error: { message: string } | null;
}) {
  const select = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ select }));
  const inFn = vi.fn(() => ({ select }));
  const del = vi.fn(() => ({ eq, in: inFn }));
  const from = vi.fn(() => ({ delete: del }));
  return { client: { from } as never, from, del, eq, in: inFn, select };
}

describe("deleteLeadsByIds", () => {
  it("returns 0 when ids is empty without calling supabase", async () => {
    const { client, from } = makeSupabaseMock({ data: [], error: null });
    const n = await deleteLeadsByIds(client, []);
    expect(n).toBe(0);
    expect(from).not.toHaveBeenCalled();
  });

  it("throws when single delete returns 0 rows (RLS silently blocked)", async () => {
    const { client } = makeSupabaseMock({ data: [], error: null });
    await expect(deleteLeadsByIds(client, ["lead-1"])).rejects.toThrow(/permissão/i);
  });

  it("throws when bulk delete returns 0 rows", async () => {
    const { client } = makeSupabaseMock({ data: [], error: null });
    await expect(deleteLeadsByIds(client, ["a", "b"])).rejects.toThrow(/permissão/i);
  });

  it("throws partial-success error when fewer rows than requested were deleted", async () => {
    const { client } = makeSupabaseMock({ data: [{ id: "a" }], error: null });
    await expect(deleteLeadsByIds(client, ["a", "b", "c"])).rejects.toThrow(/Apenas 1 de 3/);
  });

  it("returns count on full success", async () => {
    const { client } = makeSupabaseMock({ data: [{ id: "a" }, { id: "b" }], error: null });
    const n = await deleteLeadsByIds(client, ["a", "b"]);
    expect(n).toBe(2);
  });

  it("propagates supabase errors", async () => {
    const { client } = makeSupabaseMock({ data: null, error: { message: "boom" } });
    await expect(deleteLeadsByIds(client, ["a"])).rejects.toThrow("boom");
  });
});
