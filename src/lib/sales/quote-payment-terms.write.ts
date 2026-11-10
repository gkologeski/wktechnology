import { validatePaymentTerms, type PaymentTerms } from "./payment-terms";

export const QUOTE_PAYMENT_TERMS_MISSING = "Cotação não encontrada.";

/** Estreitamento do acesso ao banco: o núcleo só enxerga estas duas operações. */
export interface QuotePaymentStore {
  /** Total da cotação, ou null quando a linha não é visível para quem chama (RLS). */
  readTotal(quoteId: string): Promise<number | null>;
  writeTerms(quoteId: string, terms: PaymentTerms): Promise<void>;
}

/**
 * CONDICOES-PAGAMENTO: grava as condições de pagamento de uma cotação.
 * A permissão é conferida antes (middleware + assertSalesRecord); aqui só se
 * confere se a linha é visível e se os números fazem sentido para o total.
 */
export async function saveQuotePaymentTermsCore(
  store: QuotePaymentStore,
  quoteId: string,
  terms: PaymentTerms,
): Promise<{ ok: true }> {
  const total = await store.readTotal(quoteId);
  if (total === null) throw new Error(QUOTE_PAYMENT_TERMS_MISSING);
  const errors = validatePaymentTerms(terms, total);
  if (errors.length) throw new Error(errors.join(" "));
  await store.writeTerms(quoteId, terms);
  return { ok: true };
}
