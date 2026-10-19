/** Janela em que um registro enriquecido recebe o selo ✨. */
export const RECENT_ENRICHMENT_DAYS = 30;

export function recentEnrichmentSince(now: Date = new Date()): Date {
  return new Date(now.getTime() - RECENT_ENRICHMENT_DAYS * 86_400_000);
}

export function isRecentEnrichment(at: string | null | undefined, now: Date = new Date()): boolean {
  if (!at) return false;
  const t = new Date(at).getTime();
  return Number.isFinite(t) && t >= recentEnrichmentSince(now).getTime() && t <= now.getTime();
}

/** Foto automática só conta quando veio do LinkedIn (manual nunca conta). */
export function isRecentAutoPhoto(
  source: string | null | undefined,
  at: string | null | undefined,
  now: Date = new Date(),
): boolean {
  return source === "linkedin" && isRecentEnrichment(at, now);
}

/** Mantém a data mais recente por id. */
export function mergeLatest(map: Map<string, string>, id: string, at: string | null | undefined) {
  if (!at) return;
  const prev = map.get(id);
  if (!prev || new Date(at) > new Date(prev)) map.set(id, at);
}
