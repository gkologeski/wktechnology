// Card de um item de linha do negócio: identificação, serviço do catálogo,
// preset de contratação, cobrança, quantidade/valores e total da linha.
import { Trash2, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EntityCombobox } from "@/components/ui/entity-combobox";
import { CurrencyCommitInput } from "@/components/ui/currency-commit-input";
import { PresetLinePicker } from "@/components/catalog/preset-line-picker";
import { presetToLinePatch } from "@/lib/contracting-presets-shared";
import { SENIORITY_LABEL } from "@/lib/job-profiles-shared";
import { formatCurrency } from "@/lib/crm";
import { isBillingModel, unitLabel, usesQuantity } from "@/lib/catalog/billing-model";
import { DiscountField, LabeledNumber, TextField } from "./line-item-fields";
import { LineItemBillingFields } from "./line-item-billing-fields";
import { lineTotal, n, type LineItem } from "./use-line-items";

export function LineItemCard({
  item: li,
  currency,
  onUpdate,
  onRemove,
  onDirty,
}: {
  item: LineItem;
  currency: string;
  onUpdate: (patch: Partial<LineItem>) => void;
  onRemove: () => void;
  onDirty?: () => void;
}) {
  const model = isBillingModel(li.billing_model) ? li.billing_model : "per_unit";
  const quantityEnabled = usesQuantity(model);
  const priceLabel = model === "fixed" ? "Valor fixo" : `Preço / ${unitLabel(li.unit) ?? "unidade"}`;

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center gap-2">
        <TextField
          className="flex-1"
          value={li.name ?? ""}
          placeholder="Nome do item"
          onDirty={onDirty}
          onCommit={(v) => {
            if (v !== (li.name ?? "")) onUpdate({ name: v });
          }}
        />
        <Button variant="ghost" size="icon" onClick={onRemove} aria-label="Remover item">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {li.service_catalog_id ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <PresetLinePicker
            serviceCatalogId={li.service_catalog_id}
            value={li.contracting_preset_id ?? null}
            onApply={(preset) => {
              if (!preset) {
                onUpdate({ contracting_preset_id: null, job_profile_id: null, seniority: null });
                return;
              }
              onUpdate(presetToLinePatch(preset) as Partial<LineItem>);
            }}
          />
          {li.job_profile_id || li.seniority ? (
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Cargo / senioridade
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {[
                  li.seniority ? (SENIORITY_LABEL[li.seniority] ?? li.seniority) : null,
                  li.unit ? `por ${unitLabel(li.unit)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed bg-muted/30 p-2">
          <span className="text-xs text-muted-foreground">
            Item sem linha de serviço. Vincule ao catálogo para entrar nos relatórios por serviço.
          </span>
          <div className="w-[240px]">
            <EntityCombobox
              entity="service_catalog"
              select="id, name, code, unit"
              searchColumns={["name", "code", "description"]}
              filters={{ active: true }}
              labelFrom={(r) => String((r as { name?: string }).name ?? "Serviço")}
              value={null}
              onChange={(id, item) => {
                if (!id) return;
                onUpdate({
                  service_catalog_id: id,
                  ...(li.name ? {} : { name: item?.label ?? null }),
                } as Partial<LineItem>);
              }}
              placeholder="Vincular serviço…"
              emptyLabel="Nenhum serviço"
              icon={Wrench}
              clearable={false}
            />
          </div>
        </div>
      )}

      <LineItemBillingFields
        item={li}
        currency={currency}
        onUpdate={onUpdate}
        onDirty={onDirty}
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <LabeledNumber
          label="Qtd"
          value={n(li.quantity)}
          step="0.01"
          disabled={!quantityEnabled}
          onDirty={onDirty}
          onCommit={(v) => onUpdate({ quantity: v })}
        />
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {model === "percent_of_base" ? "Preço (não usado)" : priceLabel}
          </div>
          <CurrencyCommitInput
            aria-label={priceLabel}
            currency={currency}
            value={n(li.unit_price)}
            onCommit={(v) => onUpdate({ unit_price: v ?? 0 })}
          />
        </div>
        <DiscountField
          currency={currency}
          discountType={(li.discount_type ?? "pct") as "pct" | "amount"}
          discountPct={n(li.discount_pct)}
          discountAmount={n(li.discount_amount)}
          onChangeType={(type) =>
            onUpdate(
              type === "pct"
                ? { discount_type: "pct", discount_amount: 0 }
                : { discount_type: "amount", discount_pct: 0 },
            )
          }
          onCommitPct={(v) => onUpdate({ discount_pct: v })}
          onCommitAmount={(v) => onUpdate({ discount_amount: v })}
        />
        <LabeledNumber
          label="Imp %"
          value={n(li.tax_rate)}
          step="0.01"
          onDirty={onDirty}
          onCommit={(v) => onUpdate({ tax_rate: v })}
        />
      </div>
      <div className="text-right text-sm font-medium tabular-nums">
        {formatCurrency(lineTotal(li), currency)}
      </div>
    </div>
  );
}
