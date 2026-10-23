import { useEffect, useRef, useState } from "react";
import { CalendarDays, Check, Clock3, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { DatePickerPanel } from "@/components/date-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatIsoDate, parseIsoDate } from "@/lib/iso-date";
import {
  ACTIVITY_TIME_OPTIONS,
  activityDatePart,
  activityTimePart,
  combineActivityDateTime,
  formatActivityDateLabel,
  fromLocalDateTimeValue,
  toLocalDateTimeValue,
  type ActivityDateValueFormat,
} from "@/lib/activity-date-time";
import {
  FOLLOW_UP_PRESETS,
  followUpDate,
  followUpLabel,
  type FollowUpPreset,
} from "@/lib/activity-task-options";

type ActivityDateTimePickerProps = {
  value?: string | null;
  onChange: (value: string | null) => void;
  valueFormat?: ActivityDateValueFormat;
  dateOnly?: boolean;
  optional?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  defaultTime?: string;
  /** Limites do dia em "YYYY-MM-DD" (opcional). */
  minDate?: string | null;
  maxDate?: string | null;
  invalid?: boolean;
  id?: string;
};

export function ActivityDateTimePicker({
  value,
  onChange,
  valueFormat = "local",
  dateOnly = false,
  optional = true,
  disabled = false,
  ariaLabel = "Data e hora",
  className,
  defaultTime = "08:00",
  minDate,
  maxDate,
  invalid,
  id,
}: ActivityDateTimePickerProps) {
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const selectedTimeRef = useRef<HTMLButtonElement>(null);
  const local =
    valueFormat === "date" ? (value ? `${value}T${defaultTime}` : "") : toLocalDateTimeValue(value);
  const datePart = activityDatePart(local);
  const timePart = activityTimePart(local, defaultTime);
  const selectedDate = parseIsoDate(datePart) ?? undefined;

  useEffect(() => {
    if (!timeOpen) return;
    window.requestAnimationFrame(() =>
      selectedTimeRef.current?.scrollIntoView({ block: "center" }),
    );
  }, [timeOpen]);

  const commit = (date: string, time = timePart) => {
    const next = combineActivityDateTime(date, time);
    onChange(next ? fromLocalDateTimeValue(next, valueFormat) : null);
  };

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col items-stretch gap-1.5 min-[420px]:flex-row min-[420px]:items-center",
        className,
      )}
    >
      <Popover open={dateOpen} onOpenChange={setDateOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            id={id}
            disabled={disabled}
            aria-label={`${ariaLabel}: data`}
            aria-invalid={invalid || undefined}
            className={cn(
              "h-9 min-w-0 flex-1 justify-start gap-2 px-3 font-normal",
              !datePart && "text-muted-foreground",
              invalid && "border-destructive",
            )}
          >
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{formatActivityDateLabel(local)}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          collisionPadding={8}
          className="pointer-events-auto z-[180] w-auto max-w-[calc(100vw-1rem)] p-0"
        >
          {/* Mesma seleção de dia do DatePicker (skill date-picker-br); a hora
              escolhida é preservada ao trocar o dia. */}
          <DatePickerPanel
            value={selectedDate ?? null}
            min={parseIsoDate(minDate ?? null)}
            max={parseIsoDate(maxDate ?? null)}
            onSelect={(day) => {
              commit(formatIsoDate(day));
              setDateOpen(false);
            }}
            onClear={
              optional && datePart
                ? () => {
                    onChange(null);
                    setDateOpen(false);
                  }
                : undefined
            }
          />
        </PopoverContent>
      </Popover>

      {!dateOnly && (
        <Popover open={timeOpen} onOpenChange={setTimeOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              aria-label={`${ariaLabel}: hora`}
              className="h-9 w-full shrink-0 justify-start gap-2 px-3 font-normal min-[420px]:w-[7.25rem]"
            >
              <Clock3 className="h-4 w-4 shrink-0" aria-hidden />
              {timePart}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={6}
            className="pointer-events-auto z-[180] w-32 p-1"
          >
            <ScrollArea className="h-64">
              <div className="space-y-0.5 pr-2">
                {ACTIVITY_TIME_OPTIONS.map((time) => (
                  <Button
                    key={time}
                    ref={timePart === time ? selectedTimeRef : undefined}
                    type="button"
                    variant={timePart === time ? "secondary" : "ghost"}
                    size="sm"
                    className="w-full justify-between text-base font-normal"
                    onClick={() => {
                      const date = datePart || format(new Date(), "yyyy-MM-dd");
                      commit(date, time);
                      setTimeOpen(false);
                    }}
                  >
                    {time}
                    {timePart === time ? <Check className="h-4 w-4" aria-hidden /> : null}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

export function ActivityDueDatePicker(props: Omit<ActivityDateTimePickerProps, "dateOnly">) {
  const [open, setOpen] = useState(false);
  const applyPreset = (preset: FollowUpPreset) => {
    if (preset === "custom") {
      setOpen(false);
      return;
    }
    const due = followUpDate(preset);
    if (!due) return;
    const currentTime = activityTimePart(props.value, props.defaultTime ?? "08:00");
    const [hours, minutes] = currentTime.split(":").map(Number);
    due.setHours(hours || 0, minutes || 0, 0, 0);
    const localValue = toLocalDateTimeValue(due.toISOString());
    props.onChange(fromLocalDateTimeValue(localValue, props.valueFormat ?? "local"));
    setOpen(false);
  };

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={props.disabled}
            className="h-9 w-full justify-between font-normal"
          >
            <span className="truncate">Quando você fará?</span>
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          className="pointer-events-auto z-[180] w-80 max-w-[calc(100vw-1rem)] p-1"
        >
          {FOLLOW_UP_PRESETS.map((preset) => (
            <Button
              key={preset.value}
              type="button"
              variant="ghost"
              className="h-auto w-full justify-start whitespace-normal px-3 py-2 text-left font-normal"
              onClick={() => applyPreset(preset.value)}
            >
              {followUpLabel(preset.value)}
            </Button>
          ))}
        </PopoverContent>
      </Popover>
      <ActivityDateTimePicker {...props} />
    </div>
  );
}
