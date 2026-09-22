// Seletor de preset de contratação vinculado a uma linha de serviço do catálogo.
// Reutilizado em itens de linha de negócios/propostas, cotações e alocações.
// Busca online com debounce (padrão do campo Empresa); sem Supabase direto.
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronsUpDown, Layers } from "lucide-react";
import { listPresetsForService } from "@/lib/contracting-presets.functions";
import {
  presetSummary,
  presetsForServiceQueryKey,
  type PresetOption,
} from "@/lib/contracting-presets-shared";
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

export function usePresetsForService(serviceCatalogId: string | null | undefined) {
  const listPresets = useServerFn(listPresetsForService);
  return useQuery({
    queryKey: presetsForServiceQueryKey(serviceCatalogId),
    enabled: Boolean(serviceCatalogId),
    queryFn: async () =>
      (await listPresets({
        data: { serviceCatalogId: serviceCatalogId ?? null },
      })) as unknown as PresetOption[],
  });
}

export function PresetLinePicker({
  serviceCatalogId,
  value,
  onApply,
  label = "Preset de contratação",
  disabled,
}: {
  serviceCatalogId: string | null | undefined;
  value: string | null | undefined;
  onApply: (preset: PresetOption | null) => void;
  label?: string;
  disabled?: boolean;
}) {
  const listPresets = useServerFn(listPresetsForService);
  const [open, setOpen] = useState(false);
  const [rawQ, setRawQ] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQ(rawQ.trim()), 200);
    return () => clearTimeout(t);
  }, [rawQ]);

  // Presença de presets para o serviço (define se o campo aparece).
  const base = usePresetsForService(serviceCatalogId);

  const search = useQuery({
    queryKey: [...presetsForServiceQueryKey(serviceCatalogId), "search", q],
    enabled: open && Boolean(serviceCatalogId),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    queryFn: async () =>
      (await listPresets({
        data: { serviceCatalogId: serviceCatalogId ?? null, search: q || undefined },
      })) as unknown as PresetOption[],
  });

  const selected = useQuery({
    queryKey: ["contracting_presets", "by-id", value ?? "none"],
    enabled: Boolean(value),
    staleTime: 300_000,
    queryFn: async () =>
      ((await listPresets({ data: { ids: [value as string] } })) as unknown as PresetOption[])[0] ??
      null,
  });

  if (!serviceCatalogId) return null;
  if (!base.isLoading && (base.data?.length ?? 0) === 0 && !value) return null;

  const items = search.data ?? [];
  const selectedPreset = selected.data ?? null;
  const triggerLabel = value
    ? selectedPreset
      ? [selectedPreset.name, presetSummary(selectedPreset)].filter(Boolean).join(" · ")
      : "Carregando…"
    : "Sem preset";

  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground" id="preset-label">
        {label}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={label}
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className={cn("truncate", !value && "text-muted-foreground")}>
                {triggerLabel}
              </span>
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(28rem,90vw)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              value={rawQ}
              onValueChange={setRawQ}
              placeholder="Buscar preset por nome ou código…"
            />
            <CommandList>
              {search.isError && (
                <div className="px-3 py-2 text-sm text-destructive">
                  Erro ao buscar presets.{" "}
                  <button type="button" className="underline" onClick={() => void search.refetch()}>
                    Tentar novamente
                  </button>
                </div>
              )}
              {search.isFetching && items.length === 0 && !search.isError && (
                <div className="px-3 py-2 text-sm text-muted-foreground">Buscando…</div>
              )}
              {!search.isFetching && !search.isError && items.length === 0 && (
                <CommandEmpty>Nenhum preset encontrado.</CommandEmpty>
              )}
              <CommandItem
                value="__none__"
                onSelect={() => {
                  onApply(null);
                  setOpen(false);
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                <span className="text-muted-foreground">Sem preset</span>
              </CommandItem>
              {items.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.id}
                  onSelect={() => {
                    onApply(p);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", value === p.id ? "opacity-100" : "opacity-0")}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{p.name}</span>
                    {presetSummary(p) ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {presetSummary(p)}
                      </span>
                    ) : null}
                  </span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
