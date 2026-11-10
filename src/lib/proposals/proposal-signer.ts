// Escolha do signatário exibido na proposta (TEXTO-CONSULTORIA).
export type SignerCandidate = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  custom_fields: Record<string, unknown> | null;
};
export type ProposalSigner = { full_name: string; cpf: string; email: string };

function toSigner(c: SignerCandidate): ProposalSigner {
  return {
    full_name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
    cpf: typeof c.custom_fields?.cpf === "string" ? (c.custom_fields.cpf as string) : "",
    email: c.email ?? "",
  };
}

/** Signatário legal único da empresa; senão, o contato da proposta; senão, vazio. */
export function chooseProposalSigner(
  legalSigners: SignerCandidate[],
  proposalContact: SignerCandidate | null,
): ProposalSigner {
  if (legalSigners.length === 1) return toSigner(legalSigners[0]);
  if (proposalContact) return toSigner(proposalContact);
  return { full_name: "", cpf: "", email: "" };
}
