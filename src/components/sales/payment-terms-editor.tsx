import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { SectionHeader } from "@/components/techhire/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  buildPaymentSchedule,
  downPaymentAmount,
  downPaymentDueOf,
  validatePaymentTerms,
  type PaymentTerms,
} from "@/lib/sales/payment-terms";
import { formatCurrency } from "@/lib/crm";
import { IsoDatePicker } from "@/components/iso-date-picker";

const fmtDate = (iso: string | null, event?: "signature" | "milestone") =>
  iso
    ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("pt-BR")
    : event === "signature"
      ? "Na assinatura do contrato"
      : "Na entrega do marco";

const num = (v: string) => (v === "" ? 0 : Number(v));

type Props = {
  terms: PaymentTerms;
  onChange: (terms: PaymentTerms) => void;
  total: number;
  currency?: string;
  /** Descrição do painel; o padrão vale para cotação, proposta e contrato. */
  description?: string;
};

/**
 * CONDICOES-PAGAMENTO: editor das condições de pagamento (entrada + saldo).
 * Componente controlado: não lê nem grava nada, só mostra as parcelas previstas.
 */
export function PaymentTermsEditor({
  terms,
  onChange,
  total,
  currency = "BRL",
  description = "Sugeridas pelo tipo dos itens; ajuste à vontade.",
}: Props) {
  const plan = terms.plan;
  const dp = terms.downPayment;
  const errors = validatePaymentTerms(terms, total);
  const schedule = useMemo(
    () => (errors.length ? [] : buildPaymentSchedule(terms, total, new Date())),
    [terms, total, errors.length],
  );

  const setPlanKind = (k: string) => {
    if (!k) return;
    const dueDay = "dueDay" in plan ? plan.dueDay : 10;
    onChange({
      ...terms,
      plan:
        k === "monthly"
          ? { kind: "monthly", months: 12, dueDay }
          : k === "periodic"
            ? { kind: "periodic", count: 3, intervalMonths: 1, dueDay }
            : k === "fixed_date"
              ? { kind: "fixed_date", date: "" }
              : {
                  kind: "milestones",
                  milestones: [
                    { label: "Aprovação do escopo", percent: 30 },
                    { label: "Homologação", percent: 40 },
                    { label: "Entrega final", percent: 30 },
                  ],
                },
    });
  };

  return (
    <section className="grid gap-6 rounded-lg border border-border bg-card p-5 lg:grid-cols-2">
      <div className="flex flex-col gap-5">
        <SectionHeader title="Condições de pagamento" description={description} />

        <div className="flex flex-col gap-2">
          <Label>Entrada</Label>
          <ToggleGroup
            type="single"
            variant="outline"
            className="justify-start flex-wrap"
            value={dp.kind}
            aria-label="Tipo de entrada"
            onValueChange={(k) =>
              k &&
              onChange({
                ...terms,
                downPayment:
                  k === "none"
                    ? { kind: "none" }
                    : { kind: k as "amount" | "percent", value: k === "percent" ? 30 : 10000 },
              })
            }
          >
            <ToggleGroupItem value="none">Sem entrada</ToggleGroupItem>
            <ToggleGroupItem value="percent">% do total</ToggleGroupItem>
            <ToggleGroupItem value="amount">Valor em R$</ToggleGroupItem>
          </ToggleGroup>
          {dp.kind !== "none" && (
            <div className="flex items-center gap-2">
              <Input
                id="dp-value"
                aria-label={dp.kind === "percent" ? "Percentual da entrada" : "Valor da entrada"}
                type="number"
                className="w-40"
                value={dp.value}
                onChange={(e) =>
                  onChange({ ...terms, downPayment: { kind: dp.kind, value: num(e.target.value) } })
                }
              />
              <span className="text-sm text-muted-foreground">
                {dp.kind === "percent"
                  ? `% = ${formatCurrency(downPaymentAmount(dp, total), currency)}`
                  : "R$"}
              </span>
            </div>
          )}
          {dp.kind !== "none" && (
            <div className="flex flex-col gap-2">
              <Label>Vencimento da entrada</Label>
              <ToggleGroup
                type="single"
                variant="outline"
                className="justify-start flex-wrap"
                value={downPaymentDueOf(terms).kind}
                aria-label="Vencimento da entrada"
                onValueChange={(k) =>
                  k &&
                  onChange({
                    ...terms,
                    downPaymentDue:
                      k === "date" ? { kind: "date", date: "" } : { kind: "signature" },
                  })
                }
              >
                <ToggleGroupItem value="signature">Na assinatura do contrato</ToggleGroupItem>
                <ToggleGroupItem value="date">Em uma data</ToggleGroupItem>
              </ToggleGroup>
              {terms.downPaymentDue?.kind === "date" && (
                <IsoDatePicker
                  ariaLabel="Data de vencimento da entrada"
                  className="w-48"
                  value={terms.downPaymentDue.date || null}
                  onChange={(v) =>
                    onChange({ ...terms, downPaymentDue: { kind: "date", date: v ?? "" } })
                  }
                />
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label>Saldo</Label>
          <ToggleGroup
            type="single"
            variant="outline"
            className="justify-start flex-wrap"
            value={plan.kind}
            aria-label="Forma do saldo"
            onValueChange={setPlanKind}
          >
            <ToggleGroupItem value="monthly">Mensal</ToggleGroupItem>
            <ToggleGroupItem value="periodic">Parcelas periódicas</ToggleGroupItem>
            <ToggleGroupItem value="milestones">Por entregas/marcos</ToggleGroupItem>
            <ToggleGroupItem value="fixed_date">Em uma data</ToggleGroupItem>
          </ToggleGroup>
          {plan.kind === "fixed_date" && (
            <IsoDatePicker
              ariaLabel="Data de vencimento do saldo"
              className="w-48"
              value={plan.date || null}
              onChange={(v) => onChange({ ...terms, plan: { kind: "fixed_date", date: v ?? "" } })}
            />
          )}

          {plan.kind === "monthly" && (
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Meses"
                value={plan.months}
                onChange={(v) => onChange({ ...terms, plan: { ...plan, months: num(v) } })}
              />
              <Field
                label="Dia de vencimento"
                value={plan.dueDay}
                onChange={(v) => onChange({ ...terms, plan: { ...plan, dueDay: num(v) } })}
              />
            </div>
          )}
          {plan.kind === "periodic" && (
            <div className="grid grid-cols-3 gap-3">
              <Field
                label="Parcelas"
                value={plan.count}
                onChange={(v) => onChange({ ...terms, plan: { ...plan, count: num(v) } })}
              />
              <Field
                label="A cada (meses)"
                value={plan.intervalMonths}
                onChange={(v) => onChange({ ...terms, plan: { ...plan, intervalMonths: num(v) } })}
              />
              <Field
                label="Dia de vencimento"
                value={plan.dueDay}
                onChange={(v) => onChange({ ...terms, plan: { ...plan, dueDay: num(v) } })}
              />
            </div>
          )}
          {plan.kind === "milestones" && (
            <div className="flex flex-col gap-2">
              {plan.milestones.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    aria-label={`Nome do marco ${i + 1}`}
                    value={m.label}
                    onChange={(e) => {
                      const ms = [...plan.milestones];
                      ms[i] = { ...m, label: e.target.value };
                      onChange({ ...terms, plan: { kind: "milestones", milestones: ms } });
                    }}
                  />
                  <Input
                    aria-label={`Percentual do marco ${i + 1}`}
                    type="number"
                    className="w-24"
                    value={m.percent}
                    onChange={(e) => {
                      const ms = [...plan.milestones];
                      ms[i] = { ...m, percent: num(e.target.value) };
                      onChange({ ...terms, plan: { kind: "milestones", milestones: ms } });
                    }}
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover marco ${i + 1}`}
                    onClick={() =>
                      onChange({
                        ...terms,
                        plan: {
                          kind: "milestones",
                          milestones: plan.milestones.filter((_, j) => j !== i),
                        },
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() =>
                  onChange({
                    ...terms,
                    plan: {
                      kind: "milestones",
                      milestones: [...plan.milestones, { label: "", percent: 0 }],
                    },
                  })
                }
              >
                <Plus className="mr-1 h-4 w-4" /> Adicionar marco
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <SectionHeader
          title="Parcelas previstas"
          description="Vão para a proposta e o contrato; as contas a receber nascem na ativação do serviço."
        />
        {errors.length > 0 ? (
          <ul
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedule.map((s) => (
                <TableRow key={s.sequence}>
                  <TableCell>{s.sequence}</TableCell>
                  <TableCell>{s.label}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {fmtDate(s.dueDate, s.dueEvent)}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(s.amount, currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <p className="text-xs text-muted-foreground">
          As datas acima são exemplo a partir de hoje; no contrato real contam a partir da ativação.
        </p>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: string) => void;
}) {
  const id = `ptf-${label.replace(/\W+/g, "-")}`;
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
