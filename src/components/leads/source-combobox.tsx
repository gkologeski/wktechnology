import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
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
import {
  listLeadSources,
  ensureLeadSource,
  sourceDisplayLabel,
  type LeadSource,
} from "@/lib/lead-sources";
import { useAuth } from "@/lib/auth";
import { leadSourceLabel } from "@/lib/lead-source-labels";
import { toast } from "sonner";

export function SourceCombobox({
  value,
  onChange,
  placeholder = "Selecionar fonte…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [search, setSearch] = useState("");

  const load = async () => {
    try {
      setSources(await listLeadSources(true));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar fontes");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createNew = async () => {
    if (!user || !search.trim()) return;
    try {
      await ensureLeadSource(user.id, search.trim());
      toast.success("Fonte criada");
      onChange(search.trim());
      setSearch("");
      setOpen(false);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const exists = sources.some((s) => s.name.toLowerCase() === search.trim().toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn(!value && "text-muted-foreground")}>
            {value ? leadSourceLabel(value) : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter>
          <CommandInput placeholder="Buscar ou criar…" value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>
              {search.trim() ? (
                <button
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent"
                  onClick={createNew}
                >
                  <Plus className="h-3.5 w-3.5" /> Criar “{search.trim()}”
                </button>
              ) : (
                <span className="text-xs text-muted-foreground px-2">Nenhuma fonte</span>
              )}
            </CommandEmpty>
            <CommandGroup>
              {Array.from(
                sources
                  .reduce((acc, s) => {
                    const key = sourceDisplayLabel(s).toLowerCase();
                    if (!acc.has(key)) acc.set(key, s);
                    return acc;
                  }, new Map<string, (typeof sources)[number]>())
                  .values(),
              ).map((s) => (
                <CommandItem
                  key={s.id}
                  value={s.name}
                  onSelect={() => {
                    onChange(s.name);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", value === s.name ? "opacity-100" : "opacity-0")}
                  />
                  {sourceDisplayLabel(s)}
                </CommandItem>
              ))}
              {search.trim() && !exists && (
                <CommandItem onSelect={createNew} className="text-primary">
                  <Plus className="mr-2 h-4 w-4" /> Criar “{search.trim()}”
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
