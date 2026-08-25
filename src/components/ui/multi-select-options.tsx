import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
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

export type Option = { value: string; label: string };

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  emptyText?: string;
};

/** Multi-select com popover + busca, para opções fixas (senioridade, departamento etc). */
export function MultiSelectOptions({
  value,
  onChange,
  options,
  placeholder = "Selecione...",
  className,
  emptyText = "Nenhuma opção",
}: Props) {
  const [open, setOpen] = useState(false);

  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };

  const remove = (v: string) => onChange(value.filter((x) => x !== v));

  const selectedLabels = value.map((v) => options.find((o) => o.value === v)?.label ?? v);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between min-h-9 h-auto py-1.5 font-normal",
            !value.length && "text-muted-foreground",
            className,
          )}
        >
          <div className="flex flex-wrap gap-1 items-center">
            {value.length === 0 ? (
              <span className="text-sm">{placeholder}</span>
            ) : (
              selectedLabels.map((label, i) => (
                <span
                  key={`${value[i]}-${i}`}
                  className="inline-flex items-center gap-1 rounded-md bg-secondary text-secondary-foreground px-2 py-0.5 text-xs"
                >
                  {label}
                  <span
                    role="button"
                    aria-label={`Remover ${label}`}
                    className="hover:text-destructive cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(value[i]);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </span>
                </span>
              ))
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar..." />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const isSelected = value.includes(opt.value);
                return (
                  <CommandItem key={opt.value} value={opt.label} onSelect={() => toggle(opt.value)}>
                    <Check
                      className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")}
                    />
                    {opt.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
