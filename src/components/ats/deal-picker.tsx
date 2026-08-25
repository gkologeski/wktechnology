import { useEffect, useMemo, useRef, useState } from "react";
import { Briefcase, Check, ChevronDown, Loader2, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
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
import { cn } from "@/lib/utils";
import { searchDeals } from "@/lib/ats/ats.functions";

type Deal = {
  id: string;
  name: string;
  value: number | null;
  currency: string | null;
  company_id: string | null;
};

function formatValue(value: number | null, currency: string | null) {
  if (value == null) return null;
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency ?? "BRL",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value}`;
  }
}

export function DealPicker({
  value,
  onChange,
  disabled,
  placeholder = "Vincular negócio…",
  className,
}: {
  value: string | null;
  onChange: (dealId: string | null, deal?: Deal | null) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const search = useServerFn(searchDeals);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Deal | null>(null);
  const hydratedRef = useRef<string | null>(null);

  // Hidrata o nome do negócio já vinculado.
  useEffect(() => {
    if (!value) {
      setSelected(null);
      hydratedRef.current = null;
      return;
    }
    if (hydratedRef.current === value) return;
    hydratedRef.current = value;
    search({ data: { ids: [value] } })
      .then((rs) => {
        const first = (rs as Deal[])[0] ?? null;
        setSelected(first);
      })
      .catch(() => setSelected(null));
  }, [value, search]);

  // Busca com debounce ao digitar.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      setLoading(true);
      search({ data: { q: query || undefined } })
        .then((rs) => setResults(rs as Deal[]))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [open, query, search]);

  const label = useMemo(() => {
    if (selected) return selected.name;
    if (value) return "Carregando…";
    return placeholder;
  }, [selected, value, placeholder]);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "h-9 flex-1 justify-between gap-2 px-3 text-sm font-normal",
              !selected && "text-text-tertiary",
            )}
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <Briefcase className="h-3.5 w-3.5 shrink-0 text-text-tertiary" aria-hidden />
              <span className="truncate">{label}</span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-text-tertiary" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Buscar negócio pelo nome…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-xs text-text-tertiary">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Buscando…
                </div>
              ) : (
                <>
                  <CommandEmpty>Nenhum negócio encontrado.</CommandEmpty>
                  <CommandGroup>
                    {results.map((d) => {
                      const isSelected = d.id === value;
                      const priceLabel = formatValue(d.value, d.currency);
                      return (
                        <CommandItem
                          key={d.id}
                          value={d.id}
                          onSelect={() => {
                            setSelected(d);
                            hydratedRef.current = d.id;
                            onChange(d.id, d);
                            setOpen(false);
                          }}
                          className="flex items-center gap-2"
                        >
                          <Check
                            className={cn(
                              "h-3.5 w-3.5 shrink-0",
                              isSelected ? "opacity-100" : "opacity-0",
                            )}
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm">{d.name}</div>
                            {priceLabel ? (
                              <div className="text-[11px] text-text-tertiary">{priceLabel}</div>
                            ) : null}
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-9 w-9 shrink-0 text-text-tertiary hover:text-text-primary"
          onClick={() => {
            setSelected(null);
            hydratedRef.current = null;
            onChange(null, null);
          }}
          disabled={disabled}
          aria-label="Remover negócio vinculado"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
