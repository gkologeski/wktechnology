// Campo "Contatado": escolha de um ou mais contatos (padrão HubSpot).
import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
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
  fetchContactOptions,
  searchContactOptions,
  type ContactOption,
} from "@/lib/timeline/contacted-contacts";

export function ContactedPicker({
  value,
  onChange,
  defaultContactId,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  defaultContactId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<ContactOption[]>([]);
  const [selected, setSelected] = useState<ContactOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (defaultContactId && value.length === 0) onChange([defaultContactId]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultContactId]);

  useEffect(() => {
    void fetchContactOptions(value).then(setSelected).catch(() => {});
  }, [value]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(false);
    const t = setTimeout(() => {
      searchContactOptions(q)
        .then(setOptions)
        .catch(() => setError(true))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, open]);

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  const label =
    selected.length === 0
      ? "0 contatos"
      : selected.length === 1
        ? selected[0].name
        : `${selected.length} contatos`;

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">Contatado</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="h-9 text-left text-sm font-semibold text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1"
            aria-label="Selecionar contatos contatados"
          >
            {label}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Buscar contato..." value={q} onValueChange={setQ} />
            <CommandList>
              {loading && (
                <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Buscando...
                </div>
              )}
              {error && <div className="p-3 text-xs text-destructive">Falha ao buscar contatos.</div>}
              {!loading && !error && <CommandEmpty>Nenhum contato encontrado.</CommandEmpty>}
              <CommandGroup>
                {[...selected, ...options.filter((o) => !value.includes(o.id))].map((o) => (
                  <CommandItem key={o.id} value={o.id} onSelect={() => toggle(o.id)}>
                    <Check
                      className={`mr-2 h-4 w-4 ${value.includes(o.id) ? "opacity-100" : "opacity-0"}`}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm">{o.name}</div>
                      {o.email && (
                        <div className="truncate text-xs text-muted-foreground">{o.email}</div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
