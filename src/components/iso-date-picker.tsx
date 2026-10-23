/**
 * `DatePicker` para valores de calendário "YYYY-MM-DD" (colunas `date`,
 * campos de formulário, filtros de um dia). Conversão LOCAL estrita
 * (`@/lib/iso-date`): o dia nunca muda com o fuso e data impossível é
 * tratada como vazia, nunca normalizada para outro dia.
 *
 * - Opcional (padrão): mostra "Limpar", que devolve `null`.
 * - `required`: sem "Limpar"; `aria-required`.
 * - `min`/`max` em "YYYY-MM-DD" limitam calendário e atalhos.
 */
import { DatePicker, type DatePickerProps } from "@/components/date-picker";
import { cn } from "@/lib/utils";
import { formatIsoDate, parseIsoDate } from "@/lib/iso-date";

export type IsoDatePickerProps = Omit<
  DatePickerProps,
  "value" | "onChange" | "onClear" | "min" | "max"
> & {
  value?: string | null;
  /** "YYYY-MM-DD" escolhido, ou `null` ao limpar. */
  onChange: (value: string | null) => void;
  min?: string | null;
  max?: string | null;
  /** Força ocultar "Limpar" mesmo em campo opcional. */
  clearable?: boolean;
};

export function IsoDatePicker({
  value,
  onChange,
  min,
  max,
  required,
  clearable = true,
  className,
  ...rest
}: IsoDatePickerProps) {
  const date = parseIsoDate(value ?? null);
  return (
    <DatePicker
      {...rest}
      required={required}
      className={cn("w-full", className)}
      value={date}
      min={parseIsoDate(min ?? null)}
      max={parseIsoDate(max ?? null)}
      onChange={(d) => onChange(formatIsoDate(d))}
      onClear={!required && clearable && date ? () => onChange(null) : undefined}
    />
  );
}
