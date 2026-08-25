import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { OwnerFilter, type OwnerFilterValue } from "@/components/owner-filter";
import { DateFilter } from "@/components/date-filter";
import { translateFieldValue } from "@/lib/i18n/hubspot-values";
import { cn } from "@/lib/utils";
import type { LeadStage } from "@/lib/leads/stages";
import { DEFAULT_FILTERS, STATUS_TONE, type Filters } from "@/lib/leads/constants";
import { FilterGroup } from "@/components/leads/table-primitives";

export function LeadsFiltersSidebar({
  filters,
  setFilters,
  stages,
  sourceOptions,
  hasActiveFilters,
}: {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  stages: LeadStage[];
  sourceOptions: { value: string; count: number }[] | undefined;
  hasActiveFilters: boolean;
}) {
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-card/30 lg:flex lg:flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Filtros
        </h2>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-primary"
            onClick={() => setFilters(DEFAULT_FILTERS)}
          >
            Limpar tudo
          </Button>
        )}
      </div>
      <Separator />
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <FilterGroup title="Etapa do lead" defaultOpen>
          {stages.map((s) => {
            const checked = filters.status.includes(s.value);
            return (
              <label
                key={s.value}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) =>
                    setFilters((f) => ({
                      ...f,
                      status: v ? [...f.status, s.value] : f.status.filter((x) => x !== s.value),
                    }))
                  }
                />
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    s.color ? undefined : (STATUS_TONE[s.value]?.dot ?? "bg-muted-foreground"),
                  )}
                  style={s.color ? { backgroundColor: s.color } : undefined}
                />

                <span>{s.label}</span>
              </label>
            );
          })}
        </FilterGroup>

        <FilterGroup title="Responsável" defaultOpen>
          <OwnerFilter
            value={{ ownerIds: filters.ownerIds, includeUnassigned: filters.includeUnassigned }}
            onChange={(v: OwnerFilterValue) =>
              setFilters((f) => ({
                ...f,
                ownerIds: v.ownerIds,
                includeUnassigned: v.includeUnassigned,
              }))
            }
          />
        </FilterGroup>

        <FilterGroup title="Origem">
          {(sourceOptions ?? []).length === 0 ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">Sem fontes ainda</p>
          ) : (
            (sourceOptions ?? []).map((s) => {
              const checked = filters.source.includes(s.value);
              return (
                <label
                  key={s.value}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) =>
                      setFilters((f) => ({
                        ...f,
                        source: v ? [...f.source, s.value] : f.source.filter((x) => x !== s.value),
                      }))
                    }
                  />
                  <span className="flex-1 truncate">
                    {translateFieldValue("source", s.value) || s.value}
                  </span>
                  <span className="text-xs text-muted-foreground">{s.count}</span>
                </label>
              );
            })
          )}
        </FilterGroup>

        <FilterGroup title="Score">
          <div className="px-2 py-2">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{filters.scoreMin}</span>
              <span>{filters.scoreMax}</span>
            </div>
            <Slider
              min={0}
              max={100}
              step={5}
              value={[filters.scoreMin, filters.scoreMax]}
              onValueChange={([min, max]) =>
                setFilters((f) => ({ ...f, scoreMin: min, scoreMax: max }))
              }
            />
          </div>
        </FilterGroup>

        <FilterGroup title="Data de criação">
          <DateFilter
            name="leads-created"
            value={filters.createdPreset}
            custom={filters.createdCustom}
            onChange={({ value, custom }) =>
              setFilters((f) => ({ ...f, createdPreset: value, createdCustom: custom }))
            }
          />
        </FilterGroup>
      </div>
    </aside>
  );
}
