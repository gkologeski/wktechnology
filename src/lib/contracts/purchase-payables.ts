/**
 * CONTAS-A-PAGAR-COMPRA — proposta pura das parcelas de um contrato de compra assinado.
 * O Financeiro revisa e confirma; nada é gravado aqui.
 */
import { buildPaymentSchedule, type PaymentTerms } from "@/lib/sales/payment-terms";

export type ProposedPayable = { label: string; amount: number; due_on: string };

export type PurchaseForPayables = {
  total_value: number | null;
  payment_terms: unknown;
  signed_at: string | null;
  starts_at: string | null;
};

const day = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null);

/** Usa as condições de pagamento do contrato; sem elas (ou inválidas), propõe parcela única. */
export function proposePurchasePayables(c: PurchaseForPayables, today: string): ProposedPayable[] {
  const total = Number(c.total_value ?? 0);
  if (!(total > 0)) return [];
  const base = day(c.signed_at) ?? day(c.starts_at) ?? today;
  const terms = c.payment_terms as PaymentTerms | null;
  if (terms && typeof terms === "object" && "plan" in terms) {
    try {
      const start = new Date(`${base}T12:00:00Z`);
      return buildPaymentSchedule(terms, total, start, { signedAt: c.signed_at }).map((p) => ({
        label: p.label,
        amount: p.amount,
        due_on: p.dueDate ?? base,
      }));
    } catch {
      /* condições inválidas: cai na parcela única */
    }
  }
  return [{ label: "Parcela única", amount: Math.round(total * 100) / 100, due_on: base }];
}

/** Mesma regra do banco: 1 a 60 parcelas, valor e data em todas, soma fecha o total em centavos. */
export function payablesProblem(total: number, list: ProposedPayable[]): string | null {
  if (list.length < 1 || list.length > 60) return "Informe de 1 a 60 parcelas.";
  if (list.some((x) => !(x.amount > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(x.due_on)))
    return "Toda parcela precisa de valor e vencimento.";
  const cents = list.reduce((s, x) => s + Math.round(x.amount * 100), 0);
  if (cents !== Math.round(total * 100))
    return "A soma das parcelas deve fechar o valor do contrato.";
  return null;
}
