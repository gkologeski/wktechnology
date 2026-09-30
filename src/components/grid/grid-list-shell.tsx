import { createContext, useContext, type ReactNode } from "react";
import { FiltersSidebar, FilterGroup } from "@/components/crm/hubspot-shell";
import { FieldEditor } from "@/components/grid/grid-filter-panel";
import { activeCount } from "@/lib/grid-filters";
import type { GridFiltersController } from "@/hooks/use-grid-filters";

const ShellCtx = createContext(false);
/** Indica à barra do grid que os filtros já estão no painel lateral. */
export const useInGridShell = () => useContext(ShellCtx);

/**
 * Casco comum dos grids no modelo de Empresas/Contatos: painel de filtros
 * lateral à esquerda (desktop) e conteúdo (barra + tabela) à direita.
 * Em telas menores o painel some e a barra mantém o botão "Filtros".
 */
export function GridListShell<T>({
  filters,
  children,
}: {
  filters?: GridFiltersController<T>;
  children: ReactNode;
}) {
  if (!filters) return <>{children}</>;
  return (
    <ShellCtx.Provider value={true}>
      <div className="flex min-h-0 overflow-hidden rounded-md border bg-card">
        <FiltersSidebar hasActiveFilters={activeCount(filters.state) > 0} onClear={filters.clear}>
          {filters.fields.map((f, i) => (
            <FilterGroup key={f.key} title={f.label} defaultOpen={i < 3}>
              <div className="px-1 py-1">
                <FieldEditor ctl={filters} field={f} />
              </div>
            </FilterGroup>
          ))}
        </FiltersSidebar>
        <div className="min-w-0 flex-1 p-3">{children}</div>
      </div>
    </ShellCtx.Provider>
  );
}
