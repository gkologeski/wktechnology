// Estado de seleção de cards para as visões Quadro/Kanban.
// Espelha a API de `use-grid-selection`, sem a parte de "selecionar todos os
// filtrados" (o quadro sempre trabalha com o conjunto já carregado).
import { useCallback, useMemo, useState } from "react";

export type BoardToggleOptions = {
  /** Ids da coluna, na ordem exibida — habilita seleção por faixa (Shift). */
  columnIds?: string[];
  /** Shift pressionado no clique. */
  shift?: boolean;
};

export function useBoardSelection<T extends { id: string }>(rows: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastId, setLastId] = useState<string | null>(null);

  const toggle = useCallback(
    (id: string, options: BoardToggleOptions = {}) => {
      const { columnIds, shift } = options;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (shift && lastId && columnIds && columnIds.includes(lastId) && columnIds.includes(id)) {
          const a = columnIds.indexOf(lastId);
          const b = columnIds.indexOf(id);
          const [from, to] = a <= b ? [a, b] : [b, a];
          for (let i = from; i <= to; i += 1) next.add(columnIds[i]);
          return next;
        }
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setLastId(id);
    },
    [lastId],
  );

  /** Marca/desmarca todos os ids informados (ex.: uma coluna inteira). */
  const toggleMany = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = ids.length > 0 && ids.every((id) => next.has(id));
      for (const id of ids) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }, []);

  /** Marca explicitamente um conjunto de ids, preservando a seleção anterior. */
  const selectMany = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }, []);

  /** Remove explicitamente um conjunto de ids da seleção. */
  const deselectMany = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, []);


  const clear = useCallback(() => {
    setSelectedIds(new Set());
    setLastId(null);
  }, []);

  const ids = useMemo(() => Array.from(selectedIds), [selectedIds]);
  const selectedRows = useMemo(
    () => rows.filter((r) => selectedIds.has(r.id)),
    [rows, selectedIds],
  );

  return {
    selectedIds,
    ids,
    selectedRows,
    hasSelection: ids.length > 0,
    isSelected: (id: string) => selectedIds.has(id),
    toggle,
    toggleMany,
    clear,
  };
}
