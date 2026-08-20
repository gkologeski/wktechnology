// Projeção e ordenação do grid resolvidas ANTES da consulta da lista.
//
// Reaproveita exatamente as mesmas queries (mesmas `queryKey`) do
// `useGridColumns`/`useAutoGridColumns`, então não gera requisições extras —
// serve apenas para que a tela possa montar o `select`/`order` sem depender da
// ordem de declaração dos hooks de coluna.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getGridPreference } from "@/lib/grid-preferences.functions";
import { getEntityFieldCatalog } from "@/lib/entity-fields.functions";
import { isSortableField } from "@/lib/grid/auto-column-render";
import { selectKeysSignature } from "@/lib/grid/dynamic-select";
import { resolveSortKey, normalizeSortDir, type SortDir } from "@/lib/grid/sort-guard";
import type { CatalogEntity } from "@/hooks/use-auto-grid-columns";

export type UseGridProjectionResult = {
  /** Colunas do catálogo visíveis (precisam entrar na projeção). */
  selectKeys: string[];
  /** Assinatura estável para usar em `queryKey`. */
  selectSignature: string;
  /** Alguma coluna personalizada visível → projetar `custom_fields`. */
  needsCustomFields: boolean;
  /** Ordenação salva já validada (ou `null` quando não há preferência válida). */
  sortKey: string | null;
  sortDir: SortDir | null;
  /** Colunas de banco ordenáveis do catálogo. */
  sortableKeys: string[];
  isLoading: boolean;
};

export function useGridProjection({
  gridKey,
  entity,
  /** Chaves de ordenação declaradas na tela (colunas fixas). */
  declaredSortKeys = [],
}: {
  gridKey: string;
  entity?: CatalogEntity;
  declaredSortKeys?: readonly string[];
}): UseGridProjectionResult {
  const getPrefFn = useServerFn(getGridPreference);
  const fetchCatalog = useServerFn(getEntityFieldCatalog);

  const prefQuery = useQuery({
    queryKey: ["grid-pref", gridKey],
    queryFn: () => getPrefFn({ data: { gridKey } }),
    staleTime: 60_000,
  });

  const catalog = useQuery({
    queryKey: ["entity-field-catalog", entity],
    enabled: !!entity,
    staleTime: 5 * 60_000,
    queryFn: () => fetchCatalog({ data: { entity: entity! } }),
  });

  const fields = catalog.data?.fields ?? [];

  return useMemo(() => {
    const visible = prefQuery.data?.visibleColumns ?? [];
    const catalogNames = new Set(fields.map((f) => f.name));
    const selectKeys = visible.filter((k) => catalogNames.has(k));
    const sortableKeys = fields.filter(isSortableField).map((f) => f.name);
    const allowed = new Set<string>([...declaredSortKeys, ...sortableKeys]);
    const savedKey = prefQuery.data?.sortKey ?? null;
    const resolved = savedKey ? resolveSortKey(savedKey, allowed, "") : "";
    return {
      selectKeys,
      selectSignature: selectKeysSignature(selectKeys),
      needsCustomFields: visible.some((k) => k.startsWith("custom:")),
      sortKey: resolved || null,
      sortDir: savedKey && resolved ? normalizeSortDir(prefQuery.data?.sortDir) : null,
      sortableKeys,
      isLoading: prefQuery.isLoading || (!!entity && catalog.isLoading),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    prefQuery.data,
    prefQuery.isLoading,
    fields,
    catalog.isLoading,
    entity,
    declaredSortKeys.join(","),
  ]);
}
