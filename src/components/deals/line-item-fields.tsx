// Campos reutilizáveis do editor de itens de linha (texto, número, desconto e
// linhas de resumo). Componentes de apresentação, sem acesso a dados.
import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { CurrencyCommitInput } from "@/components/ui/currency-commit-input";
import { n } from "./use-line-items";
import type { DiscountType } from "./use-line-items";

export function LabeledNumber({
  label,
  value,
  step,
  onCommit,
  onDirty,
  disabled,
  suffix,
}: {
  label: string;
  value: number;
  step?: string;
  onCommit: (v: number) => void;
  onDirty?: () => void;
  disabled?: boolean;
  suffix?: string;
}) {
  const [v, setV] = useState(String(value));
  const [focused, setFocused] = useState(false);
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
          onFocus={() => setFocused(true)}
          onChange={(e) => {
            setV(e.target.value);
            onDirty?.();
          }}
          onBlur={() => {
            setFocused(false);
            const num = Number(v);
            if (!Number.isNaN(num) && num !== Number(value)) onCommit(num);
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
  placeholder,
  className,
  onCommit,
  onDirty,
}: {
  value: string;
  placeholder?: string;
  className?: string;
  onCommit: (v: string) => void;
  onDirty?: () => void;
}) {
  const [v, setV] = useState(value);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setV(value);
  }, [value, focused]);
  return (
    <Input
      className={className}
      placeholder={placeholder}
      value={v}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        setV(e.target.value);
        onDirty?.();
      }}
      onBlur={() => {
        setFocused(false);
        if (v !== value) onCommit(v);
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
  onChangeType,
  onCommitPct,
  onCommitAmount,
}: {
  currency: string;
  discountType: DiscountType;
  discountPct: number;
  discountAmount: number;
  onChangeType: (type: DiscountType) => void;
  onCommitPct: (v: number) => void;
  onCommitAmount: (v: number) => void;
}) {
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
            onCommit={(v) => onCommitAmount(v ?? 0)}
          />
        ) : (
          <Input
            type="number"
            step="0.01"
            className="pr-14"
            key={`pct-${n(discountPct)}`}
            defaultValue={String(n(discountPct))}
            aria-label="Desconto em porcentagem"
            onBlur={(e) => {
              const num = Number(e.currentTarget.value);
              if (!Number.isNaN(num) && num !== n(discountPct)) onCommitPct(num);
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
