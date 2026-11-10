// CONDICOES-PAGAMENTO: texto de {{contract.payment_schedule}} nos modelos de contrato.
import {
  describePaymentTerms,
  parsePaymentTerms,
  validatePaymentTerms,
} from "@/lib/sales/payment-terms";

/** Resumo das condições; sem cronograma válido, usa parcelas e dia (formato antigo). */
export function paymentScheduleText(
  rawTerms: unknown,
  total: number,
  installments: number | null,
  dueDay: number | null,
): string | null {
  const t = parsePaymentTerms(rawTerms);
  if (t && validatePaymentTerms(t, total).length === 0) return describePaymentTerms(t);
  if (installments && dueDay)
    return `${installments} parcela(s), com vencimento todo dia ${dueDay}`;
  return null;
}
