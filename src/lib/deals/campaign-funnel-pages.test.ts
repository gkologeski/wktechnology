import { describe, expect, it } from "vitest";
import { fetchAllPages } from "./campaign-funnel.server";

describe("fetchAllPages", () => {
  it("lê além de 1.000 linhas (2.500 envios)", async () => {
    const all = Array.from({ length: 2500 }, (_, i) => ({ i }));
    const rows = await fetchAllPages<{ i: number }>(async (a, b) => ({
      data: all.slice(a, b + 1),
      error: null,
    }));
    expect(rows).toHaveLength(2500);
  });
  it("propaga erro do banco", async () => {
    await expect(
      fetchAllPages(async () => ({ data: null, error: { message: "x" } })),
    ).rejects.toThrow("x");
  });
});
