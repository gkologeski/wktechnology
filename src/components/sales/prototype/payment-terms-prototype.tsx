import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/techhire/ui";
import { WorkScreenAccess } from "@/components/work-access";
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
  suggestPaymentTerms,
  validatePaymentTerms,
  type PaymentTerms,
} from "@/lib/sales/payment-terms";

/** Protótipo CONDICOES-PAGAMENTO: dados de exemplo, sem leitura ou gravação. */
const ITEMS = [
  { name: "Consultoria — Pacote de horas", kind: "Consultoria", total: 45000 },
  { name: "Fábrica de Software — Portal", kind: "Fábrica de Software", total: 120000 },
];

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (iso: string | null) =>
  iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("pt-BR") : "Na entrega do marco";

function initial(): PaymentTerms {
  return suggestPaymentTerms(ITEMS.map((i) => i.kind));
}

export function PaymentTermsPrototype() {
  const [terms, setTerms] = useState<PaymentTerms>(() => initial());
  const items = ITEMS;
  const total = items.reduce((s, i) => s + i.total, 0);
  const errors = validatePaymentTerms(terms, total);
  const schedule = useMemo(
    () => (errors.length ? [] : buildPaymentSchedule(terms, total, new Date())),
    [terms, total, errors.length],
  );

  const plan = terms.plan;
  const dp = terms.downPayment;
  const setPlanKind = (k: string) => {
    if (!k) return;
    const dueDay = "dueDay" in plan ? plan.dueDay : 10;
    setTerms({
      ...terms,
      plan:
        k === "monthly"
          ? { kind: "monthly", months: 12, dueDay }
          : k === "periodic"
            ? { kind: "periodic", count: 3, intervalMonths: 1, dueDay }
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
  const num = (v: string) => (v === "" ? 0 : Number(v));

  return (
    <WorkScreenAccess resources={["techcontracts.contracts"]}>
      <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
        <PageHeader
          eyebrow="Protótipo · dados de exemplo"
          title="Condições de pagamento da cotação"
          description="Nada aqui é lido ou gravado. Escolha um cenário e mude as condições para ver as parcelas."
          secondaryActions={
            <ToggleGroup
              type="single"
              value={scenario}
              aria-label="Cenário de exemplo"
              onValueChange={(v) => {
                if (!v) return;
                setScenario(v as ScenarioKey);
                setTerms(initial(v as ScenarioKey));
              }}
            >
              {(Object.keys(SCENARIOS) as ScenarioKey[]).map((k) => (
                <ToggleGroupItem key={k} value={k}>
                  {SCENARIOS[k].label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          }
        />

        <section className="rounded-lg border border-border bg-card p-5">
          <SectionHeader title="Itens de linha" />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => (
                <TableRow key={i.name}>
                  <TableCell>{i.name}</TableCell>
                  <TableCell className="text-muted-foreground">{i.kind}</TableCell>
                  <TableCell className="text-right">{brl(i.total)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={2} className="font-medium">
                  Total
                </TableCell>
                <TableCell className="text-right font-semibold">{brl(total)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </section>

        <section className="grid gap-6 rounded-lg border border-border bg-card p-5 lg:grid-cols-2">
          <div className="flex flex-col gap-5">
            <SectionHeader
              title="Condições de pagamento"
              description="Sugeridas pelo tipo dos itens; ajuste à vontade."
            />

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
                  setTerms({
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
                      setTerms({ ...terms, downPayment: { kind: dp.kind, value: num(e.target.value) } })
                    }
                  />
                  <span className="text-sm text-muted-foreground">
                    {dp.kind === "percent" ? `% = ${brl((total * dp.value) / 100)}` : "R$"}
                  </span>
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
              </ToggleGroup>

              {plan.kind === "monthly" && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Meses" value={plan.months} onChange={(v) => setTerms({ ...terms, plan: { ...plan, months: num(v) } })} />
                  <Field label="Dia de vencimento" value={plan.dueDay} onChange={(v) => setTerms({ ...terms, plan: { ...plan, dueDay: num(v) } })} />
                </div>
              )}
              {plan.kind === "periodic" && (
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Parcelas" value={plan.count} onChange={(v) => setTerms({ ...terms, plan: { ...plan, count: num(v) } })} />
                  <Field label="A cada (meses)" value={plan.intervalMonths} onChange={(v) => setTerms({ ...terms, plan: { ...plan, intervalMonths: num(v) } })} />
                  <Field label="Dia de vencimento" value={plan.dueDay} onChange={(v) => setTerms({ ...terms, plan: { ...plan, dueDay: num(v) } })} />
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
                          setTerms({ ...terms, plan: { kind: "milestones", milestones: ms } });
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
                          setTerms({ ...terms, plan: { kind: "milestones", milestones: ms } });
                        }}
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remover marco ${i + 1}`}
                        onClick={() =>
                          setTerms({
                            ...terms,
                            plan: { kind: "milestones", milestones: plan.milestones.filter((_, j) => j !== i) },
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
                      setTerms({
                        ...terms,
                        plan: { kind: "milestones", milestones: [...plan.milestones, { label: "", percent: 0 }] },
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
              <ul role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
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
                      <TableCell className="text-muted-foreground">{fmtDate(s.dueDate)}</TableCell>
                      <TableCell className="text-right">{brl(s.amount)}</TableCell>
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
      </div>
    </WorkScreenAccess>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  const id = `f-${label.replace(/\W+/g, "-")}`;
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
