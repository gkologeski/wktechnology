import * as React from "react";
import { format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

import {
  SINGLE_PRESETS,
  getSinglePresetDate,
  presetForDate,
  type SinglePresetKey,
} from "@/lib/date-single-presets";

export type DatePickerProps = {
  value?: Date;
  onChange: (date: Date, presetKey?: SinglePresetKey) => void;
  /** Quando informado, exibe a ação "Limpar". */
  onClear?: () => void;
  defaultPreset?: SinglePresetKey;
  placeholder?: string;
  align?: "start" | "center" | "end";
  size?: "sm" | "default";
  ariaLabel?: string;
  className?: string;
};

export function DatePicker({
  value,
  onChange,
  onClear,
  defaultPreset = "today",
  placeholder = "Selecionar data",
  align = "start",
  size = "default",
  ariaLabel,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [preset, setPreset] = React.useState<SinglePresetKey>(
    value ? presetForDate(value) : defaultPreset,
  );

  React.useEffect(() => {
    if (value) setPreset(presetForDate(value));
  }, [value]);

  function applyPreset(key: SinglePresetKey) {
    if (key === "custom") {
      // Não aplica data: só libera o calendário para escolha livre.
      setPreset("custom");
      return;
    }
    const d = getSinglePresetDate(key);
    if (!d) return;
    setPreset(key);
    onChange(d, key);
    setOpen(false);
  }

  const label = value ? format(value, "dd/MM/yyyy", { locale: ptBR }) : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={size}
          aria-label={ariaLabel ?? "Selecionar data"}
          className={cn("justify-start gap-2 font-normal", !value && "text-muted-foreground", className)}
        >
          <CalendarIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto max-w-[95vw] p-0">
        <div className="flex flex-col sm:flex-row">
          <div className="flex flex-row gap-1 p-2 sm:w-40 sm:flex-col">
            {SINGLE_PRESETS.map((p) => (
              <Button
                key={p.key}
                type="button"
                variant={preset === p.key ? "secondary" : "ghost"}
                size="sm"
                className="justify-start"
                onClick={() => applyPreset(p.key)}
              >
                {p.label}
              </Button>
            ))}
            {onClear ? (
              <>
                <Separator className="my-1 hidden sm:block" />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-start text-muted-foreground"
                  onClick={() => {
                    onClear();
                    setOpen(false);
                  }}
                >
                  <X className="mr-1 h-3 w-3" aria-hidden="true" />
                  Limpar
                </Button>
              </>
            ) : null}
          </div>

          <Separator orientation="vertical" className="hidden sm:block h-auto" />

          <div className="pointer-events-auto p-2">
            <Calendar
              mode="single"
              locale={ptBR}
              numberOfMonths={1}
              defaultMonth={value ?? new Date()}
              selected={value}
              onSelect={(d) => {
                if (!d) return;
                const picked = startOfDay(d);
                setPreset(presetForDate(picked));
                onChange(picked, presetForDate(picked));
                setOpen(false);
              }}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
