// Tipos do documento da proposta (compartilhados entre servidor e telas).
export type ProposalDocumentData = {
  proposal: {
    id: string;
    title: string;
    body: string;
    status: string;
    locked: boolean;
    version: number;
    total_amount: number | null;
    currency: string;
    expires_at: string | null;
    sent_at: string | null;
    decided_at: string | null;
    created_at: string;
    public_token: string | null;
    deal_id: string | null;
    quote_id: string | null;
  };
  items: Array<{ id: string; name: string; billing: string }>;
  company: string | null;
  contact: string | null;
  contactEmail: string | null;
  agent: string | null;
};

export const PROPOSAL_STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  approved: "Aprovada",
  sent: "Enviada",
  accepted: "Aceita",
  rejected: "Recusada",
  expired: "Expirada",
  canceled: "Cancelada",
};
