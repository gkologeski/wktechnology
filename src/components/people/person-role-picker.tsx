// Cargo da Pessoa a partir da base de cargos dos presets (job_profiles).
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronsUpDown } from "lucide-react";
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
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { listJobProfileOptions } from "@/lib/job-profiles.functions";
import { SENIORITY_LABEL } from "@/lib/job-profiles-shared";
import { cn } from "@/lib/utils";

export function PersonRolePicker({
  id,
  value,
  onChange,
  disabled,
}: {
  id?: string;
  value: string;
  onChange: (name: string, seniority: string | null) => void;
  disabled?: boolean;
}) {
  const fn = useServerFn(listJobProfileOptions);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const term = useDebouncedValue(search, 250);
  const q = useQuery({
    queryKey: ["job_profiles", "person-picker", term],
    enabled: open,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
    queryFn: () => fn({ data: { search: term || undefined } }),
  });
  const rows = q.data ?? [];
  const known = rows.some((r) => r.name === value);
  const pick = (name: string, sen: string | null) => {
    onChange(name, sen);
    setOpen(false);
    setSearch("");
  };
  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Cargo"
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || "Selecione o cargo"}
          </span>
          <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-64 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar cargo…" value={search} onValueChange={setSearch} />
          <CommandList className="max-h-72 overflow-y-auto">
            {q.isLoading ? (
              <div className="p-3 text-xs text-muted-foreground">Carregando cargos…</div>
            ) : q.isError ? (
              <div className="p-3 text-xs text-destructive">
                Não foi possível carregar os cargos. Verifique sua permissão no catálogo.
              </div>
            ) : (
              <CommandEmpty>Nenhum cargo encontrado.</CommandEmpty>
            )}
            {value && !known && !search && (
              <CommandGroup heading="Valor anterior">
                <CommandItem value="__legacy__" onSelect={() => setOpen(false)}>
                  <Check className="mr-2 h-4 w-4" />
                  <span className="truncate">{value}</span>
                </CommandItem>
              </CommandGroup>
            )}
            {rows.length > 0 && (
              <CommandGroup heading="Cargos e funções">
                {rows.map((r) => (
                  <CommandItem key={r.id} value={r.id} onSelect={() => pick(r.name, r.seniority)}>
                    <Check
                      className={cn("mr-2 h-4 w-4", value === r.name ? "opacity-100" : "opacity-0")}
                    />
                    <span className="truncate">{r.name}</span>
                    {r.seniority && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {SENIORITY_LABEL[r.seniority] ?? r.seniority}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {value && (
              <CommandGroup>
                <CommandItem value="__clear__" onSelect={() => pick("", null)}>
                  <span className="ml-6 text-muted-foreground">Limpar</span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
