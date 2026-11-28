import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import { IsoDatePicker } from "@/components/iso-date-picker";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { readViewAs } from "@/lib/view-as-client";
import {
  PURCHASE_PROPOSAL_KEYS,
  type PurchaseProposalData,
} from "@/lib/contracts/purchase-proposal.types";
import { purchaseProposalAmounts } from "@/lib/contracts/purchase-proposal-amounts";

const money = (value: number, currency: string) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
function amounts(data: PurchaseProposalData) {
  try {
    return purchaseProposalAmounts(data);
  } catch {
    return null;
  }
}

export function PurchaseProposalSummary({
  data,
  currency,
  compact = false,
}: {
  data: PurchaseProposalData;
  currency: string;
  compact?: boolean;
}) {
  const calculated = amounts(data);
  return (
    <dl
      className={compact ? "space-y-4 text-sm" : "grid gap-4 text-sm sm:grid-cols-3"}
      aria-label="Condições desta compra"
    >
      <div>
        <dt className="text-muted-foreground">Esforço acordado</dt>
        <dd className="mt-1 font-medium">{data.hours} horas</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Duração</dt>
        <dd className="mt-1 font-medium">{data.businessDays} dias úteis</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Preço fechado</dt>
        <dd className="mt-1 font-semibold text-primary">
          {calculated ? money(calculated.total, currency) : "Preencha valores válidos"}
        </dd>
      </div>
    </dl>
  );
}

/** Only receives the purchase's own values; no sale records or client context. */
export function PurchaseProposalFields({
  value,
  onChange,
  disabled: disabledByParent,
  currency,
}: {
  value: PurchaseProposalData;
  onChange: (data: PurchaseProposalData) => void;
  disabled: boolean;
  currency: string;
}) {
  const permissions = usePermissions();
  const viewAs = readViewAs();
  const viewAllowed =
    !permissions.isLoading &&
    !permissions.isError &&
    !!permissions.workspaceId &&
    permissions.can(PURCHASE_PROPOSAL_KEYS.view);
  const disabled =
    disabledByParent ||
    !viewAllowed ||
    !permissions.can(PURCHASE_PROPOSAL_KEYS.manage) ||
    !!viewAs?.readOnly ||
    viewAs?.mode === "role";
  if (!viewAllowed) return null;
  const calculated = amounts(value);
  const hoursMatch =
    Math.abs(value.milestones.reduce((sum, row) => sum + row.hours, 0) - value.hours) <= 0.000001;
  const update = <K extends keyof PurchaseProposalData>(key: K, next: PurchaseProposalData[K]) =>
    onChange({ ...value, [key]: next });
  const text = (
    key:
      | "title"
      | "scope"
      | "exclusions"
      | "acceptanceCriteria"
      | "paymentTerms"
      | "responsibilities",
    label: string,
    rows?: number,
  ) => (
    <div className="space-y-2">
      <Label htmlFor={`purchase-${key}`}>{label}</Label>
      {rows ? (
        <Textarea
          id={`purchase-${key}`}
          rows={rows}
          value={value[key]}
          disabled={disabled}
          onChange={(event) => update(key, event.target.value)}
        />
      ) : (
        <Input
          id={`purchase-${key}`}
          value={value[key]}
          disabled={disabled}
          onChange={(event) => update(key, event.target.value)}
        />
      )}
    </div>
  );
  return (
    <div className="space-y-7">
      <div className="space-y-4">
        {text("title", "Título para a prestadora")}
        {text("scope", "Escopo técnico", 5)}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="purchase-hours">Esforço para formação do preço (h)</Label>
            <Input
              id="purchase-hours"
              type="number"
              min="0"
              step="0.01"
              value={value.hours || ""}
              disabled={disabled}
              onChange={(event) => update("hours", Number(event.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="purchase-hourlyRate">Valor-hora de referência</Label>
            <CurrencyInput
              id="purchase-hourlyRate"
              value={value.hourlyRate || null}
              currency={currency}
              disabled={disabled}
              onValueChange={(next) => update("hourlyRate", next ?? 0)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="purchase-businessDays">Duração (dias úteis)</Label>
            <Input
              id="purchase-businessDays"
              type="number"
              min="1"
              step="1"
              value={value.businessDays || ""}
              disabled={disabled}
              onChange={(event) => update("businessDays", Number(event.target.value))}
            />
          </div>
          <div className="self-end rounded-lg bg-muted/40 px-3 py-2 text-sm">
            Preço fechado por entrega. O esforço excedente para cumprir o escopo é da prestadora.
          </div>
          <div className="space-y-2">
            <Label htmlFor="purchase-startsOn">Início previsto (opcional)</Label>
            <IsoDatePicker
              id="purchase-startsOn"
              value={value.startsOn}
              onChange={(next) => update("startsOn", next)}
              disabled={disabled}
              max={value.endsOn}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="purchase-endsOn">Fim previsto (opcional)</Label>
            <IsoDatePicker
              id="purchase-endsOn"
              value={value.endsOn}
              onChange={(next) => update("endsOn", next)}
              disabled={disabled}
              min={value.startsOn}
            />
          </div>
        </div>
      </div>

      <section className="space-y-4" aria-label="Marcos de entrega">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">Marcos de entrega</h3>
            <p className="text-xs text-muted-foreground">
              Descreva o resultado e o aceite de cada entrega. A soma das horas deve conferir.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || value.milestones.length >= 50}
            onClick={() =>
              update("milestones", [
                ...value.milestones,
                {
                  id: crypto.randomUUID(),
                  title: "",
                  description: "",
                  acceptanceCriteria: "",
                  hours: 0,
                  businessDays: 0,
                },
              ])
            }
          >
            <Plus className="mr-1 h-4 w-4" aria-hidden /> Adicionar marco
          </Button>
        </div>
        {value.milestones.map((milestone, index) => {
          const change = (patch: Partial<PurchaseProposalData["milestones"][number]>) =>
            update(
              "milestones",
              value.milestones.map((row) => (row.id === milestone.id ? { ...row, ...patch } : row)),
            );
          const fieldId = `purchase-milestone-${index}`;
          return (
            <fieldset key={milestone.id} className="space-y-3 rounded-xl bg-muted/30 p-4">
              <legend className="px-1 text-sm font-medium">Marco {index + 1}</legend>
              <div className="flex items-start gap-2">
                <div className="flex-1 space-y-2">
                  <Label htmlFor={`${fieldId}-title`}>Nome da entrega</Label>
                  <Input
                    id={`${fieldId}-title`}
                    value={milestone.title}
                    disabled={disabled}
                    onChange={(event) => change({ title: event.target.value })}
                  />
                </div>
                <Button
                  type="button"
                  className="mt-7"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remover marco ${index + 1}`}
                  disabled={disabled}
                  onClick={() =>
                    update(
                      "milestones",
                      value.milestones.filter((row) => row.id !== milestone.id),
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`${fieldId}-description`}>Resultado esperado</Label>
                  <Textarea
                    id={`${fieldId}-description`}
                    rows={2}
                    value={milestone.description}
                    disabled={disabled}
                    onChange={(event) => change({ description: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${fieldId}-acceptance`}>Critérios de aceite</Label>
                  <Textarea
                    id={`${fieldId}-acceptance`}
                    rows={2}
                    value={milestone.acceptanceCriteria}
                    disabled={disabled}
                    onChange={(event) => change({ acceptanceCriteria: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${fieldId}-hours`}>Horas acordadas</Label>
                  <Input
                    id={`${fieldId}-hours`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={milestone.hours || ""}
                    disabled={disabled}
                    onChange={(event) => change({ hours: Number(event.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${fieldId}-days`}>Prazo acumulado (dias úteis)</Label>
                  <Input
                    id={`${fieldId}-days`}
                    type="number"
                    min="1"
                    step="1"
                    value={milestone.businessDays || ""}
                    disabled={disabled}
                    onChange={(event) => change({ businessDays: Number(event.target.value) })}
                  />
                </div>
              </div>
              <p className="text-right text-sm font-medium">
                Valor fechado:{" "}
                {calculated?.milestones[index] !== undefined && hoursMatch
                  ? money(calculated.milestones[index], currency)
                  : "Confira as horas e valores"}
              </p>
            </fieldset>
          );
        })}
        {!value.milestones.length && (
          <p className="text-sm text-muted-foreground">Adicione os marcos deste fornecimento.</p>
        )}
        <p className="text-sm text-muted-foreground">
          Total dos marcos: {value.milestones.reduce((sum, row) => sum + row.hours, 0)} horas.
        </p>
      </section>

      <details className="space-y-4 rounded-xl bg-muted/20 p-4" open>
        <summary className="cursor-pointer font-medium">
          Aceite, responsabilidades e condições
        </summary>
        <div className="space-y-4 pt-3">
          {text("acceptanceCriteria", "Aceite geral da contratação", 3)}
          {text("responsibilities", "Responsabilidades da prestadora e da WK", 4)}
          {text("paymentTerms", "Condições de pagamento", 3)}
          {text("exclusions", "Exclusões e mudanças de escopo", 3)}
          <div className="max-w-xs space-y-2">
            <Label htmlFor="purchase-warrantyDays">Garantia por entrega aceita (dias)</Label>
            <Input
              id="purchase-warrantyDays"
              type="number"
              min="0"
              step="1"
              value={value.warrantyDays}
              disabled={disabled}
              onChange={(event) => update("warrantyDays", Number(event.target.value))}
            />
          </div>
        </div>
      </details>
    </div>
  );
}
