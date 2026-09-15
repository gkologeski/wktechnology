// Histórico de desfazer do modal de itens de linha do negócio.
// Pilha em memória (sessão do modal), sem tabela nova: cada entrada sabe como
// reverter a última ação (edição de campo, inclusão ou exclusão de item).

export const MAX_HISTORY = 20;

export type HistoryEntry<TItem> =
  | { kind: "update"; id: string; label: string; previous: Partial<TItem> }
  | { kind: "insert"; id: string; label: string }
  | { kind: "delete"; id: string; label: string; row: TItem };

/** Adiciona uma entrada mantendo no máximo `MAX_HISTORY` ações. */
export function pushHistory<TItem>(
  stack: HistoryEntry<TItem>[],
  entry: HistoryEntry<TItem>,
): HistoryEntry<TItem>[] {
  const next = [...stack, entry];
  return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
}

/** Só os campos alterados, com o valor anterior — o que o desfazer reaplica. */
export function previousValues<TItem extends Record<string, unknown>>(
  item: TItem,
  patch: Partial<TItem>,
): Partial<TItem> {
  const previous: Record<string, unknown> = {};
  for (const key of Object.keys(patch)) {
    previous[key] = item[key] ?? null;
  }
  return previous as Partial<TItem>;
}

export function describeEntry<TItem>(entry: HistoryEntry<TItem>): string {
  if (entry.kind === "insert") return `inclusão de "${entry.label}"`;
  if (entry.kind === "delete") return `exclusão de "${entry.label}"`;
  return `alteração em "${entry.label}"`;
}
