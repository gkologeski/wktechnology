import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import type { DateRange as RDPDateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
  PRESETS,
  getPresetRange,
  type DateRange,
  type PresetKey,
  type PresetGroup,
} from "@/lib/date-presets";

export type DateRangePickerProps = {
  value?: DateRange;
  onChange: (range: DateRange, presetKey?: PresetKey) => void;
  defaultPreset?: PresetKey;
  align?: "start" | "center" | "end";
  className?: string;
};

const GROUP_ORDER: PresetGroup[] = [
  "Dias",
  "Semanas",
  "Trimestres",
  "Semestres",
  "Anos",
  "Últimos N dias",
];

export function DateRangePicker({
  value,
  onChange,
  defaultPreset = "last30",
  align = "end",
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [activePreset, setActivePreset] = React.useState<PresetKey | "custom">(defaultPreset);

  const current = value ?? getPresetRange(defaultPreset);

  const handlePreset = (key: PresetKey) => {
    const range = getPresetRange(key);
    setActivePreset(key);
    onChange(range, key);
    setOpen(false);
  };

  const handleCalendar = (r: RDPDateRange | undefined) => {
    if (r?.from && r?.to) {
      setActivePreset("custom");
      onChange({ from: r.from, to: r.to });
    }
  };

  const label = `${format(current.from, "dd/MM/yyyy", { locale: ptBR })} – ${format(current.to, "dd/MM/yyyy", { locale: ptBR })}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("justify-start text-left font-normal gap-2", className)}
        >
          <CalendarIcon className="h-4 w-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <div className="flex">
          <ScrollArea className="h-[360px] w-[220px] border-r">
            <div className="p-2">
              {GROUP_ORDER.map((group, gi) => (
                <div key={group}>
                  {gi > 0 && <Separator className="my-2" />}
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">{group}</div>
                  {PRESETS.filter((p) => p.group === group).map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => handlePreset(p.key)}
                      className={cn(
                        "w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                        activePreset === p.key && "bg-accent text-accent-foreground",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </ScrollArea>
          <Calendar
            mode="range"
            numberOfMonths={2}
            selected={{ from: current.from, to: current.to }}
            onSelect={handleCalendar}
            locale={ptBR}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
