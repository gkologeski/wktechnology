// Filtro de intervalo de datas em pt-BR (segmentos / listas / grids).
// Wrapper serializável do seletor oficial: emite { preset, custom?: { start, end } }
// e expõe o intervalo resolvido em ISO via `resolveDateRange`.
// Regras da skill date-range-picker-br: "Período" (personalizado) no topo,
// seleção personalizada em dois cliques e popover que não fecha no 1º clique.
import { useMemo, useState } from "react";
import { CalendarIcon } from "lucide-react";
import { format as formatDateFns } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange as RDPDateRange } from "react-day-picker";

import {
  DATE_PRESET_LABELS,
  getDateRange,
  type CustomRange,
  type DatePreset,
} from "@/lib/date-presets";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export type DateRangeValue = {
  preset: DatePreset;
  custom?: CustomRange;
};

// Grupos visuais conforme a skill date-range-picker-br.
const GROUPS: { title: string; presets: DatePreset[] }[] = [
  { title: "Dias", presets: ["today", "yesterday", "tomorrow"] },
  { title: "Semanas", presets: ["this_week", "last_week", "next_week"] },
  { title: "Meses", presets: ["this_month", "last_month", "next_month"] },
  { title: "Trimestres", presets: ["this_quarter", "last_quarter", "next_quarter"] },
  { title: "Semestres", presets: ["this_semester", "last_semester", "next_semester"] },
  { title: "Anos", presets: ["this_year", "last_year", "next_year"] },
  {
    title: "Últimos N dias",
    presets: ["last_7d", "last_14d", "last_30d", "last_60d", "last_90d", "last_180d", "last_365d"],
  },
];

function format(d?: Date): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(d);
}

function toIsoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseIsoDay(v?: string): Date | undefined {
  if (!v) return undefined;
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

export function describeRange(value: DateRangeValue | undefined): string {
  if (!value || value.preset === "any") return "Qualquer data";
  if (value.preset === "custom") {
    const start = parseIsoDay(value.custom?.start);
    const end = parseIsoDay(value.custom?.end);
    if (!start && !end) return "Período";
    if (start && end)
      return `${formatDateFns(start, "dd/MM/yyyy", { locale: ptBR })} – ${formatDateFns(end, "dd/MM/yyyy", { locale: ptBR })}`;
    if (start) return `≥ ${formatDateFns(start, "dd/MM/yyyy", { locale: ptBR })}`;
    return `≤ ${formatDateFns(end as Date, "dd/MM/yyyy", { locale: ptBR })}`;
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
  return {
    start: r.start ? toIsoDay(r.start) : undefined,
    end: r.end ? toIsoDay(r.end) : undefined,
  };
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
  const [pending, setPending] = useState<{ from: Date } | null>(null);
  const current: DateRangeValue = value ?? { preset: "last_30d" };
  const resolved = useMemo(
    () => getDateRange(current.preset, new Date(), current.custom),
    [current],
  );

  function selectPreset(preset: DatePreset) {
    setPending(null);
    onChange(preset === "any" ? { preset: "any" } : { preset });
    setOpen(false);
  }

  function handleCalendar(r: RDPDateRange | undefined) {
    const clicked = pending ? (r?.to ?? r?.from) : (r?.from ?? r?.to);
    if (!clicked) return;
    if (!pending) {
      setPending({ from: clicked });
      return;
    }
    const [from, to] =
      clicked.getTime() < pending.from.getTime()
        ? [clicked, pending.from]
        : [pending.from, clicked];
    setPending(null);
    onChange({ preset: "custom", custom: { start: toIsoDay(from), end: toIsoDay(to) } });
    setOpen(false);
  }

  const customFrom = parseIsoDay(current.custom?.start);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!next && pending) return;
        if (!next) setPending(null);
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Selecionar período"
          className={cn("h-8 flex-1 justify-start font-normal", className)}
        >
          <CalendarIcon aria-hidden="true" className="mr-2 h-3.5 w-3.5 opacity-70" />
          <span className="truncate">{describeRange(current)}</span>
          {current.preset !== "any" && current.preset !== "custom" && (
            <span className="ml-auto hidden text-xs text-muted-foreground md:inline">
              {format(resolved.start)} –{" "}
              {format(resolved.end ? new Date(resolved.end.getTime() - 86_400_000) : undefined)}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="pointer-events-auto w-auto p-0" align="start">
        <div className="flex flex-col sm:flex-row">
          <ScrollArea className="h-[300px] w-full border-b sm:h-[360px] sm:w-[220px] sm:border-b-0 sm:border-r">
            <div className="p-2">
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                Personalizado
              </div>
              <button
                type="button"
                className={cn(
                  "w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                  current.preset === "custom" && "bg-accent text-accent-foreground",
                )}
                onClick={() => onChange({ preset: "custom", custom: current.custom ?? {} })}
              >
                Período
              </button>
              <Separator className="my-2" />
              <button
                type="button"
                className={cn(
                  "w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                  current.preset === "any" && "bg-accent text-accent-foreground",
                )}
                onClick={() => selectPreset("any")}
              >
                {DATE_PRESET_LABELS.any}
              </button>
              {GROUPS.map((g) => (
                <div key={g.title}>
                  <Separator className="my-2" />
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                    {g.title}
                  </div>
                  {g.presets.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={cn(
                        "w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                        current.preset === p && "bg-accent text-accent-foreground",
                      )}
                      onClick={() => selectPreset(p)}
                    >
                      {DATE_PRESET_LABELS[p]}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </ScrollArea>
          <div>
            {pending ? (
              <p className="px-3 pt-3 text-xs text-muted-foreground">
                Início {formatDateFns(pending.from, "dd/MM/yyyy", { locale: ptBR })} — escolha a
                data final.
              </p>
            ) : null}
            <Calendar
              mode="range"
              numberOfMonths={2}
              defaultMonth={pending?.from ?? customFrom ?? resolved.start ?? new Date()}
              selected={pending ? { from: pending.from, to: undefined } : undefined}
              onSelect={handleCalendar}
              locale={ptBR}
              className={cn("pointer-events-auto p-3")}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
