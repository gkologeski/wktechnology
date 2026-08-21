import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X, Settings2, Target } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { Pipeline } from "@/lib/pipelines";
import { DATE_PRESETS, DATE_PRESET_LABELS, type DatePreset } from "@/lib/date-presets";

export type DealPeriod = DatePreset | "overdue" | "no_date";

export type DealFilters = {
  ownerId: string; // "" = all
  period: DealPeriod;
  customStart: string;
  customEnd: string;
  minValue: string;
  search: string;
  /** Filtro pela data real de fechamento (closed_at para ganhos, lost_at para perdidos). */
  closedPeriod: DatePreset;
  closedStart: string;
  closedEnd: string;
};

export const EMPTY_DEAL_FILTERS: DealFilters = {
  ownerId: "",
  period: "any",
  customStart: "",
  customEnd: "",
  minValue: "",
  search: "",
  closedPeriod: "any",
  closedStart: "",
  closedEnd: "",
};


export const PERIOD_LABELS: Record<DealPeriod, string> = {
  ...DATE_PRESET_LABELS,
  any: "Qualquer data",
  overdue: "Atrasados",
  no_date: "Sem data",
};

// Ordem exibida no dropdown.
const PERIOD_ORDER: DealPeriod[] = [...DATE_PRESETS, "overdue", "no_date"];

export function DealsToolbar({
  pipelines,
  selectedPipelineId,
  onSelectPipeline,
  owners,
  filters,
  setFilters,
  focusMode,
  onToggleFocus,
  hotCount,
}: {
  pipelines: Pipeline[];
  selectedPipelineId: string | null;
  onSelectPipeline: (id: string) => void;
  owners: { id: string; name: string }[];
  filters: DealFilters;
  setFilters: (f: DealFilters) => void;
  focusMode?: boolean;
  onToggleFocus?: (b: boolean) => void;
  hotCount?: number;
}) {
  const setF = <K extends keyof DealFilters>(k: K, v: DealFilters[K]) =>
    setFilters({ ...filters, [k]: v });

  const chips: { key: keyof DealFilters; label: string; clear: () => void }[] = [];
  if (filters.ownerId) {
    const o = owners.find((x) => x.id === filters.ownerId);
    chips.push({
      key: "ownerId",
      label: `Responsável: ${o?.name ?? filters.ownerId}`,
      clear: () => setF("ownerId", ""),
    });
  }
  if (filters.period !== "any") {
    chips.push({
      key: "period",
      label: PERIOD_LABELS[filters.period],
      clear: () => setF("period", "any"),
    });
  }
  if (filters.minValue) {
    chips.push({
      key: "minValue",
      label: `≥ ${filters.minValue}`,
      clear: () => setF("minValue", ""),
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={selectedPipelineId ?? ""} onValueChange={onSelectPipeline}>
          <SelectTrigger className="h-9 w-[220px] font-medium">
            <SelectValue placeholder="Selecione pipeline" />
          </SelectTrigger>
          <SelectContent>
            {pipelines.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
                {p.is_default && " · padrão"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button asChild variant="ghost" size="sm" className="h-9 px-2">
          <Link to="/settings/pipelines">
            <Settings2 className="h-4 w-4" />
          </Link>
        </Button>

        {onToggleFocus && (
          <Button
            type="button"
            variant={focusMode ? "default" : "outline"}
            size="sm"
            className={`h-9 ${
              focusMode
                ? "bg-[color:var(--hs-orange)] text-[color:var(--hs-orange-foreground)] hover:bg-[color:var(--hs-orange)]/90"
                : ""
            }`}
            onClick={() => onToggleFocus(!focusMode)}
            aria-pressed={!!focusMode}
            title="Ordena por proximidade de fechamento e esmaece negócios frios"
          >
            <Target className="h-4 w-4 mr-1" />
            Foco em fechamento
            {focusMode && hotCount !== undefined && hotCount > 0 ? (
              <span className="ml-1.5 rounded bg-black/10 px-1.5 text-[10px] tabular-nums">
                {hotCount}
              </span>
            ) : null}
          </Button>
        )}

        <div className="flex-1" />

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => setF("search", e.target.value)}
            placeholder="Buscar negócios…"
            className="pl-8 h-9 w-[240px]"
          />
        </div>

        <Select
          value={filters.ownerId || "all"}
          onValueChange={(v) => setF("ownerId", v === "all" ? "" : v)}
        >
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os responsáveis</SelectItem>
            {owners.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.period} onValueChange={(v) => setF("period", v as DealPeriod)}>
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_ORDER.map((k) => (
              <SelectItem key={k} value={k}>
                {PERIOD_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {filters.period === "custom" && (
          <>
            <Input
              type="date"
              value={filters.customStart}
              onChange={(e) => setF("customStart", e.target.value)}
              className="h-9 w-[150px]"
            />
            <Input
              type="date"
              value={filters.customEnd}
              onChange={(e) => setF("customEnd", e.target.value)}
              className="h-9 w-[150px]"
            />
          </>
        )}

        <Input
          value={filters.minValue}
          onChange={(e) => setF("minValue", e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="Valor mínimo"
          className="h-9 w-[140px]"
        />
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <Badge key={c.key} variant="secondary" className="gap-1 pl-2 pr-1 py-0.5 text-xs">
              {c.label}
              <button onClick={c.clear} className="rounded hover:bg-muted-foreground/20 p-0.5">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() =>
              setFilters({ ...EMPTY_DEAL_FILTERS, search: filters.search })
            }

          >
            Limpar
          </Button>
        </div>
      )}
    </div>
  );
}
