// Seletor de preset de contratação vinculado a uma linha de serviço do catálogo.
// Reutilizado em itens de linha de negócios/propostas, cotações e alocações.
// Componente presentacional + consulta via server function (sem Supabase direto).
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Layers } from "lucide-react";
import { listPresetsForService } from "@/lib/contracting-presets.functions";
import {
  presetSummary,
  presetsForServiceQueryKey,
  type PresetOption,
} from "@/lib/contracting-presets-shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "__none__";

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
  const { data: presets = [], isLoading } = usePresetsForService(serviceCatalogId);

  if (!serviceCatalogId) return null;
  if (!isLoading && presets.length === 0) return null;

  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <Select
        value={value ?? NONE}
        disabled={disabled || isLoading}
        onValueChange={(v) => {
          if (v === NONE) return onApply(null);
          onApply(presets.find((p) => p.id === v) ?? null);
        }}
      >
        <SelectTrigger aria-label={label}>
          <span className="inline-flex items-center gap-2 min-w-0 truncate">
            <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
            <SelectValue placeholder={isLoading ? "Carregando…" : "Sem preset"} />
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Sem preset</SelectItem>
          {presets.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              <span className="flex flex-col">
                <span>{p.name}</span>
                {presetSummary(p) ? (
                  <span className="text-xs text-muted-foreground">{presetSummary(p)}</span>
                ) : null}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
