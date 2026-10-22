// Valor de filtro de público com lista dos valores já existentes no workspace.
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
import { listAudienceFieldValues } from "@/lib/whatsapp-campaigns.functions";
import type { AudienceBase } from "@/lib/whatsapp/campaign-audience";
import { cn } from "@/lib/utils";
import { TermPills, addTerm } from "./audience-terms-input";

export function AudienceValueCombobox({
  entity,
  column,
  label,
  value,
  onChange,
  terms,
  onTermsChange,
}: {
  entity: AudienceBase;
  column: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Modo múltiplo (pills): cada escolha adiciona um termo e mantém a lista aberta. */
  terms?: string[];
  onTermsChange?: (terms: string[]) => void;
}) {
  const multi = !!onTermsChange;
  const list = terms ?? [];
  const fn = useServerFn(listAudienceFieldValues);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const term = useDebouncedValue(search, 300);
  const q = useQuery({
    queryKey: ["wa-camp-field-values", entity, column, term],
    enabled: open,
    staleTime: 60_000,
    queryFn: () => fn({ data: { entity, column, search: term || undefined } }),
  });
  const values = q.data ?? [];
  const typed = search.trim();
  const showTyped =
    typed && !values.some((v) => v.toLocaleLowerCase("pt-BR") === typed.toLocaleLowerCase("pt-BR"));

  const pick = (v: string) => {
    if (multi) {
      onTermsChange!(addTerm(list, v));
      setSearch("");
      return;
    }
    onChange(v);
    setOpen(false);
    setSearch("");
  };
  const isPicked = (v: string) =>
    multi
      ? list.some((x) => x.toLocaleLowerCase("pt-BR") === v.toLocaleLowerCase("pt-BR"))
      : value === v;

  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={`Valor do filtro ${label}`}
          className={cn(
            "justify-between font-normal",
            multi ? "h-auto min-h-9 w-72 py-1" : "w-48",
          )}
        >
          {multi && list.length ? (
            <span className="flex flex-wrap gap-1">
              <TermPills
                terms={list}
                label={label}
                onRemove={(i) => onTermsChange!(list.filter((_, j) => j !== i))}
              />
            </span>
          ) : (
            <span className={cn("truncate", !(multi ? list.length : value) && "text-muted-foreground")}>
              {multi ? "Escolha ou digite termos" : value || "Escolha ou digite"}
            </span>
          )}
          <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={`Buscar ${label.toLowerCase()}…`}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {q.isLoading ? (
              <div className="p-3 text-xs text-muted-foreground">Carregando valores…</div>
            ) : q.isError ? (
              <div className="p-3 text-xs text-destructive">
                Não foi possível carregar os valores. Digite o valor desejado.
              </div>
            ) : (
              <CommandEmpty>Nenhum valor encontrado.</CommandEmpty>
            )}
            {showTyped && (
              <CommandGroup heading="Usar o texto digitado">
                <CommandItem value={`__typed__${typed}`} onSelect={() => pick(typed)}>
                  “{typed}”
                </CommandItem>
              </CommandGroup>
            )}
            {values.length > 0 && (
              <CommandGroup heading="Valores existentes">
                {values.map((v) => (
                  <CommandItem key={v} value={v} onSelect={() => pick(v)}>
                    <Check
                      className={cn("mr-2 h-4 w-4", isPicked(v) ? "opacity-100" : "opacity-0")}
                    />
                    <span className="truncate">{v}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
