import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type CurrencyInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "step"
> & {
  /** Numeric value (in the currency's main unit, e.g. 1234.56 for R$ 1.234,56). */
  value: number | string | null | undefined;
  /** Emits the numeric value, or null when cleared. */
  onValueChange?: (value: number | null) => void;
  /** ISO 4217 currency code. Default BRL. */
  currency?: string;
  /** BCP-47 locale. Default pt-BR. */
  locale?: string;
  /** Number of decimals. Default 2. */
  decimals?: number;
};

function toNumber(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function format(value: number | null, locale: string, currency: string, decimals: number): string {
  if (value === null) return "";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Currency-masked input. Displays formatted currency (e.g. "R$ 1.234,56") while
 * the user types digits. Emits a numeric value (main unit) via onValueChange.
 */
export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    {
      value,
      onValueChange,
      currency = "BRL",
      locale = "pt-BR",
      decimals = 2,
      className,
      onBlur,
      onFocus,
      ...rest
    },
    ref,
  ) => {
    const numeric = toNumber(value);
    const [display, setDisplay] = React.useState<string>(() =>
      format(numeric, locale, currency, decimals),
    );
    const [focused, setFocused] = React.useState(false);

    // Keep display in sync when the external value changes (and not focused).
    React.useEffect(() => {
      if (!focused) {
        setDisplay(format(numeric, locale, currency, decimals));
      }
    }, [numeric, locale, currency, decimals, focused]);

    const factor = Math.pow(10, decimals);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const digits = raw.replace(/\D/g, "");
      if (!digits) {
        setDisplay("");
        onValueChange?.(null);
        return;
      }
      const cents = Number(digits);
      const next = cents / factor;
      setDisplay(format(next, locale, currency, decimals));
      onValueChange?.(next);
    };

    return (
      <Input
        {...rest}
        ref={ref}
        inputMode="decimal"
        className={cn(className)}
        value={display}
        onChange={handleChange}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          setDisplay(format(toNumber(value), locale, currency, decimals));
          onBlur?.(e);
        }}
      />
    );
  },
);
CurrencyInput.displayName = "CurrencyInput";
