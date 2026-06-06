// Picker de intervalo de datas em pt-BR para filtros (segmentos / listas).
// Emite valor serializável { preset, custom?: { start, end } } e
// também expõe o intervalo resolvido { start, end } ISO.
import { useMemo, useState } from "react";
import { CalendarIcon } from "lucide-react";
import {
  DATE_PRESETS,
  DATE_PRESET_LABELS,
  getDateRange,
  type CustomRange,
  type DatePreset,
} from "@/lib/date-presets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type DateRangeValue = {
  preset: DatePreset;
  custom?: CustomRange;
};

// Grupos visuais conforme a skill date-range-picker-br.
const GROUPS: { title: string; presets: DatePreset[] }[] = [
  {
    title: "Dias",
    presets: ["today", "yesterday", "tomorrow"],
  },
  {
    title: "Semanas",
    presets: ["this_week", "last_week", "next_week"],
  },
  {
    title: "Meses",
    presets: ["this_month", "last_month", "next_month"],
  },
  {
    title: "Trimestres",
    presets: ["this_quarter", "last_quarter", "next_quarter"],
  },
  {
    title: "Semestres",
    presets: ["this_semester", "last_semester", "next_semester"],
  },
  {
    title: "Anos",
    presets: ["this_year", "last_year", "next_year"],
  },
  {
    title: "Últimos N dias",
    presets: [
      "last_7d",
      "last_14d",
      "last_30d",
      "last_60d",
      "last_90d",
      "last_180d",
      "last_365d",
    ],
  },
];

function format(d?: Date): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(d);
}

export function describeRange(value: DateRangeValue | undefined): string {
  if (!value || value.preset === "any") return "Qualquer data";
  if (value.preset === "custom") {
    const { start, end } = value.custom ?? {};
    if (!start && !end) return "Personalizado…";
    if (start && end) return `${start} → ${end}`;
    if (start) return `≥ ${start}`;
    return `≤ ${end}`;
  }
  return DATE_PRESET_LABELS[value.preset];
}

// Converte DateRangeValue → { start, end } em ISO (YYYY-MM-DD).
// `end` é exclusivo no engine de presets; manteremos exclusivo no filtro.
export function resolveDateRange(value: DateRangeValue | undefined): {
  start?: string;
  end?: string;
} {
  if (!value) return {};
  const r = getDateRange(value.preset, new Date(), value.custom);
  const toIso = (d?: Date) =>
    d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : undefined;
  return { start: toIso(r.start), end: toIso(r.end) };
}

export function DateRangeFilter({
  value,
  onChange,
  className,
}: {
  value: DateRangeValue | undefined;
  onChange: (v: DateRangeValue) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const current: DateRangeValue = value ?? { preset: "last_30d" };
  const resolved = useMemo(() => getDateRange(current.preset, new Date(), current.custom), [current]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("h-8 flex-1 justify-start font-normal", className)}
        >
          <CalendarIcon className="h-3.5 w-3.5 mr-2 opacity-70" />
          <span className="truncate">{describeRange(current)}</span>
          {current.preset !== "any" && current.preset !== "custom" && (
            <span className="ml-auto text-xs text-muted-foreground hidden md:inline">
              {format(resolved.start)} – {format(resolved.end ? new Date(resolved.end.getTime() - 86_400_000) : undefined)}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[520px] p-0 pointer-events-auto" align="start">
        <div className="flex">
          <div className="w-56 border-r max-h-96 overflow-y-auto p-1">
            <button
              type="button"
              className={cn(
                "w-full text-left text-sm px-2 py-1.5 rounded-md hover:bg-muted",
                current.preset === "any" && "bg-muted font-medium",
              )}
              onClick={() => {
                onChange({ preset: "any" });
                setOpen(false);
              }}
            >
              {DATE_PRESET_LABELS.any}
            </button>
            {GROUPS.map((g) => (
              <div key={g.title} className="mt-1">
                <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {g.title}
                </div>
                {g.presets.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={cn(
                      "w-full text-left text-sm px-2 py-1.5 rounded-md hover:bg-muted",
                      current.preset === p && "bg-muted font-medium",
                    )}
                    onClick={() => {
                      onChange({ preset: p });
                      setOpen(false);
                    }}
                  >
                    {DATE_PRESET_LABELS[p]}
                  </button>
                ))}
              </div>
            ))}
            <div className="mt-1">
              <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                Personalizado
              </div>
              <button
                type="button"
                className={cn(
                  "w-full text-left text-sm px-2 py-1.5 rounded-md hover:bg-muted",
                  current.preset === "custom" && "bg-muted font-medium",
                )}
                onClick={() => onChange({ preset: "custom", custom: current.custom ?? {} })}
              >
                {DATE_PRESET_LABELS.custom}
              </button>
            </div>
          </div>
          <div className="flex-1 p-3 space-y-3">
            <div className="text-xs text-muted-foreground">
              {describeRange(current)}
            </div>
            <div className="space-y-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">De</label>
                <Input
                  type="date"
                  value={current.custom?.start ?? ""}
                  onChange={(e) =>
                    onChange({
                      preset: "custom",
                      custom: { ...(current.custom ?? {}), start: e.target.value || undefined },
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Até</label>
                <Input
                  type="date"
                  value={current.custom?.end ?? ""}
                  onChange={(e) =>
                    onChange({
                      preset: "custom",
                      custom: { ...(current.custom ?? {}), end: e.target.value || undefined },
                    })
                  }
                />
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              className="w-full"
              onClick={() => setOpen(false)}
            >
              Aplicar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
