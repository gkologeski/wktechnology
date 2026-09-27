import { useMemo, useState } from "react";
import { Braces, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import type { MessageToken } from "@/lib/message-tokens-catalog";

export function VariablePicker({ tokens, value, label, onInsert }: {
  tokens: MessageToken[];
  value: string;
  label: string;
  onInsert: (token: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = tokens.find((token) => token.token === value.trim());
  const groups = useMemo(() => {
    const map = new Map<string, MessageToken[]>();
    for (const token of tokens) {
      const group = token.group || "Outras variáveis";
      map.set(group, [...(map.get(group) ?? []), token]);
    }
    return [...map.entries()];
  }, [tokens]);
  if (!tokens.length) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 max-w-full gap-1.5 text-xs font-normal" aria-label={`Selecionar ${label.toLowerCase()}`}>
          <Braces className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{selected ? `${selected.group || "Registro"} → ${selected.label}` : `Selecionar ${label.toLowerCase()}`}</span>
          <ChevronDown className="h-3 w-3 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="pointer-events-auto z-[180] w-[min(24rem,calc(100vw-2rem))] p-0">
        <Command>
          <CommandInput placeholder="Pesquisar variável..." aria-label="Pesquisar variável" />
          <CommandList className="max-h-72">
            <CommandEmpty>Nenhuma variável encontrada.</CommandEmpty>
            {groups.map(([group, items]) => (
              <CommandGroup key={group} heading={group === "Registro" ? "Dados do registro que iniciou o workflow" : group}>
                {items.map((item) => (
                  <CommandItem key={`${group}-${item.token}`} value={`${group} ${item.label} ${item.token}`} onSelect={() => { onInsert(item.token); setOpen(false); }}>
                    <span className="flex-1 truncate">{item.label}</span>
                    <span className="sr-only">{item.token}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}