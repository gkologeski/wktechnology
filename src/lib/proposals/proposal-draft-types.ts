// Tipos do rascunho de proposta (compartilhados entre servidor e assistente).
export type ProposalDraftSource = { quoteId?: string; dealId?: string; proposalId?: string };

export type ProposalDraftItem = {
  id: string;
  name: string;
  billing: string;
  service_catalog_id: string | null;
};

export type ProposalDraft = {
  title: string;
  body: string;
  total_amount: number | null;
  currency: string;
  expires_at: string | null;
  assigned_to: string | null;
  company_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  quote_id: string | null;
  quote_number: string | null;
  proposal_template_id: string | null;
  company_name: string | null;
  contact_name: string | null;
  deal_name: string | null;
  items: ProposalDraftItem[];
  items_origin: "quote" | "deal" | null;
};

export type ProposalDraftResult =
  | { reused: true; existingId: string }
  | { reused: false; draft: ProposalDraft };
