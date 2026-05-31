import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, X, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

/**
 * EntityCombobox — picker inteligente para campos vinculados ao banco.
 * Substitui <Select> que carrega listas inteiras. Busca on-demand com debounce.
 *
 * Comportamento inspirado no campo "Empresa" do diálogo de criação de leads.
 */
export type EntityComboboxItem = {
  id: string;
  label: string;
  hint?: string | null;
};

type RowLike = Record<string, unknown>;

export interface EntityComboboxProps {
  /** Tabela do Supabase. */
  entity: string;
  /** Campos a selecionar (devem conter id e os campos usados em labelFrom/hintFrom). */
  select: string;
  /** Coluna usada no filtro ilike. Default: "name". */
  searchColumn?: string;
  /** Filtros eq adicionais (ex.: { active: true }). */
  filters?: Record<string, string | number | boolean | null>;
  /** Coluna para order. Default: searchColumn. */
  orderBy?: string;
  /** Constrói o label visível a partir da linha. */
  labelFrom: (row: RowLike) => string;
  /** Constrói um hint opcional (ex.: email, cargo). */
  hintFrom?: (row: RowLike) => string | null;

  /** id atualmente selecionado. */
  value: string | null;
  /** Callback ao escolher / limpar. item é null quando limpa. */
  onChange: (id: string | null, item: EntityComboboxItem | null) => void;

  placeholder?: string;
  emptyLabel?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  icon?: LucideIcon;
  /** Permite limpar a seleção. Default: true. */
  clearable?: boolean;
}

export function EntityCombobox({
  entity,
  select,
  searchColumn = "name",
  filters,
  orderBy,
  labelFrom,
  hintFrom,
  value,
  onChange,
  placeholder = "Selecionar…",
  emptyLabel = "Nada encontrado",
  className,
  triggerClassName,
  disabled,
  icon: Icon,
  clearable = true,
}: EntityComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<EntityComboboxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EntityComboboxItem | null>(null);
  const reqIdRef = useRef(0);

  const filtersKey = useMemo(() => JSON.stringify(filters ?? {}), [filters]);

  // Hidrata label do item selecionado quando recebemos só um id.
  useEffect(() => {
    let cancel = false;
    if (!value) {
      setSelectedItem(null);
      return;
    }
    if (selectedItem && selectedItem.id === value) return;
    (async () => {
      const { data, error } = await supabase
        .from(entity as never)
        .select(select)
        .eq("id" as never, value as never)
        .maybeSingle();
      if (cancel || error || !data) return;
      const row = data as RowLike;
      setSelectedItem({
        id: String((row as { id?: unknown }).id ?? value),
        label: labelFrom(row),
        hint: hintFrom?.(row) ?? null,
      });
    })();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, entity, select]);

  // Busca on-demand quando o popover está aberto.
  useEffect(() => {
    if (!open) return;
    const q = search.trim();
    const id = ++reqIdRef.current;
    setLoading(true);
    const t = setTimeout(async () => {
      let query = supabase.from(entity as never).select(select).limit(25);
      if (q.length > 0) {
        query = query.ilike(searchColumn as never, `%${q}%`);
      }
      if (filters) {
        for (const [k, val] of Object.entries(filters)) {
          query = query.eq(k as never, val as never);
        }
      }
      query = query.order((orderBy ?? searchColumn) as never, { ascending: true });
      const { data, error } = await query;
      if (id !== reqIdRef.current) return;
      setLoading(false);
      if (error || !data) {
        setResults([]);
        return;
      }
      const items: EntityComboboxItem[] = (data as RowLike[]).map((row) => ({
        id: String((row as { id?: unknown }).id ?? ""),
        label: labelFrom(row),
        hint: hintFrom?.(row) ?? null,
      }));
      setResults(items);
    }, 250);
    return () => {
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, search, entity, select, searchColumn, orderBy, filtersKey]);

  const display = selectedItem?.label ?? "";

  return (
    <div className={cn("w-full", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal",
              !display && "text-muted-foreground",
              triggerClassName,
            )}
          >
            <span className="flex items-center gap-2 truncate">
              {Icon ? <Icon className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}
              <span className="truncate">{display || placeholder}</span>
            </span>
            <span className="ml-2 flex items-center gap-1">
              {clearable && selectedItem ? (
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedItem(null);
                    onChange(null, null);
                  }}
                  className="rounded p-0.5 hover:bg-muted"
                  aria-label="Limpar seleção"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
              ) : null}
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Buscar…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Buscando…
                </div>
              ) : results.length === 0 ? (
                <CommandEmpty>{emptyLabel}</CommandEmpty>
              ) : (
                <CommandGroup>
                  {results.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.id}
                      onSelect={() => {
                        setSelectedItem(item);
                        onChange(item.id, item);
                        setOpen(false);
                        setSearch("");
                      }}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{item.label}</span>
                        {item.hint ? (
                          <span className="truncate text-[11px] text-muted-foreground">{item.hint}</span>
                        ) : null}
                      </span>
                      {value === item.id ? <Check className="h-4 w-4 text-primary" /> : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
