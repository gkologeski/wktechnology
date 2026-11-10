import { useMemo, useState } from "react";
import { PageHeader } from "@/components/techhire/ui";
import { WorkScreenAccess } from "@/components/work-access";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaymentTermsEditor } from "@/components/sales/payment-terms-editor";
import { suggestPaymentTerms, type PaymentTerms } from "@/lib/sales/payment-terms";
import { formatCurrency } from "@/lib/crm";

/** Protótipo CONDICOES-PAGAMENTO: dados de exemplo, sem leitura ou gravação. */
const ITEMS = [
  { name: "Consultoria — Pacote de horas", kind: "Consultoria", total: 45000 },
  { name: "Fábrica de Software — Portal", kind: "Fábrica de Software", total: 120000 },
];

function initial(): PaymentTerms {
  return suggestPaymentTerms(ITEMS.map((i) => i.kind));
}

export function PaymentTermsPrototype() {
  const [terms, setTerms] = useState<PaymentTerms>(() => initial());
  const total = ITEMS.reduce((s, i) => s + i.total, 0);
  const subtotal = useMemo(() => total, [total]);

  return (
    <WorkScreenAccess resources={["techcontracts.contracts"]}>
      <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
        <PageHeader
          eyebrow="Protótipo · dados de exemplo"
          title="Condições de pagamento da cotação"
          description="Nada aqui é lido ou gravado. Mude as condições para ver as parcelas previstas."
        />

        <section className="rounded-lg border border-border bg-card p-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ITEMS.map((i) => (
                <TableRow key={i.name}>
                  <TableCell>{i.name}</TableCell>
                  <TableCell className="text-muted-foreground">{i.kind}</TableCell>
                  <TableCell className="text-right">{formatCurrency(i.total, "BRL")}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={2} className="font-medium">
                  Total
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(subtotal, "BRL")}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </section>

        <PaymentTermsEditor terms={terms} onChange={setTerms} total={total} />
      </div>
    </WorkScreenAccess>
  );
}
