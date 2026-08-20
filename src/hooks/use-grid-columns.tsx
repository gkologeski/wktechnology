import { useMemo, useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Columns3 } from "lucide-react";
import { toast } from "sonner";
import { ColumnEditorDialog, type ColumnDef } from "@/components/column-editor-dialog";
import {
  getGridPreference,
  saveGridPreference,
  resetGridPreference,
} from "@/lib/grid-preferences.functions";
import { listCustomProperties, type CustomEntity } from "@/lib/custom-properties.functions";
import { useAutoGridColumns, type CatalogEntity } from "@/hooks/use-auto-grid-columns";

export type GridColumnDef<T> = ColumnDef & {
  /** Render function for the cell. Receives the row. */
  render: (row: T) => React.ReactNode;
  /** Optional className for the <td> element. */
  className?: string;
  /** Optional className for the <th> element. */
  headerClassName?: string;
  /** Optional custom header content (replaces the default label, e.g. for sortable headers). */
  header?: React.ReactNode;
};

export type UseGridColumnsOptions<T> = {
  gridKey: string;
  columns: GridColumnDef<T>[];
  defaults: string[];
  /** When set, fetches custom properties for the given entity and appends them as `custom:<key>` columns. */
  customEntity?: CustomEntity;
  /**
   * When set, fetches the dynamic field catalog of the table and appends every
   * remaining column as an optional grid column (group "Outros campos").
   */
  catalogEntity?: CatalogEntity;
};

export function useGridColumns<T extends object>({
  gridKey,
  columns,
  defaults,
  customEntity,
  catalogEntity,
}: UseGridColumnsOptions<T>) {
  const qc = useQueryClient();
  const getPrefFn = useServerFn(getGridPreference);
  const savePrefFn = useServerFn(saveGridPreference);
  const resetPrefFn = useServerFn(resetGridPreference);
  const listCustomFn = useServerFn(listCustomProperties);

  const prefQuery = useQuery({
    queryKey: ["grid-pref", gridKey],
    queryFn: () => getPrefFn({ data: { gridKey } }),
    staleTime: 60_000,
  });

  const customQuery = useQuery({
    queryKey: ["custom-properties", customEntity],
    queryFn: () => listCustomFn({ data: { entity: customEntity! } }),
    enabled: !!customEntity,
    staleTime: 60_000,
  });

  const customColumns = useMemo<GridColumnDef<T>[]>(() => {
    if (!customEntity || !customQuery.data) return [];
    return customQuery.data
      .filter((p) => p.enabled)
      .map((p) => ({
        key: `custom:${p.key}`,
        label: p.label,
        group: "Personalizado",
        render: (row: T) => {
          const cf = ((row as { custom_fields?: unknown }).custom_fields ?? {}) as Record<
            string,
            unknown
          >;
          const v = cf[p.key];
          if (v == null || v === "") return <span className="text-muted-foreground">—</span>;
          if (Array.isArray(v)) return <span className="truncate">{v.join(", ")}</span>;
          if (typeof v === "boolean") return v ? "Sim" : "Não";
          return <span className="truncate">{String(v)}</span>;
        },
      }));
  }, [customEntity, customQuery.data]);

  const declaredKeys = useMemo(() => columns.map((c) => c.key), [columns]);
  const { columns: autoColumns } = useAutoGridColumns<T>({
    entity: catalogEntity,
    exclude: declaredKeys,
  });

  const allColumns = useMemo<GridColumnDef<T>[]>(
    () => [...columns, ...customColumns, ...autoColumns],
    [columns, customColumns, autoColumns],
  );

  const visibleKeys = useMemo(() => {
    const saved = prefQuery.data?.visibleColumns;
    if (saved && saved.length) {
      const present = new Set(allColumns.map((c) => c.key));
      return saved.filter((k) => present.has(k));
    }
    return defaults.filter((k) => allColumns.some((c) => c.key === k));
  }, [prefQuery.data, defaults, allColumns]);

  const visibleColumns = useMemo(
    () =>
      visibleKeys
        .map((k) => allColumns.find((c) => c.key === k))
        .filter((c): c is GridColumnDef<T> => !!c),
    [visibleKeys, allColumns],
  );

  const saveMut = useMutation({
    mutationFn: (order: string[]) => savePrefFn({ data: { gridKey, visibleColumns: order } }),
    onMutate: async (order) => {
      await qc.cancelQueries({ queryKey: ["grid-pref", gridKey] });
      const prev = qc.getQueryData<{ visibleColumns: string[] | null }>(["grid-pref", gridKey]);
      qc.setQueryData(["grid-pref", gridKey], { visibleColumns: order });
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["grid-pref", gridKey], ctx.prev);
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar as colunas.");
    },
    onSuccess: () => toast.success("Colunas atualizadas"),
  });

  const resetMut = useMutation({
    mutationFn: () => resetPrefFn({ data: { gridKey } }),
    onSuccess: () => {
      qc.setQueryData(["grid-pref", gridKey], { visibleColumns: null });
    },
  });

  const [open, setOpen] = useState(false);
  const openEditor = useCallback(() => setOpen(true), []);

  const ColumnsButton = useCallback(
    ({
      size = "sm",
      variant = "outline",
      label = "Colunas",
    }: {
      size?: "sm" | "default";
      variant?: "outline" | "ghost";
      label?: string;
    }) => (
      <Button variant={variant} size={size} onClick={openEditor} className="gap-1.5">
        <Columns3 className="h-3.5 w-3.5" />
        {label}
      </Button>
    ),
    [openEditor],
  );

  // Keep latest values in refs so ColumnsEditor has a STABLE component identity.
  // If ColumnsEditor's identity changed across renders (e.g. due to mutation state
  // changes), React would unmount and remount <Dialog>, causing the modal to
  // visibly "reload" twice after actions like "Restaurar padrão".
  const latest = useRef({ allColumns, prefData: prefQuery.data, defaults, saveMut, resetMut });
  latest.current = { allColumns, prefData: prefQuery.data, defaults, saveMut, resetMut };

  const ColumnsEditor = useCallback(
    () => (
      <ColumnEditorDialog
        open={open}
        setOpen={setOpen}
        allColumns={latest.current.allColumns.map(({ key, label, group }) => ({
          key,
          label,
          group,
        }))}
        value={latest.current.prefData?.visibleColumns ?? null}
        defaults={latest.current.defaults}
        onApply={(order) => latest.current.saveMut.mutate(order)}
        onReset={() => latest.current.resetMut.mutate()}
      />
    ),
    [open],
  );

  return {
    columns: visibleColumns,
    columnKeys: visibleKeys,
    allColumns,
    openEditor,
    ColumnsButton,
    ColumnsEditor,
    isLoading: prefQuery.isLoading,
  };
}
