import { describe, expect, it } from "vitest";
import { chunkIds } from "./chunk-ids";

describe("chunkIds", () => {
  it("divide 1810 ids em lotes de 200 (10 lotes, último com 10)", () => {
    const ids = Array.from({ length: 1810 }, (_, i) => String(i));
    const parts = chunkIds(ids);
    expect(parts).toHaveLength(10);
    expect(parts[9]).toHaveLength(10);
    expect(parts.flat()).toEqual(ids);
  });
  it("lista vazia gera zero lotes", () => {
    expect(chunkIds([])).toEqual([]);
  });
});
