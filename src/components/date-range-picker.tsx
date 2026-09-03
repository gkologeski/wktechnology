// Seletor de intervalo de datas em pt-BR — componente oficial do sistema.
// Regras: "Período" (personalizado) fica no topo; a seleção personalizada
// acontece em dois cliques e o popover NÃO fecha no primeiro clique.
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
  /** Rótulo acessível do botão. */
  ariaLabel?: string;
  size?: "sm" | "default";
  /** Texto exibido quando nenhum período está aplicado. */
  placeholder?: string;
  /** Quando informado, exibe ação para limpar o período aplicado. */
  onClear?: () => void;
};


export const DATE_GROUP_ORDER: PresetGroup[] = [
  "Dias",
  "Semanas",
  "Meses",
  "Trimestres",
  "Semestres",
  "Anos",
  "Últimos N dias",
];

export function DateRangePicker({
  value,
  onChange,
  defaultPreset = "last30",
  align = "start",
  className,
  ariaLabel = "Selecionar período",
  size = "default",
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [activePreset, setActivePreset] = React.useState<PresetKey | "custom">(defaultPreset);
  // Seleção parcial: primeiro clique no calendário fica pendente até o segundo.
  const [pending, setPending] = React.useState<{ from: Date } | null>(null);

  const current = value ?? getPresetRange(defaultPreset);

  const handlePreset = (key: PresetKey) => {
    setActivePreset(key);
    setPending(null);
    onChange(getPresetRange(key), key);
    setOpen(false);
  };

  const handleCalendar = (r: RDPDateRange | undefined) => {
    const clicked = pending ? (r?.to ?? r?.from) : (r?.from ?? r?.to);
    if (!clicked) return;
    if (!pending) {
      setActivePreset("custom");
      setPending({ from: clicked });
      return;
    }
    const [from, to] =
      clicked.getTime() < pending.from.getTime()
        ? [clicked, pending.from]
        : [pending.from, clicked];
    setPending(null);
    setActivePreset("custom");
    onChange({ from, to });
    setOpen(false);
  };

  const label = `${format(current.from, "dd/MM/yyyy", { locale: ptBR })} – ${format(current.to, "dd/MM/yyyy", { locale: ptBR })}`;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        // Não fecha com seleção incompleta: o usuário precisa do 2º clique.
        if (!next && pending) return;
        if (!next) setPending(null);
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={size}
          aria-label={ariaLabel}
          className={cn("justify-start gap-2 text-left font-normal", className)}
        >
          <CalendarIcon aria-hidden="true" className="h-4 w-4 opacity-70" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <div className="flex flex-col sm:flex-row">
          <ScrollArea className="h-[300px] w-full border-b sm:h-[360px] sm:w-[220px] sm:border-b-0 sm:border-r">
            <div className="p-2">
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                Personalizado
              </div>
              <button
                type="button"
                onClick={() => {
                  setActivePreset("custom");
                  setPending(null);
                }}
                className={cn(
                  "w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                  activePreset === "custom" && "bg-accent text-accent-foreground",
                )}
              >
                Período
              </button>
              {DATE_GROUP_ORDER.map((group) => (
                <div key={group}>
                  <Separator className="my-2" />
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
          <div className="p-0">
            {pending ? (
              <p className="px-3 pt-3 text-xs text-muted-foreground">
                Início {format(pending.from, "dd/MM/yyyy", { locale: ptBR })} — escolha a data
                final.
              </p>
            ) : null}
            <Calendar
              mode="range"
              numberOfMonths={2}
              defaultMonth={current.from}
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
