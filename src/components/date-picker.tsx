/**
 * Seletor de DATA ÚNICA do TechERP (skill date-picker-br).
 *
 * - Atalhos: Personalizado → Ontem → Hoje → Amanhã. "Personalizado" não
 *   altera o valor e mantém aberto; os demais aplicam e fecham.
 * - Calendário de 1 mês, um clique escolhe e fecha; dia sempre no início
 *   (`startOfDay`). Mês/ano em listas para saltar rápido (nascimento,
 *   admissão, vencimentos distantes).
 * - `min`/`max` valem para calendário E atalhos; `onClear` só quando o
 *   campo é opcional; campo vazio nunca recebe "Hoje" sozinho.
 * - Funciona dentro de janelas e gavetas (camada acima delas).
 *
 * Para valores "YYYY-MM-DD" use `IsoDatePicker`; data com hora usa
 * `ActivityDateTimePicker`, que reaproveita `DatePickerPanel`.
 * Uso e exceções: docs/architecture/date-fields.md.
 */
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
  isSinglePresetAllowed,
  presetForDate,
  type SinglePresetKey,
} from "@/lib/date-single-presets";
import { formatIsoDate, isDayWithin } from "@/lib/iso-date";
import { calendarNavigationBounds, datePickerValidationMessage } from "@/lib/date-picker-rules";

/**
 * Ao abrir, coloca o foco no dia escolhido (ou hoje, ou o primeiro dia
 * disponível) para as setas navegarem no calendário.
 */
export function focusCalendarDay(e: Event) {
  e.preventDefault();
  const root = e.currentTarget as HTMLElement | null;
  window.requestAnimationFrame(() => {
    const day =
      root?.querySelector<HTMLButtonElement>("[data-selected=true] button:not([disabled])") ??
      root?.querySelector<HTMLButtonElement>("[data-today=true] button:not([disabled])") ??
      root?.querySelector<HTMLButtonElement>("td button:not([disabled])");
    day?.focus();
  });
}

export type DatePickerPanelProps = {
  value?: Date | null;
  /** Dia escolhido (início do dia) e o atalho correspondente. */
  onSelect: (date: Date, presetKey: SinglePresetKey) => void;
  onClear?: () => void;
  min?: Date | null;
  max?: Date | null;
  defaultPreset?: SinglePresetKey;
  /** Mês exibido quando não há valor (padrão: mês atual, ajustado aos limites). */
  defaultMonth?: Date;
};

/** Atalhos + calendário (conteúdo do popover), compartilhado com data-hora. */
export function DatePickerPanel({
  value,
  onSelect,
  onClear,
  min,
  max,
  defaultPreset = "today",
  defaultMonth,
}: DatePickerPanelProps) {
  const [preset, setPreset] = React.useState<SinglePresetKey>(
    value ? presetForDate(value) : defaultPreset,
  );
  React.useEffect(() => {
    if (value) setPreset(presetForDate(value));
  }, [value]);

  const bounds = { min, max };
  const [month, setMonth] = React.useState<Date>(() => {
    const now = new Date();
    return (
      value ??
      defaultMonth ??
      (min && !isDayWithin(now, { min }) ? min : max && !isDayWithin(now, { max }) ? max : now)
    );
  });
  const { startMonth, endMonth } = calendarNavigationBounds(month, { value, min, max });

  const disabledDays = [
    ...(min ? [{ before: startOfDay(min) }] : []),
    ...(max ? [{ after: startOfDay(max) }] : []),
  ];

  function applyPreset(key: SinglePresetKey) {
    if (key === "custom") {
      // Não aplica data: só libera o calendário para escolha livre.
      setPreset("custom");
      return;
    }
    if (!isSinglePresetAllowed(key, bounds)) return;
    const d = getSinglePresetDate(key);
    if (!d) return;
    setPreset(key);
    onSelect(d, key);
  }

  return (
    <div className="flex flex-col sm:flex-row">
      <div
        className="flex flex-row flex-wrap gap-1 p-2 sm:w-40 sm:flex-col sm:flex-nowrap"
        role="group"
        aria-label="Atalhos de data"
      >
        {SINGLE_PRESETS.map((p) => {
          const allowed = isSinglePresetAllowed(p.key, bounds);
          return (
            <Button
              key={p.key}
              type="button"
              variant={preset === p.key ? "secondary" : "ghost"}
              size="sm"
              className="justify-start"
              disabled={!allowed}
              aria-pressed={preset === p.key}
              onClick={() => applyPreset(p.key)}
            >
              {p.label}
            </Button>
          );
        })}
        {onClear ? (
          <>
            <Separator className="my-1 hidden sm:block" />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="justify-start text-muted-foreground"
              onClick={onClear}
            >
              <X className="mr-1 h-3 w-3" aria-hidden="true" />
              Limpar
            </Button>
          </>
        ) : null}
      </div>

      <Separator orientation="vertical" className="hidden h-auto sm:block" />

      <div className="pointer-events-auto p-2">
        <Calendar
          mode="single"
          required
          autoFocus
          locale={ptBR}
          numberOfMonths={1}
          captionLayout="dropdown"
          startMonth={startMonth}
          endMonth={endMonth}
          month={month}
          onMonthChange={setMonth}
          selected={value ?? undefined}
          disabled={disabledDays.length ? disabledDays : undefined}
          formatters={{
            formatMonthDropdown: (d) => format(d, "MMM", { locale: ptBR }),
          }}
          onSelect={(d) => {
            if (!d) return;
            const picked = startOfDay(d);
            if (!isDayWithin(picked, bounds)) return;
            const key = presetForDate(picked);
            setPreset(key);
            onSelect(picked, key);
          }}
        />
      </div>
    </div>
  );
}

export type DatePickerProps = {
  value?: Date | null;
  onChange: (date: Date, presetKey?: SinglePresetKey) => void;
  /** Quando informado, exibe a ação "Limpar" (só em campo opcional). */
  onClear?: () => void;
  defaultPreset?: SinglePresetKey;
  placeholder?: string;
  align?: "start" | "center" | "end";
  /** Lado preferido do calendário (padrão: abaixo do campo). */
  side?: "top" | "bottom";
  size?: "sm" | "default";
  ariaLabel?: string;
  className?: string;
  /** `id` do gatilho — use com `<Label htmlFor>`. */
  id?: string;
  /**
   * Nome no `<form>`: envia "YYYY-MM-DD" (ou vazio) no FormData, como o
   * `<input type="date">` que este componente substitui.
   */
  name?: string;
  disabled?: boolean;
  /** Mostra o valor e não abre o calendário. */
  readOnly?: boolean;
  /** Obrigatório: bloqueia o envio do `<form>` vazio e nunca oferece "Limpar". */
  required?: boolean;
  invalid?: boolean;
  "aria-describedby"?: string;
  min?: Date | null;
  max?: Date | null;
  /** Abre o calendário ao montar (edição inline). */
  defaultOpen?: boolean;
  /** Avisado quando o calendário abre/fecha (ex.: cancelar edição inline). */
  onOpenChange?: (open: boolean) => void;
};

/** Primeiro controle inválido do formulário (ordem do documento). */
function firstInvalidControl(form: HTMLFormElement | null): Element | null {
  if (!form) return null;
  for (const el of Array.from(form.elements)) {
    const c = el as HTMLInputElement;
    if (typeof c.checkValidity === "function" && c.willValidate && !c.validity.valid) return c;
  }
  return null;
}

export function DatePicker({
  value,
  onChange,
  onClear,
  defaultPreset = "today",
  placeholder = "Selecionar data",
  align = "start",
  side = "bottom",
  size = "default",
  ariaLabel,
  className,
  id,
  name,
  disabled,
  readOnly,
  required,
  invalid,
  "aria-describedby": describedBy,
  min,
  max,
  defaultOpen = false,
  onOpenChange,
}: DatePickerProps) {
  const [open, setOpenState] = React.useState(defaultOpen && !readOnly && !disabled);
  const setOpen = (v: boolean) => {
    const next = readOnly || disabled ? false : v;
    setOpenState(next);
    onOpenChange?.(next);
  };
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const proxyRef = React.useRef<HTMLInputElement>(null);
  const errorId = React.useId();

  // Validação nativa do <form>: o gatilho é um botão, então um <input>
  // espelho (fora da tabulação) carrega valor, `required` e limites.
  const validation = datePickerValidationMessage({ value, required, min, max });
  const needsProxy = !!name || !!required || !!min || !!max;
  const [shownError, setShownError] = React.useState<string>("");
  React.useEffect(() => {
    proxyRef.current?.setCustomValidity(validation);
    if (!validation) setShownError("");
  }, [validation]);

  const isInvalid = !!invalid || !!shownError;
  const label = value
    ? format(value, "dd/MM/yyyy", { locale: ptBR })
    : shownError
      ? shownError
      : placeholder;
  const hasExternalLabel = !!id && !ariaLabel;
  const describedByIds = [describedBy, shownError ? errorId : null].filter(Boolean).join(" ");
  // Obrigatório nunca oferece "Limpar".
  const clear = required ? undefined : onClear;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={triggerRef}
            id={id}
            type="button"
            variant="outline"
            size={size}
            disabled={disabled}
            aria-label={
              hasExternalLabel
                ? undefined
                : `${ariaLabel ?? "Selecionar data"}${value ? `: ${format(value, "dd/MM/yyyy")}` : ""}`
            }
            aria-haspopup="dialog"
            aria-required={required || undefined}
            aria-invalid={isInvalid || undefined}
            aria-readonly={readOnly || undefined}
            aria-describedby={describedByIds || undefined}
            className={cn(
              "justify-start gap-2 font-normal",
              !value && "text-muted-foreground",
              isInvalid && "border-destructive focus-visible:ring-destructive",
              shownError && !value && "text-destructive",
              readOnly && "cursor-default",
              className,
            )}
          >
            <CalendarIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align={align}
          side={side}
          sideOffset={4}
          collisionPadding={8}
          // Foco vai para o dia do calendário (setas navegam), não para o 1º atalho.
          onOpenAutoFocus={focusCalendarDay}
          className="pointer-events-auto z-[180] w-auto max-w-[calc(100vw-1rem)] p-0"
        >
          <DatePickerPanel
            value={value}
            min={min}
            max={max}
            defaultPreset={defaultPreset}
            onSelect={(d, key) => {
              onChange(d, key);
              setOpen(false);
            }}
            onClear={
              clear
                ? () => {
                    clear();
                    setOpen(false);
                  }
                : undefined
            }
          />
        </PopoverContent>
      </Popover>
      {needsProxy ? (
        <input
          ref={proxyRef}
          type="text"
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          name={name}
          value={value ? formatIsoDate(value) : ""}
          onChange={() => {}}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          data-date-picker-proxy=""
          onFocus={() => triggerRef.current?.focus()}
          onInvalid={(e) => {
            // Mensagem própria (PT-BR) no campo; o foco vai para o gatilho se
            // este for o primeiro campo inválido do formulário.
            e.preventDefault();
            const input = e.currentTarget;
            setShownError(input.validationMessage || validation || "Informe a data.");
            const form = input.form;
            window.setTimeout(() => {
              const first = firstInvalidControl(form);
              if (!form || first === input) triggerRef.current?.focus();
            }, 0);
          }}
        />
      ) : null}
      {shownError ? (
        <span id={errorId} role="alert" className="sr-only">
          {shownError}
        </span>
      ) : null}
    </>
  );
}
