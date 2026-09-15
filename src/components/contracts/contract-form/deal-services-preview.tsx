// Serviços contratados no negócio que serão copiados para o contrato.
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { describeBilling } from "@/lib/catalog/billing-model";
import { formatCurrency } from "@/lib/crm";

export type PreviewLineItem = {
  id: string;
  name: string | null;
  quantity: number | null;
  unit_price: number | null;
  unit: string | null;
  billing_model: string | null;
  percent: number | null;
  cadence: string | null;
};

export function DealServicesPreview({
  items,
  selectedIds,
  onToggle,
  currency = "BRL",
  disabled = false,
}: {
  items: PreviewLineItem[];
  selectedIds: string[];
  onToggle: (id: string, checked: boolean) => void;
  currency?: string;
  disabled?: boolean;
}) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        O negócio selecionado não tem serviços nos itens de linha.
      </p>
    );
  }

  const money = (v: number) => formatCurrency(v, currency);

  return (
    <div className="space-y-2">
      {disabled && (
        <p className="text-xs text-muted-foreground">
          Serviços só podem ser vinculados a contratos de prestação.
        </p>
      )}
      <div className="divide-y rounded-md border">
        {items.map((li) => {
          const id = `deal-item-${li.id}`;
          return (
            <div key={li.id} className="flex items-start gap-2 p-2">
              <Checkbox
                id={id}
                checked={selectedIds.includes(li.id)}
                onCheckedChange={(v) => onToggle(li.id, v === true)}
                disabled={disabled}
              />
              <div className="min-w-0">
                <Label htmlFor={id} className="text-sm font-medium">
                  {li.name ?? "Serviço"}
                </Label>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {describeBilling(li, money)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
