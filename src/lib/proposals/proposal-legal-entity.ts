// Empresa emissora (CNPJ) da proposta — EMPRESA-PROPOSTA. Regra pura.
export type LegalEntityOption = { id: string; name: string; cnpj: string | null };

export const LEGAL_ENTITY_REQUIRED_MESSAGE = "Escolha a empresa emissora (CNPJ) da proposta.";
export const LEGAL_ENTITY_INACTIVE_HINT =
  "A empresa do negócio está inativa. Escolha a empresa emissora.";

/** Pré-seleciona a empresa de origem só quando ela está entre as ativas. */
export function pickInitialLegalEntity(
  originId: string | null | undefined,
  options: LegalEntityOption[],
): { id: string | null; originInactive: boolean } {
  if (!originId) return { id: null, originInactive: false };
  const ok = options.some((o) => o.id === originId);
  return ok ? { id: originId, originInactive: false } : { id: null, originInactive: true };
}

/** Troca o erro técnico do banco por uma mensagem que indica o campo. */
export function friendlyLegalEntityError(message: string): string {
  return /Empresa \(CNPJ\) inativa|empresa \(CNPJ\) padrão/i.test(message)
    ? LEGAL_ENTITY_REQUIRED_MESSAGE
    : message;
}
