// Filtros do painel (apresentação). Opções vêm por busca limitada (callback), nunca listas inteiras.
import { useEffect, useState } from "react";
import { projectStatusLabel } from "@/lib/projects/delivery-labels";
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import { FilterBar } from "@/components/techhire/ui";
import { IsoDateRangePicker } from "@/components/iso-date-range-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  DASH_ENTRY_STATUSES,
  DASH_ORIGINS,
  DASH_ORIGIN_LABEL,
  type DashFilterKey,
  type DashSearch,
} from "@/lib/projects/dashboard-views.shared";
import type { DashFilterOption } from "@/lib/projects/dashboard-views.types";
import { DASHBOARD_HOURS_STATUS_LABEL } from "@/lib/projects/reconciliation-labels";

type EntityKind = "project" | "company" | "service" | "leader" | "person";
const ENTITY_LABEL: Record<EntityKind, string> = {
  project: "Projeto",
  company: "Cliente",
  service: "Serviço",
  leader: "Líder",
  person: "Pessoa",
};

function EntityFilter({
  kind,
  value,
  label,
  onChange,
  onSearch,
  disabled,
}: {
  kind: EntityKind;
  value: string | undefined;
  label: string | undefined;
  onChange: (id: string | undefined, label?: string) => void;
  onSearch: (kind: EntityKind, q: string) => Promise<DashFilterOption[]>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<DashFilterOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const t = setTimeout(() => {
      setLoading(true);
      setFailed(false);
      onSearch(kind, q)
        .then((r) => alive && setItems(r))
        .catch(() => alive && setFailed(true))
        .finally(() => alive && setLoading(false));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [open, q, kind, onSearch]);
  const id = `dash-filter-${kind}`;
  return (
    <div className="flex min-w-[10rem] flex-col gap-1">
      <Label htmlFor={id} className="text-xs text-text-secondary">
        {ENTITY_LABEL[kind]}
      </Label>
      <div className="flex items-center gap-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={id}
              variant="outline"
              size="sm"
              role="combobox"
              aria-expanded={open}
              disabled={disabled}
              className="h-9 w-full justify-between font-normal"
            >
              <span className={cn("truncate", !value && "text-text-tertiary")}>
                {value ? (label ?? "Selecionado") : "Todos"}
              </span>
              <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder={`Buscar ${ENTITY_LABEL[kind].toLowerCase()}…`}
                value={q}
                onValueChange={setQ}
              />
              <CommandList>
                {loading ? (
                  <div className="flex items-center gap-2 p-3 text-sm text-text-secondary">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Buscando…
                  </div>
                ) : failed ? (
                  <div className="p-3 text-sm text-destructive">Não foi possível buscar.</div>
                ) : (
                  <CommandEmpty>Nada encontrado no seu acesso.</CommandEmpty>
                )}
                <CommandGroup>
                  {items.map((it) => (
                    <CommandItem
                      key={it.id}
                      value={it.id}
                      onSelect={() => {
                        onChange(it.id, it.label);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === it.id ? "opacity-100" : "opacity-0",
                        )}
                        aria-hidden
                      />
                      <span className="truncate">{it.label}</span>
                      {it.hint ? (
                        <span className="ml-auto text-xs text-text-tertiary">
                          {kind === "project" ? projectStatusLabel(it.hint) : it.hint}
                        </span>
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {value ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={() => onChange(undefined)}
            aria-label={`Limpar filtro ${ENTITY_LABEL[kind]}`}
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function DashFilters({
  allowed,
  from,
  to,
  tz,
  search,
  labels,
  showCompare,
  onPeriod,
  onChange,
  onReset,
  onSearch,
  disabled,
}: {
  allowed: DashFilterKey[];
  from: string;
  to: string;
  tz: string;
  search: DashSearch;
  labels: Partial<Record<EntityKind, string>>;
  showCompare: boolean;
  onPeriod: (r: { from: string; to: string } | null) => void;
  onChange: (patch: Partial<DashSearch>, label?: { kind: EntityKind; label?: string }) => void;
  onReset: () => void;
  onSearch: (kind: EntityKind, q: string) => Promise<DashFilterOption[]>;
  disabled?: boolean;
}) {
  const has = (k: DashFilterKey) => allowed.includes(k);
  const active = allowed.some((k) => !!search[k]) || !!search.compare;
  return (
    <FilterBar
      chips={
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[14rem] flex-col gap-1">
            <span className="text-xs text-text-secondary">Período ({tz})</span>
            <IsoDateRangePicker
              size="sm"
              align="start"
              ariaLabel="Período do painel"
              from={from}
              to={to}
              defaultPreset="thisMonth"
              onChange={(r) => onPeriod(r)}
              onClear={() => onPeriod(null)}
            />
          </div>
          {(["project", "company", "service", "leader", "person"] as EntityKind[])
            .filter((k) => has(k))
            .map((k) => (
              <EntityFilter
                key={k}
                kind={k}
                value={search[k]}
                label={labels[k]}
                disabled={disabled}
                onSearch={onSearch}
                onChange={(id, label) => onChange({ [k]: id }, { kind: k, label })}
              />
            ))}
          {has("origin") ? (
            <div className="flex min-w-[9rem] flex-col gap-1">
              <Label htmlFor="dash-origin" className="text-xs text-text-secondary">
                Origem
              </Label>
              <Select
                value={search.origin ?? "__all__"}
                onValueChange={(v) => onChange({ origin: v === "__all__" ? undefined : v })}
                disabled={disabled}
              >
                <SelectTrigger id="dash-origin" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {DASH_ORIGINS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {DASH_ORIGIN_LABEL[o]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {has("status") ? (
            <div className="flex min-w-[10rem] flex-col gap-1">
              <Label htmlFor="dash-status" className="text-xs text-text-secondary">
                Situação das horas
              </Label>
              <Select
                value={search.status ?? "__all__"}
                onValueChange={(v) => onChange({ status: v === "__all__" ? undefined : v })}
                disabled={disabled}
              >
                <SelectTrigger id="dash-status" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {DASH_ENTRY_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {DASHBOARD_HOURS_STATUS_LABEL[s] ?? s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {has("currency") ? (
            <div className="flex min-w-[7rem] flex-col gap-1">
              <Label htmlFor="dash-currency" className="text-xs text-text-secondary">
                Moeda
              </Label>
              <Select
                value={search.currency ?? "__all__"}
                onValueChange={(v) => onChange({ currency: v === "__all__" ? undefined : v })}
                disabled={disabled}
              >
                <SelectTrigger id="dash-currency" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas (separadas)</SelectItem>
                  {["BRL", "USD", "EUR"].map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {showCompare ? (
            <div className="flex items-center gap-2 pb-2">
              <Switch
                id="dash-compare"
                checked={!!search.compare}
                onCheckedChange={(v) => onChange({ compare: v || undefined })}
                disabled={disabled}
              />
              <Label htmlFor="dash-compare" className="text-xs text-text-secondary">
                Comparar com período anterior
              </Label>
            </div>
          ) : null}
        </div>
      }
      actions={
        active ? (
          <Button variant="ghost" size="sm" onClick={onReset}>
            Limpar filtros
          </Button>
        ) : null
      }
    />
  );
}
