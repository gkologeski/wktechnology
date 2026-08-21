// Seletor de campos de referência (empresa, contato, usuário, etc.) usado na
// edição em massa. Busca server-side com debounce, respeitando a RLS; grava o
// ID e nunca exibe hash na interface.
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { RefKind } from "@/lib/entity-fields-refs";
import {
  searchCompanies,
  searchContacts,
  searchContracts,
  searchDeals,
  searchLegalEntities,
  searchPipelines,
  searchUsers,
} from "@/lib/workflow-refs.functions";

type Item = { id: string; name: string };

const PLACEHOLDER: Record<RefKind, string> = {
  user: "Selecionar usuário…",
  company: "Selecionar empresa…",
  contact: "Selecionar contato…",
  pipeline: "Selecionar pipeline…",
  legal_entity: "Selecionar pessoa jurídica…",
  contract: "Selecionar contrato…",
  deal: "Selecionar negócio…",
};

export function BulkRefPicker({
  kind,
  value,
  onChange,
}: {
  kind: RefKind;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rawQ, setRawQ] = useState("");
  const [q, setQ] = useState("");

  const fetchCompanies = useServerFn(searchCompanies);
  const fetchContacts = useServerFn(searchContacts);
  const fetchPipelines = useServerFn(searchPipelines);
  const fetchUsers = useServerFn(searchUsers);
  const fetchLegalEntities = useServerFn(searchLegalEntities);
  const fetchContracts = useServerFn(searchContracts);
  const fetchDeals = useServerFn(searchDeals);

  useEffect(() => {
    const t = setTimeout(() => setQ(rawQ.trim()), 200);
    return () => clearTimeout(t);
  }, [rawQ]);

  const run = async (args: { q?: string; ids?: string[] }): Promise<Item[]> => {
    const data = { q: args.q || undefined, ids: args.ids };
    if (kind === "company") return (await fetchCompanies({ data })) as Item[];
    if (kind === "contact") return (await fetchContacts({ data })) as Item[];
    if (kind === "pipeline") return (await fetchPipelines({ data })) as Item[];
    if (kind === "legal_entity") return (await fetchLegalEntities({ data })) as Item[];
    if (kind === "contract") return (await fetchContracts({ data })) as Item[];
    if (kind === "deal") return (await fetchDeals({ data })) as Item[];
    return (await fetchUsers({ data })) as Item[];
  };

  const search = useQuery({
    queryKey: ["bulk-ref-search", kind, q],
    enabled: open,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    queryFn: () => run({ q }),
  });

  const selected = useQuery({
    queryKey: ["bulk-ref-label", kind, value],
    enabled: !!value,
    staleTime: 300_000,
    queryFn: async () => (await run({ ids: [value] }))[0]?.name ?? "",
  });

  const items = search.data ?? [];
  const label = value ? selected.data || "Carregando…" : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {label || PLACEHOLDER[kind]}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(28rem,90vw)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={rawQ} onValueChange={setRawQ} placeholder="Buscar por nome…" />
          <CommandList>
            {search.isFetching && items.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">Buscando…</div>
            )}
            {!search.isFetching && items.length === 0 && (
              <CommandEmpty>Nenhum resultado.</CommandEmpty>
            )}
            {value && (
              <CommandItem
                value="__clear__"
                onSelect={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                <span className="text-muted-foreground">— Limpar seleção</span>
              </CommandItem>
            )}
            {items.map((it) => (
              <CommandItem
                key={it.id}
                value={it.id}
                onSelect={() => {
                  onChange(it.id);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn("mr-2 h-4 w-4", value === it.id ? "opacity-100" : "opacity-0")}
                />
                <span className="truncate">{it.name}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
