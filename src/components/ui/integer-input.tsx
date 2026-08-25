import * as React from "react";

import { Input } from "@/components/ui/input";

export type IntegerInputProps = Omit<React.ComponentProps<"input">, "type"> & {
  /** Permite valores negativos (default: derivado de `min`). */
  allowNegative?: boolean;
};

function sanitize(raw: string, allowNegative: boolean) {
  let out = raw.replace(/[^\d-]/g, "");
  if (allowNegative) {
    const negative = out.startsWith("-");
    out = (negative ? "-" : "") + out.replace(/-/g, "");
  } else {
    out = out.replace(/-/g, "");
  }
  return out;
}

/**
 * Campo de texto que aceita apenas números inteiros.
 * Substitui `<Input type="number" />` (sem as setas de incremento do navegador,
 * sem alteração por scroll e sem colagem de valores inválidos).
 */
const IntegerInput = React.forwardRef<HTMLInputElement, IntegerInputProps>(
  ({ allowNegative, min, onChange, onKeyDown, onWheel, ...props }, ref) => {
    const negativeAllowed = allowNegative ?? (min !== undefined && min !== null && Number(min) < 0);

    return (
      <Input
        {...props}
        min={min}
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented) return;
          if (event.key === "ArrowUp" || event.key === "ArrowDown") event.preventDefault();
        }}
        onWheel={(event) => {
          onWheel?.(event);
          // Nunca altera o valor por scroll do mouse.
          (event.currentTarget as HTMLInputElement).blur?.();
        }}
        onChange={(event) => {
          const cleaned = sanitize(event.target.value, negativeAllowed);
          if (cleaned !== event.target.value) event.target.value = cleaned;
          onChange?.(event);
        }}
      />
    );
  },
);
IntegerInput.displayName = "IntegerInput";

export { IntegerInput };
