import { describe, expect, it } from "vitest";
import { feedHasMore, takeMerged, type FeedSourceState } from "@/lib/timeline/feed-merge";

type Item = { at: number; rank: number; id: string };

function pagedSource(all: Item[], pageSize: number): FeedSourceState<Item> & { calls: number } {
  let offset = 0;
  const src = {
    buffer: [] as Item[],
    hasMore: all.length > 0,
    calls: 0,
    fetchNext: async () => {
      src.calls += 1;
      const items = all.slice(offset, offset + pageSize);
      offset += items.length;
      return { items, hasMore: offset < all.length };
    },
  };
  return src;
}

const key = (i: Item) => i;

describe("takeMerged", () => {
  it("intercala origens em ordem global e percorre tudo sem perder nem duplicar", async () => {
    const acts = Array.from({ length: 95 }, (_, i) => ({ at: 1000 - i * 2, rank: 0, id: `a${i}` }));
    const hist = Array.from({ length: 330 }, (_, i) => ({ at: 999 - i, rank: 1, id: `h${i}` }));
    const sources = [pagedSource(acts, 40), pagedSource(hist, 40)];
    const seen: Item[] = [];
    while (feedHasMore(sources)) seen.push(...(await takeMerged(sources, 40, key)));
    expect(seen).toHaveLength(425);
    expect(new Set(seen.map((s) => s.id)).size).toBe(425);
    for (let i = 1; i < seen.length; i++) expect(seen[i - 1].at).toBeGreaterThanOrEqual(seen[i].at);
  });

  it("desempata data igual pela prioridade da origem e depois pelo id", async () => {
    const a = pagedSource([{ at: 5, rank: 0, id: "a1" }], 40);
    const h = pagedSource(
      [
        { at: 5, rank: 1, id: "h9" },
        { at: 5, rank: 1, id: "h2" },
      ],
      40,
    );
    const page = await takeMerged([h, a], 40, key);
    expect(page.map((p) => p.id)).toEqual(["a1", "h9", "h2"]);
  });

  it("não busca a próxima página de uma origem enquanto o buffer dela ainda tem itens", async () => {
    const big = pagedSource(
      Array.from({ length: 100 }, (_, i) => ({ at: 100 - i, rank: 0, id: `x${i}` })),
      40,
    );
    await takeMerged([big], 40, key);
    expect(big.calls).toBe(1);
  });

  it("encerra quando o servidor devolve página vazia com has_more verdadeiro", async () => {
    const broken: FeedSourceState<Item> = {
      buffer: [],
      hasMore: true,
      fetchNext: async () => ({ items: [], hasMore: true }),
    };
    expect(await takeMerged([broken], 40, key)).toEqual([]);
    expect(feedHasMore([broken])).toBe(false);
  });
});
