import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { deleteInChunks } from "./delete-guard";

const ids = Array.from({ length: 1338 }, (_, i) => `id-${i}`);

describe("exclusão em lotes", () => {
  it("divide 1.338 registros em lotes de até 100 e exclui todos", async () => {
    const sizes: number[] = [];
    const res = await deleteInChunks(ids, async (c) => {
      sizes.push(c.length);
      return { data: c.map((id) => ({ id })), error: null };
    });
    expect(sizes.length).toBe(14);
    expect(Math.max(...sizes)).toBe(100);
    expect(res).toEqual({ ok: true, deleted: 1338, requested: 1338 });
  });
  it("para na falha e informa quantos já foram excluídos", async () => {
    let n = 0;
    const res = await deleteInChunks(ids, async (c) =>
      ++n === 3 ? { data: null, error: { message: "x" } } : { data: c, error: null },
    );
    expect(res.ok).toBe(false);
    expect(res.deleted).toBe(200);
  });
  it("conta exclusão parcial por permissão", async () => {
    const res = await deleteInChunks(ids, async (c) => ({ data: c.slice(0, 50), error: null }));
    expect(res.deleted).toBe(14 * 50 - 12);
  });
});
