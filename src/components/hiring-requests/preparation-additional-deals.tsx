import type { ReactNode } from "react";
import { MAX_ADDITIONAL_DEALS, changeAdditionalDeal } from "@/lib/hiring/requests/additional-deals";
import type { PickerKind, PreparationData } from "@/lib/hiring/requests/types";
/** Presentational list of additional deals; receives the bounded picker from the screen. */
export function PreparationAdditionalDeals({
  value,
  onChange,
  picker,
}: {
  value: PreparationData;
  onChange: (v: PreparationData) => void;
  picker: (
    k: PickerKind,
    label: string,
    value: string | null,
    onChange: (id: string | null) => void,
  ) => ReactNode;
}) {
  if (!value.deal_id) return null;
  const list = value.additional_deal_ids;
  return (
    <div className="space-y-3" role="group" aria-label="Negócios adicionais atendidos">
      {list.map((dealId, index) => (
        <div key={dealId}>
          {picker("deal", `Negócio adicional ${index + 1}`, dealId, (id) =>
            onChange(changeAdditionalDeal(value, dealId, id)),
          )}
        </div>
      ))}
      {list.length < MAX_ADDITIONAL_DEALS && (
        <div key={`new-${list.length}`}>
          {picker("deal", "Adicionar outro negócio atendido (opcional)", null, (id) =>
            onChange(changeAdditionalDeal(value, null, id)),
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Use quando o mesmo fornecedor atende mais de um negócio. Todos precisam ser da mesma
        entidade WK; o projeto deve pertencer a um deles.
      </p>
    </div>
  );
}
