// Campos reutilizáveis do editor de itens de linha (texto, número, desconto e
// linhas de resumo). Componentes de apresentação, sem acesso a dados.
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { CurrencyCommitInput } from "@/components/ui/currency-commit-input";
import { n } from "./use-line-items";
import type { DiscountType } from "./use-line-items";

export function LabeledNumber({
  label,
  value,
  committedValue,
  step,
  onCommit,
  onDirty,
  onDraftChange,
  disabled,
  suffix,
}: {
  label: string;
  value: number;
  committedValue?: number;
  step?: string;
  onCommit: (v: number) => void;
  onDirty?: () => void;
  onDraftChange?: (v: number) => void;
  disabled?: boolean;
  suffix?: string;
}) {
  const [v, setV] = useState(String(value));
  const [focused, setFocused] = useState(false);
  const editedInFocus = useRef(false);
  const base = committedValue ?? value;
  useEffect(() => {
    if (!focused) setV(String(value));
  }, [value, focused]);
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="relative">
        <Input
          type="number"
          step={step}
          value={v}
          disabled={disabled}
          className={suffix ? "pr-8" : undefined}
          onFocus={() => {
            setFocused(true);
            editedInFocus.current = false;
          }}
          onChange={(e) => {
            const raw = e.target.value;
            setV(raw);
            editedInFocus.current = true;
            onDirty?.();
            const num = Number(raw);
            if (!Number.isNaN(num)) onDraftChange?.(num);
          }}
          onBlur={() => {
            setFocused(false);
            const num = Number(v);
            if (editedInFocus.current && !Number.isNaN(num) && num !== Number(base)) onCommit(num);
            editedInFocus.current = false;
          }}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function TextField({
  value,
  committedValue,
  placeholder,
  className,
  onCommit,
  onDirty,
  onDraftChange,
}: {
  value: string;
  committedValue?: string;
  placeholder?: string;
  className?: string;
  onCommit: (v: string) => void;
  onDirty?: () => void;
  onDraftChange?: (v: string) => void;
}) {
  const [v, setV] = useState(value);
  const [focused, setFocused] = useState(false);
  const editedInFocus = useRef(false);
  const base = committedValue ?? value;
  useEffect(() => {
    if (!focused) setV(value);
  }, [value, focused]);
  return (
    <Input
      className={className}
      placeholder={placeholder}
      value={v}
      onFocus={() => {
        setFocused(true);
        editedInFocus.current = false;
      }}
      onChange={(e) => {
        const next = e.target.value;
        setV(next);
        editedInFocus.current = true;
        onDirty?.();
        onDraftChange?.(next);
      }}
      onBlur={() => {
        setFocused(false);
        if (editedInFocus.current && v !== base) onCommit(v);
        editedInFocus.current = false;
      }}
    />
  );
}

export function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between ${bold ? "font-semibold" : "text-muted-foreground"}`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export function DiscountField({
  currency,
  discountType,
  discountPct,
  discountAmount,
  committedPct,
  committedAmount,
  onChangeType,
  onCommitPct,
  onCommitAmount,
  onDraftPct,
  onDraftAmount,
  onDirty,
}: {
  currency: string;
  discountType: DiscountType;
  discountPct: number;
  discountAmount: number;
  committedPct?: number;
  committedAmount?: number;
  onChangeType: (type: DiscountType) => void;
  onCommitPct: (v: number) => void;
  onCommitAmount: (v: number) => void;
  onDraftPct?: (v: number) => void;
  onDraftAmount?: (v: number) => void;
  onDirty?: () => void;
}) {
  const [pctText, setPctText] = useState(String(n(discountPct)));
  const [pctFocused, setPctFocused] = useState(false);
  const pctEdited = useRef(false);
  const basePct = committedPct ?? n(discountPct);
  useEffect(() => {
    if (!pctFocused) setPctText(String(n(discountPct)));
  }, [discountPct, pctFocused]);

  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Desconto</div>
      <div className="relative">
        {discountType === "amount" ? (
          <CurrencyCommitInput
            aria-label="Desconto em valor"
            className="pr-14"
            currency={currency}
            value={n(discountAmount)}
            committedValue={committedAmount ?? n(discountAmount)}
            onDraftChange={(v) => {
              onDirty?.();
              onDraftAmount?.(v ?? 0);
            }}
            onCommit={(v) => onCommitAmount(v ?? 0)}
          />
        ) : (
          <Input
            type="number"
            step="0.01"
            className="pr-14"
            value={pctText}
            aria-label="Desconto em porcentagem"
            onFocus={() => {
              setPctFocused(true);
              pctEdited.current = false;
            }}
            onChange={(e) => {
              const raw = e.target.value;
              setPctText(raw);
              pctEdited.current = true;
              onDirty?.();
              const num = Number(raw);
              if (!Number.isNaN(num)) onDraftPct?.(num);
            }}
            onBlur={() => {
              setPctFocused(false);
              const num = Number(pctText);
              if (pctEdited.current && !Number.isNaN(num) && num !== basePct) onCommitPct(num);
              pctEdited.current = false;
            }}
          />
        )}
        <div className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex rounded-md border overflow-hidden text-[10px] h-5">
          <button
            type="button"
            className={`px-1.5 ${
              discountType === "pct"
                ? "bg-primary text-primary-foreground"
                : "bg-transparent text-muted-foreground"
            }`}
            onClick={() => discountType !== "pct" && onChangeType("pct")}
            aria-label="Usar desconto em porcentagem"
          >
            %
          </button>
          <button
            type="button"
            className={`px-1.5 border-l ${
              discountType === "amount"
                ? "bg-primary text-primary-foreground"
                : "bg-transparent text-muted-foreground"
            }`}
            onClick={() => discountType !== "amount" && onChangeType("amount")}
            aria-label="Usar desconto em valor"
          >
            R$
          </button>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">
        {discountType === "amount" ? "Valor total da linha" : "% do subtotal da linha"}
      </p>
    </div>
  );
}
