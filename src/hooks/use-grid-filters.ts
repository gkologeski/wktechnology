import { useMemo, useState } from "react";
import {
  applyGridFilters,
  type GridFilterField,
  type GridFilterState,
  type GridFilterValue,
} from "@/lib/grid-filters";

export type GridFiltersController<T> = {
  /** Nome usado nas visões salvas (saved_views.entity). */
  entity: string;
  rows: readonly T[];
  fields: GridFilterField<T>[];
  state: GridFilterState;
  setState: (s: GridFilterState) => void;
  setField: (key: string, v: GridFilterValue | undefined) => void;
  clear: () => void;
  filtered: T[];
};

/** Estado do painel lateral de filtros + linhas filtradas no cliente. */
export function useGridFilters<T>(
  entity: string,
  rows: readonly T[],
  fields: GridFilterField<T>[],
): GridFiltersController<T> {
  const [state, setState] = useState<GridFilterState>({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filtered = useMemo(() => applyGridFilters(rows, fields, state), [rows, state]);
  const setField = (key: string, v: GridFilterValue | undefined) =>
    setState((prev) => {
      const next = { ...prev };
      if (v) next[key] = v;
      else delete next[key];
      return next;
    });
  return { entity, rows, fields, state, setState, setField, clear: () => setState({}), filtered };
}
