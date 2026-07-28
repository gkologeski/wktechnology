import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, X, Loader2, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

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
  /** Colunas adicionais para busca por tokens (OR entre colunas, AND entre tokens). */
  searchColumns?: string[];
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
  /**
   * IDs já associados a outros campos do formulário — aparecem primeiro
   * em um grupo "Relacionados".
   */
  priorityIds?: string[];
  /** Rótulo do grupo prioritário. Default: "Relacionados". */
  priorityLabel?: string;
}

export function EntityCombobox({
  entity,
  select,
  searchColumn = "name",
  searchColumns,
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
  priorityIds,
  priorityLabel = "Relacionados",
}: EntityComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<EntityComboboxItem[]>([]);
  const [priorityResults, setPriorityResults] = useState<EntityComboboxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EntityComboboxItem | null>(null);
  const reqIdRef = useRef(0);

  const filtersKey = useMemo(() => JSON.stringify(filters ?? {}), [filters]);
  const priorityKey = useMemo(
    () => (priorityIds && priorityIds.length ? [...priorityIds].sort().join(",") : ""),
    [priorityIds],
  );

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

  // Busca registros prioritários (associados a outros campos do form).
  useEffect(() => {
    if (!open) {
      return;
    }
    if (!priorityIds || priorityIds.length === 0) {
      setPriorityResults([]);
      return;
    }
    let cancel = false;
    (async () => {
      const { data, error } = await supabase
        .from(entity as never)
        .select(select)
        .in("id" as never, priorityIds as never);
      if (cancel || error || !data) return;
      const items: EntityComboboxItem[] = (data as RowLike[]).map((row) => ({
        id: String((row as { id?: unknown }).id ?? ""),
        label: labelFrom(row),
        hint: hintFrom?.(row) ?? null,
      }));
      // mantém ordem solicitada em priorityIds
      const order = new Map(priorityIds.map((id, i) => [id, i]));
      items.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      setPriorityResults(items);
    })();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, priorityKey, entity, select]);

  const columnsKey = useMemo(
    () => (searchColumns && searchColumns.length ? searchColumns.join(",") : ""),
    [searchColumns],
  );

  // Busca on-demand quando o popover está aberto.
  useEffect(() => {
    if (!open) return;
    const q = search.trim();
    const id = ++reqIdRef.current;
    setLoading(true);
    const t = setTimeout(async () => {
      let query = supabase
        .from(entity as never)
        .select(select)
        .limit(50);
      if (q.length > 0) {
        const cols = searchColumns && searchColumns.length ? searchColumns : [searchColumn];
        const safePhrase = q.replace(/[%,()]/g, " ");
        const tokens = q.split(/\s+/).filter(Boolean);
        // Inclui sempre matches da frase exata, e exige que cada token
        // apareça em alguma coluna (OR entre colunas, AND entre tokens).
        const phraseOr = cols.map((c) => `${c}.ilike.%${safePhrase}%`).join(",");
        for (const tok of tokens) {
          const safe = tok.replace(/[%,()]/g, " ");
          const tokenOr = cols.map((c) => `${c}.ilike.%${safe}%`).join(",");
          query = query.or(`${phraseOr},${tokenOr}`);
        }
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
      // Prioriza matches da frase exata, depois prefixo, depois o restante.
      const phrase = q.toLowerCase();
      const score = (it: EntityComboboxItem) => {
        if (!phrase) return 3;
        const l = it.label.toLowerCase();
        const h = (it.hint ?? "").toLowerCase();
        if (l === phrase) return 0;
        if (l.startsWith(phrase)) return 1;
        if (l.includes(phrase) || h.includes(phrase)) return 2;
        return 3;
      };
      items.sort((a, b) => {
        const sa = score(a);
        const sb = score(b);
        if (sa !== sb) return sa - sb;
        return a.label.localeCompare(b.label);
      });
      setResults(items.slice(0, 25));
    }, 250);
    return () => {
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, search, entity, select, searchColumn, columnsKey, orderBy, filtersKey]);

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
            <CommandInput placeholder="Buscar…" value={search} onValueChange={setSearch} />
            <CommandList>
              {(() => {
                const q = search.trim().toLowerCase();
                const priorityFiltered = priorityResults.filter(
                  (it) =>
                    !q ||
                    it.label.toLowerCase().includes(q) ||
                    (it.hint ?? "").toLowerCase().includes(q),
                );
                const priorityIdSet = new Set(priorityFiltered.map((it) => it.id));
                const restFiltered = results.filter((it) => !priorityIdSet.has(it.id));
                const renderItem = (item: EntityComboboxItem) => (
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
                        <span className="truncate text-[11px] text-muted-foreground">
                          {item.hint}
                        </span>
                      ) : null}
                    </span>
                    {value === item.id ? <Check className="h-4 w-4 text-primary" /> : null}
                  </CommandItem>
                );
                if (loading) {
                  return (
                    <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Buscando…
                    </div>
                  );
                }
                if (priorityFiltered.length === 0 && restFiltered.length === 0) {
                  return <CommandEmpty>{emptyLabel}</CommandEmpty>;
                }
                return (
                  <>
                    {priorityFiltered.length > 0 && (
                      <CommandGroup heading={priorityLabel}>
                        {priorityFiltered.map(renderItem)}
                      </CommandGroup>
                    )}
                    {restFiltered.length > 0 && (
                      <CommandGroup heading={priorityFiltered.length > 0 ? "Outros" : undefined}>
                        {restFiltered.map(renderItem)}
                      </CommandGroup>
                    )}
                  </>
                );
              })()}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
