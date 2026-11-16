// "Chamadas recentes" da campanha: só tentativas já discadas (status ≠ queued),
// ordenadas pela hora de início (fallback: criação), no máximo `limit`.
export type RecentCallInput = { status: string; started_at?: string | null; created_at: string };

export function selectRecentCalls<T extends RecentCallInput>(rows: T[], limit = 50): T[] {
  const ts = (r: T) => Date.parse(r.started_at ?? r.created_at) || 0;
  return rows
    .filter((r) => r.status !== "queued")
    .sort((a, b) => ts(b) - ts(a))
    .slice(0, limit);
}
