// Divisão em lotes e soma de resultados do enriquecimento em massa (cliente).
export const ENRICH_BATCH_SIZE = 500;

export function chunkIds<T>(ids: T[], size = ENRICH_BATCH_SIZE): T[][] {
  if (size <= 0) throw new Error("size must be positive");
  const out: T[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

export type EnrichTotals = {
  succeeded: number;
  unchanged: number;
  failed: number;
  creditsUsed: number;
  phonePending: number;
};

export const emptyTotals = (): EnrichTotals => ({
  succeeded: 0,
  unchanged: 0,
  failed: 0,
  creditsUsed: 0,
  phonePending: 0,
});

export function addTotals(a: EnrichTotals, b: Partial<EnrichTotals>): EnrichTotals {
  return {
    succeeded: a.succeeded + (b.succeeded ?? 0),
    unchanged: a.unchanged + (b.unchanged ?? 0),
    failed: a.failed + (b.failed ?? 0),
    creditsUsed: a.creditsUsed + (b.creditsUsed ?? 0),
    phonePending: a.phonePending + (b.phonePending ?? 0),
  };
}
