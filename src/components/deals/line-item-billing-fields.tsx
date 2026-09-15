// Campos de cobrança do item de linha: forma de cobrança, unidade, recorrência
// e, quando percentual, base de cálculo + percentual. São os mesmos campos que
// o contrato usa depois, para que negócio e contrato "conversem".
import {
  BILLING_MODELS,
  BILLING_MODEL_DEFAULT_UNIT,
  BILLING_MODEL_LABEL,
  CADENCE_LABEL,
  CADENCE_OPTIONS,
  UNIT_LABEL,
  describeBilling,
  isBillingModel,
  usesPercent,
  type BillingModel,
} from "@/lib/catalog/billing-model";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CurrencyCommitInput } from "@/components/ui/currency-commit-input";
import { formatCurrency } from "@/lib/crm";
import { LabeledNumber, TextField } from "./line-item-fields";
import type { LineItem } from "./use-line-items";

const UNIT_OPTIONS = ["hour", "unit", "vacancy", "headcount", "month", "day", "project"];

export function LineItemBillingFields({
  item,
  currency,
  onUpdate,
  onDirty,
}: {
  item: LineItem;
  currency: string;
  onUpdate: (patch: Partial<LineItem>) => void;
  onDirty?: () => void;
}) {
  const model: BillingModel = isBillingModel(item.billing_model) ? item.billing_model : "per_unit";
  const percentBased = usesPercent(model);

  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-2">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="space-y-1">
          <label
            className="text-[10px] uppercase tracking-wide text-muted-foreground"
            htmlFor={`billing-model-${item.id}`}
          >
            Forma de cobrança
          </label>
          <Select
            value={model}
            onValueChange={(v) => {
              const next = v as BillingModel;
              onUpdate({
                billing_model: next,
                unit: item.unit ?? BILLING_MODEL_DEFAULT_UNIT[next],
                ...(usesPercent(next) ? {} : { percent: null, percent_base_amount: null }),
              });
            }}
          >
            <SelectTrigger id={`billing-model-${item.id}`}>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {BILLING_MODELS.map((m) => (
                <SelectItem key={m} value={m}>
                  {BILLING_MODEL_LABEL[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label
            className="text-[10px] uppercase tracking-wide text-muted-foreground"
            htmlFor={`billing-unit-${item.id}`}
          >
            Unidade
          </label>
          <Select
            value={item.unit ?? BILLING_MODEL_DEFAULT_UNIT[model]}
            onValueChange={(v) => onUpdate({ unit: v })}
          >
            <SelectTrigger id={`billing-unit-${item.id}`}>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {UNIT_OPTIONS.map((u) => (
                <SelectItem key={u} value={u}>
                  {UNIT_LABEL[u] ?? u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label
            className="text-[10px] uppercase tracking-wide text-muted-foreground"
            htmlFor={`billing-cadence-${item.id}`}
          >
            Recorrência
          </label>
          <Select
            value={item.cadence ?? "one_time"}
            onValueChange={(v) => onUpdate({ cadence: v })}
          >
            <SelectTrigger id={`billing-cadence-${item.id}`}>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {CADENCE_OPTIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  {CADENCE_LABEL[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {percentBased ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Base de cálculo
            </div>
            <CurrencyCommitInput
              aria-label="Base de cálculo"
              currency={currency}
              value={Number(item.percent_base_amount ?? 0)}
              onCommit={(v) => onUpdate({ percent_base_amount: v ?? 0 })}
            />
          </div>
          <LabeledNumber
            label="Percentual"
            suffix="%"
            step="0.01"
            value={Number(item.percent ?? 0)}
            onDirty={onDirty}
            onCommit={(v) => onUpdate({ percent: v })}
          />
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Descrição da base
            </div>
            <TextField
              value={item.description ?? ""}
              placeholder="Ex.: salário alvo da vaga"
              onDirty={onDirty}
              onCommit={(v) => onUpdate({ description: v || null })}
            />
          </div>
        </div>
      ) : null}

      <p className="text-[11px] text-muted-foreground">
        Cobrança:{" "}
        {describeBilling(
          {
            billing_model: model,
            quantity: item.quantity,
            unit_price: item.unit_price,
            percent: item.percent,
            percent_base_amount: item.percent_base_amount,
            unit: item.unit,
            cadence: item.cadence,
            percent_base_label: item.description,
          },
          (v) => formatCurrency(v, currency),
        )}
      </p>
    </div>
  );
}
