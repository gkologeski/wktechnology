// Menu "Atividade" da timeline: busca, "Selecionar tudo" e grupos com caixas
// de seleção, no formato do HubSpot.
import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ALL_CATEGORIES,
  TIMELINE_CATEGORY_GROUPS,
  type TimelineCategory,
} from "@/lib/timeline/timeline-filters";

export function ActivityTypeFilter({
  value,
  onChange,
}: {
  value: TimelineCategory[];
  onChange: (v: TimelineCategory[]) => void;
}) {
  const [q, setQ] = useState("");
  const selected = new Set(value);
  const groups = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return TIMELINE_CATEGORY_GROUPS;
    return TIMELINE_CATEGORY_GROUPS.map((g) => ({
      ...g,
      items: g.label.toLowerCase().includes(t)
        ? g.items
        : g.items.filter((i) => i.label.toLowerCase().includes(t)),
    })).filter((g) => g.items.length);
  }, [q]);

  const toggle = (keys: TimelineCategory[], on: boolean) => {
    const next = new Set(selected);
    for (const k of keys) {
      if (on) next.add(k);
      else next.delete(k);
    }
    onChange(ALL_CATEGORIES.filter((k) => next.has(k)));
  };
  const allOn = value.length === ALL_CATEGORIES.length;
  const label = allOn ? "Atividade" : `Atividade (${value.length})`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs font-semibold">
          {label} <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(92vw,40rem)] p-0">
        <div className="relative border-b border-border p-2">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pesquisar"
            aria-label="Pesquisar tipos de atividade"
            className="h-8 pl-8 text-sm"
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-3">
          <label className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Checkbox
              checked={allOn ? true : value.length ? "indeterminate" : false}
              onCheckedChange={(v) => toggle(ALL_CATEGORIES, v === true)}
            />
            Selecionar tudo
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            {groups.map((g) => {
              const keys = g.items.map((i) => i.key);
              const on = keys.filter((k) => selected.has(k)).length;
              return (
                <fieldset key={g.label} className="space-y-2">
                  <legend className="sr-only">{g.label}</legend>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Checkbox
                      checked={on === keys.length ? true : on ? "indeterminate" : false}
                      onCheckedChange={(v) => toggle(keys, v === true)}
                    />
                    {g.label}
                  </label>
                  {g.items.map((i) => (
                    <label
                      key={i.key}
                      className="ml-6 flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <Checkbox
                        checked={selected.has(i.key)}
                        onCheckedChange={(v) => toggle([i.key], v === true)}
                      />
                      {i.label}
                    </label>
                  ))}
                </fieldset>
              );
            })}
            {!groups.length && (
              <p className="text-sm text-muted-foreground">Nenhum tipo encontrado.</p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
