// Intercalação k-way de origens já ordenadas da timeline (atividades, grupos de
// histórico e reuniões do calendário). Cada origem pagina no servidor com seu
// próprio cursor; aqui só se escolhe, item a item, o mais recente entre os
// buffers, buscando a próxima página de uma origem quando o buffer dela esvazia.
// Assim nenhuma origem é cortada por limite fixo e a ordem global é estável:
// data efetiva DESC, prioridade da origem ASC, id DESC.

export type FeedOrderKey = { at: number; rank: number; id: string };

export type FeedSourceState<T> = {
  /** Identificador opcional da origem para relatar falhas parciais. */
  id?: string;
  buffer: T[];
  hasMore: boolean;
  /** Busca a próxima página da origem (o próprio fetcher guarda o cursor). */
  fetchNext: () => Promise<{ items: T[]; hasMore: boolean }>;
};

export type TakeMergedOptions<T> = {
  signal?: AbortSignal;
  /** Chamado quando uma origem falha sem impedir a exibição das demais. */
  onSourceError?: (source: FeedSourceState<T>, error: Error) => void;
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
  options?: TakeMergedOptions<T>,
): Promise<T[]> {
  const out: T[] = [];
  while (out.length < size) {
    const pending = sources.filter((s) => s.buffer.length === 0 && s.hasMore);
    if (pending.length) {
      if (options?.onSourceError) {
        const results = await Promise.allSettled(pending.map((s) => s.fetchNext()));
        options.signal?.throwIfAborted();
        let firstError: Error | null = null;
        let succeeded = 0;
        results.forEach((res, i) => {
          const s = pending[i]!;
          if (res.status === "fulfilled") {
            succeeded += 1;
            s.buffer.push(...res.value.items);
            // Página vazia com has_more seria um laço infinito: trata como fim.
            s.hasMore = res.value.hasMore && res.value.items.length > 0;
          } else {
            const err = res.reason instanceof Error ? res.reason : new Error(String(res.reason));
            if (!firstError) firstError = err;
            s.hasMore = false;
            options.onSourceError?.(s, err);
          }
        });
        if (
          succeeded === 0 &&
          firstError &&
          out.length === 0 &&
          !sources.some((s) => s.buffer.length > 0 || s.hasMore)
        ) {
          throw firstError;
        }
      } else {
        const pages = await Promise.all(pending.map((s) => s.fetchNext()));
        pending.forEach((s, i) => {
          const page = pages[i]!;
          s.buffer.push(...page.items);
          // Página vazia com has_more seria um laço infinito: trata como fim.
          s.hasMore = page.hasMore && page.items.length > 0;
        });
      }
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
