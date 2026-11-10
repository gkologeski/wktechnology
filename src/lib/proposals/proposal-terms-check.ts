// PROPOSTA-COMPLETA: condições de pagamento obrigatórias para gerar contrato.
export type ProposalPaymentTerms = {
  installments: number | null | undefined;
  dueDay: number | null | undefined;
};

/** Lista, em português, as condições que faltam para o contrato. */
export function missingPaymentTerms(t: ProposalPaymentTerms): string[] {
  const out: string[] = [];
  if (!t.installments || t.installments < 1 || t.installments > 120) out.push("Parcelas");
  if (!t.dueDay || t.dueDay < 1 || t.dueDay > 31) out.push("Dia de vencimento");
  return out;
}

export function missingPaymentTermsMessage(t: ProposalPaymentTerms): string | null {
  const m = missingPaymentTerms(t);
  return m.length ? `Informe ${m.join(" e ")} — são usados para gerar o contrato.` : null;
}
