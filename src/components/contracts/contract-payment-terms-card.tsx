import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/crm";
import {
  buildPaymentSchedule,
  describePaymentTerms,
  parsePaymentTerms,
  validatePaymentTerms,
} from "@/lib/sales/payment-terms";

const when = (d: string | null, e?: "signature" | "milestone") =>
  d
    ? d.split("-").reverse().join("/")
    : e === "signature"
      ? "Na assinatura do contrato"
      : e === "milestone"
        ? "Na entrega do marco"
        : "—";

/** CONDICOES-PAGAMENTO: condições vindas da proposta/cotação (somente leitura). */
export function ContractPaymentTermsCard({
  raw,
  total,
  currency,
}: {
  raw: unknown;
  total: number;
  currency: string;
}) {
  const terms = parsePaymentTerms(raw);
  if (!terms) return null;
  const errors = validatePaymentTerms(terms, total);
  const rows = errors.length ? [] : buildPaymentSchedule(terms, total, new Date());
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Condições de pagamento</CardTitle>
        <p className="text-sm text-muted-foreground">
          {describePaymentTerms(terms)}. As contas a receber são geradas na ativação do serviço.
        </p>
      </CardHeader>
      <CardContent>
        {errors.length ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.join(" ")} Ajuste o valor do contrato ou as condições na proposta.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Vencimento previsto</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.sequence}>
                  <TableCell>{r.sequence}</TableCell>
                  <TableCell>{r.label}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {when(r.dueDate, r.dueEvent)}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(r.amount, currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
