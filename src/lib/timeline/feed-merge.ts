// Intercalação k-way de origens já ordenadas da timeline (atividades, grupos de
// histórico e reuniões do calendário). Cada origem pagina no servidor com seu
// próprio cursor; aqui só se escolhe, item a item, o mais recente entre os
// buffers, buscando a próxima página de uma origem quando o buffer dela esvazia.
// Assim nenhuma origem é cortada por limite fixo e a ordem global é estável:
// data efetiva DESC, prioridade da origem ASC, id DESC.

export type FeedOrderKey = { at: number; rank: number; id: string };

export type FeedSourceState<T> = {
  buffer: T[];
  hasMore: boolean;
  /** Busca a próxima página da origem (o próprio fetcher guarda o cursor). */
  fetchNext: () => Promise<{ items: T[]; hasMore: boolean }>;
};

export function compareFeedKeys(a: FeedOrderKey, b: FeedOrderKey): number {
  if (a.at !== b.at) return b.at - a.at;
  if (a.rank !== b.rank) return a.rank - b.rank;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

export async function takeMerged<T>(
  sources: FeedSourceState<T>[],
  size: number,
  keyOf: (item: T) => FeedOrderKey,
): Promise<T[]> {
  const out: T[] = [];
  while (out.length < size) {
    const pending = sources.filter((s) => s.buffer.length === 0 && s.hasMore);
    if (pending.length) {
      const pages = await Promise.all(pending.map((s) => s.fetchNext()));
      pending.forEach((s, i) => {
        s.buffer.push(...pages[i].items);
        // Página vazia com has_more seria um laço infinito: trata como fim.
        s.hasMore = pages[i].hasMore && pages[i].items.length > 0;
      });
    }
    let best: FeedSourceState<T> | null = null;
    for (const s of sources) {
      if (!s.buffer.length) continue;
      if (!best || compareFeedKeys(keyOf(s.buffer[0]), keyOf(best.buffer[0])) < 0) best = s;
    }
    if (!best) break;
    out.push(best.buffer.shift() as T);
  }
  return out;
}

export function feedHasMore<T>(sources: FeedSourceState<T>[]): boolean {
  return sources.some((s) => s.buffer.length > 0 || s.hasMore);
}
