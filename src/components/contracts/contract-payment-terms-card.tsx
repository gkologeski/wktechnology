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
import { parseIsoDate } from "@/lib/iso-date";
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
  startsAt,
  signedAt,
  publicView = false,
}: {
  raw: unknown;
  total: number;
  currency: string;
  startsAt?: string | null;
  signedAt?: string | null;
  publicView?: boolean;
}) {
  const terms = parsePaymentTerms(raw);
  if (!terms) return null;
  const errors = validatePaymentTerms(terms, total);
  const start = parseIsoDate(startsAt?.slice(0, 10));
  const needsStart = terms.plan.kind === "monthly" || terms.plan.kind === "periodic";
  // Datas relativas usam o início salvo. Nas demais modalidades a base não participa do cálculo.
  const rows =
    errors.length || (needsStart && !start)
      ? []
      : buildPaymentSchedule(
          terms,
          total,
          start
            ? new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()))
            : new Date(),
          { signedAt },
        );
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Condições de pagamento</CardTitle>
        <p className="text-sm text-muted-foreground">
          {describePaymentTerms(terms)}.{" "}
          {publicView
            ? "Condições desta versão do contrato. O aceite comercial e a assinatura são registros separados."
            : "As contas a receber dependem da assinatura ou do aceite do contrato com liberação financeira. A conclusão da execução é independente."}
        </p>
      </CardHeader>
      <CardContent>
        {errors.length ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.join(" ")} Ajuste o valor do contrato ou as condições na proposta.
          </p>
        ) : needsStart && !start ? (
          <p className="text-sm text-muted-foreground">
            Os vencimentos relativos serão calculados quando a data de início do contrato estiver
            definida.
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
