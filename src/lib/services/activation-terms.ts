/**
 * CONDICOES-PAGAMENTO — cronograma enviado ao banco na ativação do serviço.
 * Puro: devolve null quando o contrato não tem condições válidas (o serviço
 * segue a cobrança própria de sempre).
 */
import { buildPaymentSchedule, parsePaymentTerms } from "@/lib/sales/payment-terms";

export type ActivationScheduleItem = {
  label: string;
  amount: number;
  dueDate: string | null;
  dueEvent: "signature" | "milestone" | null;
};

export function activationSchedule(
  rawTerms: unknown,
  total: number | null,
  startIso: string,
  signedAt: string | null,
): ActivationScheduleItem[] | null {
  const terms = parsePaymentTerms(rawTerms);
  if (!terms || total == null || !(total > 0)) return null;
  const start = new Date(`${startIso}T12:00:00Z`);
  return buildPaymentSchedule(terms, total, start, { signedAt }).map((r) => ({
    label: r.label,
    amount: r.amount,
    dueDate: r.dueDate,
    dueEvent: r.dueEvent ?? null,
  }));
}
