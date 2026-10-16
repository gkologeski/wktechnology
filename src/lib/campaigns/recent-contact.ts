/**
 * Controle de reenvio recente em campanhas: quem recebeu mensagem do MESMO canal
 * por outra campanha nos últimos N dias fica fora do público, salvo exceção manual.
 */
export const RECENT_DAYS_DEFAULT = 7;
export const RECENT_DAYS_MAX = 365;

export type RecentHit = { at: string; campaignName: string };

export function normalizeRecentDays(v: unknown): number {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 0) return RECENT_DAYS_DEFAULT;
  return Math.min(n, RECENT_DAYS_MAX);
}

export function recentSince(days: number, now: Date = new Date()): string | null {
  if (days <= 0) return null;
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

/** Celular BR com/sem 9º dígito vira a mesma chave; outros formatos ficam como estão. */
export function phoneRecentKey(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const m = /^55(\d{2})9?(\d{8})$/.exec(digits);
  return m ? `+55${m[1]}${m[2]}` : digits ? `+${digits}` : phone;
}

export function emailRecentKey(email: string): string {
  return email.trim().toLowerCase();
}

/** Guarda o envio mais recente por chave. */
export function indexRecent(
  rows: { key: string; at: string | null; campaignName: string | null }[],
): Map<string, RecentHit> {
  const map = new Map<string, RecentHit>();
  for (const r of rows) {
    if (!r.at) continue;
    const prev = map.get(r.key);
    if (!prev || prev.at < r.at)
      map.set(r.key, { at: r.at, campaignName: r.campaignName ?? "Campanha" });
  }
  return map;
}

export function splitRecent<T>(
  items: T[],
  keyOf: (item: T) => string,
  recent: Map<string, RecentHit>,
  overrides: Set<string>,
): { kept: (T & { overrideRecent: boolean })[]; removed: (T & RecentHit)[] } {
  const kept: (T & { overrideRecent: boolean })[] = [];
  const removed: (T & RecentHit)[] = [];
  for (const it of items) {
    const key = keyOf(it);
    const hit = recent.get(key);
    if (!hit) kept.push({ ...it, overrideRecent: false });
    else if (overrides.has(key)) kept.push({ ...it, overrideRecent: true });
    else removed.push({ ...it, ...hit });
  }
  return { kept, removed };
}
