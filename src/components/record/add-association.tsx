import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EntityCombobox } from "@/components/ui/entity-combobox";

type Props = {
  entity: string;
  select: string;
  searchColumn?: string;
  searchColumns?: string[];
  orderBy?: string;
  labelFrom: (row: Record<string, unknown>) => string;
  hintFrom?: (row: Record<string, unknown>) => string | null;
  filters?: Record<string, string | number | boolean | null>;
  placeholder?: string;
  onPick: (id: string) => unknown | Promise<unknown>;
  onCreateNew?: () => void;
  /** label shown next to the + button trigger. Default: "Adicionar" */
  label?: string;
};

/**
 * Compact "+ Add" trigger that opens a popover with:
 *  - search-and-pick existing record (EntityCombobox)
 *  - optional "Criar novo" button that delegates to the parent
 */
export function AddAssociation({
  entity, select, searchColumn = "name", searchColumns, orderBy, labelFrom, hintFrom, filters,
  placeholder, onPick, onCreateNew, label,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
          aria-label={label ?? "Adicionar"}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          {label ?? "Adicionar"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3 space-y-2" align="end">
        <EntityCombobox
          entity={entity}
          select={select}
          searchColumn={searchColumn}
          orderBy={orderBy}
          labelFrom={labelFrom}
          hintFrom={hintFrom}
          filters={filters}
          value={null}
          onChange={async (id) => {
            if (id) {
              await onPick(id);
              setOpen(false);
            }
          }}
          placeholder={placeholder ?? "Buscar para vincular…"}
          clearable={false}
        />
        {onCreateNew && (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              setOpen(false);
              onCreateNew();
            }}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Criar novo
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
