import { describe, expect, it } from "vitest";
import { addTotals, chunkIds, emptyTotals } from "./enrichment-batching";

describe("chunkIds", () => {
  it("divide 5927 em 12 lotes de no máximo 500", () => {
    const ids = Array.from({ length: 5927 }, (_, i) => i);
    const c = chunkIds(ids);
    expect(c).toHaveLength(12);
    expect(c[0]).toHaveLength(500);
    expect(c[11]).toHaveLength(427);
  });
  it("lista vazia gera zero lotes", () => {
    expect(chunkIds([])).toEqual([]);
  });
});

describe("addTotals", () => {
  it("soma resultados de lotes", () => {
    const t = addTotals(addTotals(emptyTotals(), { succeeded: 3, creditsUsed: 3 }), {
      succeeded: 2,
      failed: 1,
      creditsUsed: 2,
      phonePending: 1,
    });
    expect(t).toEqual({ succeeded: 5, unchanged: 0, failed: 1, creditsUsed: 5, phonePending: 1 });
  });
});
