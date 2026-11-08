// ACEITE-MINUTA: rótulos e regras puras da minuta de contrato.
export type ContractDraftStatus =
  | "pending_legal"
  | "approved"
  | "rejected"
  | "sent"
  | "accepted"
  | "changes_requested"
  | "canceled";

export const CONTRACT_DRAFT_STATUS_LABEL: Record<ContractDraftStatus, string> = {
  pending_legal: "Aguardando jurídico",
  approved: "Aprovada para envio",
  rejected: "Recusada",
  sent: "Enviada ao cliente",
  accepted: "Aceita pelo cliente",
  changes_requested: "Ajustes pedidos",
  canceled: "Cancelada",
};

export const CONTRACT_DRAFT_EVENT_LABEL: Record<string, string> = {
  opened: "Minuta aberta após o aceite da proposta",
  no_approvers: "Sem aprovador jurídico configurado",
  edited: "Minuta editada",
  approved: "Envio aprovado",
  rejected: "Minuta recusada",
};

/** Só minutas aguardando o jurídico (ou com ajustes pedidos) aceitam revisão. */
export function isContractDraftReviewable(status: string): boolean {
  return status === "pending_legal" || status === "changes_requested";
}

/** Texto visível mínimo (sem tags) exigido para aprovar. */
export function contractDraftHasText(html: string): boolean {
  return html.replace(/<[^>]*>/g, "").trim().length >= 20;
}
