import * as React from "react";
import { CurrencyInput, type CurrencyInputProps } from "@/components/ui/currency-input";

export type CurrencyCommitInputProps = Omit<CurrencyInputProps, "onValueChange"> & {
  /** Chamado apenas ao confirmar (blur ou Enter) e quando o valor mudou. */
  onCommit: (value: number | null) => void;
  /** Valor já gravado, quando diferente do exibido (rascunho restaurado). */
  committedValue?: number | null;
  /** Chamado durante a digitação para preservar rascunho local. */
  onDraftChange?: (value: number | null) => void;
};

function toNumber(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Campo de moeda que só grava no fim da edição.
 *
 * O `CurrencyInput` emite um valor por tecla digitada (a máscara desloca as
 * casas decimais). Usar esse evento para persistir gera uma gravação — e uma
 * entrada de histórico — por caractere. Aqui o valor fica em rascunho local e
 * `onCommit` dispara uma única vez, em `blur` ou `Enter`.
 */
export const CurrencyCommitInput = React.forwardRef<HTMLInputElement, CurrencyCommitInputProps>(
  (
    { value, committedValue, onCommit, onDraftChange, onBlur, onFocus, onKeyDown, ...rest },
    ref,
  ) => {
    const external = toNumber(value);
    const committed = committedValue === undefined ? external : toNumber(committedValue);
    const [draft, setDraft] = React.useState<number | null>(external);
    const [focused, setFocused] = React.useState(false);
    const editedInFocus = React.useRef(false);

    React.useEffect(() => {
      if (!focused) setDraft(external);
    }, [external, focused]);

    return (
      <CurrencyInput
        {...rest}
        ref={ref}
        value={draft}
        onValueChange={(next) => {
          setDraft(next);
          editedInFocus.current = true;
          onDraftChange?.(next);
        }}
        onFocus={(e) => {
          setFocused(true);
          editedInFocus.current = false;
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          if (editedInFocus.current && draft !== committed) onCommit(draft);
          editedInFocus.current = false;
          onBlur?.(e);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          onKeyDown?.(e);
        }}
      />
    );
  },
);
CurrencyCommitInput.displayName = "CurrencyCommitInput";
