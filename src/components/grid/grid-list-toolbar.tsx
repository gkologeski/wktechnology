import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ExportMenuButton } from "@/components/export-menu-button";
import { exportRows } from "@/lib/export/export-rows";
import type { ClientGrid, SortAccessor } from "@/lib/grid-client-sort";

type Props<T, K extends string> = {
  grid: ClientGrid<T, K>;
  /** Rótulo de cada coluna exportada, na ordem desejada. */
  labels: Partial<Record<K, string>>;
  /** Nome base do arquivo (a data é acrescentada). */
  filename: string;
  /** Mostra a busca textual (desligar quando a tela já tem busca própria). */
  search?: boolean;
  searchPlaceholder?: string;
  /** Valor exportado diferente do usado para ordenar (ex.: rótulo de prioridade). */
  exportValue?: Partial<Record<K, SortAccessor<T>>>;
};

/** Barra compacta com busca local e exportação (CSV/JSON/XLSX) da lista visível. */
export function GridListToolbar<T, K extends string>({
  grid,
  labels,
  filename,
  search = true,
  searchPlaceholder = "Buscar nesta lista…",
  exportValue,
}: Props<T, K>) {
  const keys = Object.keys(labels) as K[];
  const onExport = (format: "csv" | "json" | "xlsx") =>
    exportRows(grid.sorted, {
      filename,
      format,
      columns: keys.map((k) => ({
        header: labels[k] ?? k,
        value: (row: T) => (exportValue?.[k] ?? grid.accessors[k])(row) ?? "",
      })),
    });

  return (
    <div className="flex flex-wrap items-center gap-2 pb-3">
      {search && (
        <div className="relative min-w-56 flex-1 sm:max-w-sm">
          <Search
            className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={grid.query}
            onChange={(e) => grid.setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label="Buscar nesta lista"
            className="h-9 pl-8"
          />
        </div>
      )}
      {search && grid.query && (
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {grid.sorted.length} de {grid.total}
        </span>
      )}
      <ExportMenuButton
        className="ml-auto"
        disabled={grid.sorted.length === 0}
        onExport={onExport}
      />
    </div>
  );
}
