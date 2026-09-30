import { useMemo, useState } from "react";

export type SortDir = "asc" | "desc";
export type SortState<K extends string> = { key: K; dir: SortDir } | null;
export type SortAccessor<T> = (row: T) => string | number | null | undefined;

const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

function isEmpty(v: unknown): boolean {
  return v == null || (typeof v === "string" && v.trim() === "");
}

/** Ordena linhas de forma estável; vazios (null/"") vão sempre para o fim. */
export function sortRows<T>(rows: readonly T[], accessor: SortAccessor<T>, dir: SortDir): T[] {
  const factor = dir === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, value: accessor(row) }))
    .sort((a, b) => {
      const ae = isEmpty(a.value);
      const be = isEmpty(b.value);
      if (ae || be) return ae === be ? a.index - b.index : ae ? 1 : -1;
      const cmp =
        typeof a.value === "number" && typeof b.value === "number"
          ? a.value - b.value
          : collator.compare(String(a.value), String(b.value));
      return cmp === 0 ? a.index - b.index : cmp * factor;
    })
    .map((x) => x.row);
}

/** Estado de ordenação por coluna: 1º clique crescente, 2º inverte. */
export function useClientSort<T, K extends string>(
  rows: readonly T[],
  accessors: Record<K, SortAccessor<T>>,
) {
  const [sort, setSort] = useState<SortState<K>>(null);
  const sorted = useMemo(
    () => (sort ? sortRows(rows, accessors[sort.key], sort.dir) : (rows as T[])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, sort],
  );
  const toggle = (key: K) =>
    setSort((prev) =>
      prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  return { sorted, sort, toggle };
}
