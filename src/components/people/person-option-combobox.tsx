// Lista de escolha para campos da ficha de Pessoa, preservando valores antigos.
import { useState } from "react";
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
import { isLegacyValue } from "@/lib/people/person-field-options";
import { cn } from "@/lib/utils";

export function PersonOptionCombobox({
  id,
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  id?: string;
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const legacy = isLegacyValue(value, options);
  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
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
          aria-label={label}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value ? (legacy ? `Valor anterior: ${value}` : value) : "Selecione"}
          </span>
          <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder={`Buscar ${label.toLowerCase()}…`} />
          <CommandList className="max-h-72 overflow-y-auto">
            <CommandEmpty>Nenhuma opção encontrada.</CommandEmpty>
            {legacy && (
              <CommandGroup heading="Valor anterior">
                <CommandItem value={`__legacy__${value}`} onSelect={() => setOpen(false)}>
                  <Check className="mr-2 h-4 w-4" />
                  <span className="truncate">{value}</span>
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              {options.map((o) => (
                <CommandItem key={o} value={o} onSelect={() => pick(o)}>
                  <Check
                    className={cn("mr-2 h-4 w-4", value === o ? "opacity-100" : "opacity-0")}
                  />
                  {o}
                </CommandItem>
              ))}
              {value && (
                <CommandItem value="__clear__" onSelect={() => pick("")}>
                  <span className="ml-6 text-muted-foreground">Limpar</span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
