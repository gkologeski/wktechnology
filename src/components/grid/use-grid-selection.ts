// Estado de seleção reutilizável para grids (página atual + todos os filtrados).
// Base da Fase 0 do padrão de grids (ver .lovable/plan/grids-completos-*.md).
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type GridIdQueryBuilder = () => {
  range: (
    from: number,
    to: number,
  ) => Promise<{ data: { id: string }[] | null; error: { message: string } | null }>;
};

export type UseGridSelectionOptions = {
  /**
   * Constrói a consulta que devolve apenas os `id` de TODOS os registros que
   * atendem aos filtros atuais (todas as páginas). Quando omitido, apenas a
   * seleção da página atual fica disponível.
   */
  buildIdQuery?: GridIdQueryBuilder;
  /** Limite de segurança para a seleção global. */
  maxIds?: number;
};

const CHUNK = 1000;

export function useGridSelection<T extends { id: string }>(
  rows: T[],
  options: UseGridSelectionOptions = {},
) {
  const { buildIdQuery, maxIds = 50_000 } = options;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectingAll, setIsSelectingAll] = useState(false);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allOnPageSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const someOnPageSelected = rows.some((r) => selectedIds.has(r.id));

  const toggleAllOnPage = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const all = rows.length > 0 && rows.every((r) => next.has(r.id));
      for (const r of rows) {
        if (all) next.delete(r.id);
        else next.add(r.id);
      }
      return next;
    });
  }, [rows]);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  const selectAllMatching = useCallback(async () => {
    if (!buildIdQuery) return;
    setIsSelectingAll(true);
    try {
      const all: string[] = [];
      for (let offset = 0; ; offset += CHUNK) {
        const { data, error } = await buildIdQuery().range(offset, offset + CHUNK - 1);
        if (error) throw new Error(error.message);
        const batch = data ?? [];
        for (const r of batch) all.push(r.id);
        if (batch.length < CHUNK) break;
        if (all.length >= maxIds) break;
      }
      setSelectedIds(new Set(all));
      toast.success(`${all.length.toLocaleString("pt-BR")} registros selecionados`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao selecionar todos os registros");
    } finally {
      setIsSelectingAll(false);
    }
  }, [buildIdQuery, maxIds]);

  const ids = useMemo(() => Array.from(selectedIds), [selectedIds]);
  const selectedRows = useMemo(() => rows.filter((r) => selectedIds.has(r.id)), [rows, selectedIds]);

  return {
    selectedIds,
    ids,
    selectedRows,
    hasSelection: ids.length > 0,
    isSelected: (id: string) => selectedIds.has(id),
    toggleOne,
    toggleAllOnPage,
    allOnPageSelected,
    someOnPageSelected,
    clear,
    selectAllMatching: buildIdQuery ? selectAllMatching : undefined,
    isSelectingAll,
    setSelectedIds,
  };
}

/** Helper: consulta de ids em uma tabela com filtros aplicados por callback. */
export function idQueryFor(
  table: string,
  apply?: (q: ReturnType<typeof buildBase>) => ReturnType<typeof buildBase>,
): GridIdQueryBuilder {
  return () => {
    const base = buildBase(table);
    return (apply ? apply(base) : base) as unknown as ReturnType<GridIdQueryBuilder>;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildBase(table: string): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from(table).select("id");
}
