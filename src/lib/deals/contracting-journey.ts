/** Uma jornada pertence a uma origem: nunca mistura documentos diferentes do negócio. */
export const JOURNEY_STEPS = ["Cotação", "Proposta", "Minuta", "Contrato", "Serviço"] as const;
export type JourneyDocument = {
  id: string;
  title: string | null;
  status: string;
  created_at: string;
  updated_at?: string | null;
};
export type JourneyQuote = JourneyDocument & {
  number: string | null;
  total: number | null;
  currency: string | null;
};
export type JourneyProposal = JourneyDocument & {
  quote_id: string | null;
  version: number;
  locked: boolean;
  decided_at: string | null;
  total_amount: number | null;
  currency: string | null;
  legal_entity_id: string | null;
};
export type JourneyDraft = JourneyDocument & {
  prepared_terms?: { starts_at?: string; ends_at?: string | null };
  proposal_id: string | null;
  revision: number;
  client_decided_at: string | null;
  client_note: string | null;
  missing_template: boolean;
};
export type JourneyContract = JourneyDocument & {
  proposal_id: string | null;
  quote_id: string | null;
  number: string | null;
  document_kind: string;
  starts_at: string | null;
  ends_at: string | null;
};
export type JourneyData = {
  quotes: JourneyQuote[];
  proposals: JourneyProposal[];
  drafts: JourneyDraft[];
  contracts: JourneyContract[];
  access: { quotes: boolean; proposals: boolean; drafts: boolean; contracts: boolean };
  truncated: boolean;
};
export type JourneySelection = ReturnType<typeof selectJourney>;
export function journeyOrigins(d: JourneyData) {
  return [
    ...d.proposals
      .filter((p) => p.status !== "canceled")
      .map((p) => ({ id: `proposal:${p.id}`, label: `${p.title || "Proposta"} · v${p.version}` })),
    ...d.quotes
      .filter((q) => !d.proposals.some((p) => p.quote_id === q.id && p.status !== "canceled"))
      .map((q) => ({ id: `quote:${q.id}`, label: q.title || q.number || "Cotação" })),
    ...d.contracts
      .filter((c) => !c.proposal_id || !d.proposals.some((p) => p.id === c.proposal_id))
      .map((c) => ({
        id: `contract:${c.id}`,
        label: `${c.title || c.number || "Contrato"} · origem histórica/restrita`,
      })),
  ];
}
export function selectJourney(d: JourneyData, origin: string | null) {
  const origins = journeyOrigins(d);
  const chosen = origins.some((o) => o.id === origin) ? origin : (origins[0]?.id ?? null);
  let contract = chosen?.startsWith("contract:")
    ? (d.contracts.find((c) => c.id === chosen.slice(9)) ?? null)
    : null;
  const proposal = chosen?.startsWith("proposal:")
    ? (d.proposals.find((p) => p.id === chosen.slice(9)) ?? null)
    : contract?.proposal_id
      ? (d.proposals.find((p) => p.id === contract!.proposal_id) ?? null)
      : null;
  const quoteId = chosen?.startsWith("quote:")
    ? chosen.slice(6)
    : (proposal?.quote_id ?? contract?.quote_id);
  const quote = d.quotes.find((q) => q.id === quoteId) ?? null;
  const draft = proposal
    ? (d.drafts.find(
        (x) => x.proposal_id === proposal.id && !["canceled", "rejected"].includes(x.status),
      ) ??
      d.drafts.find((x) => x.proposal_id === proposal.id) ??
      null)
    : null;
  const candidates = proposal
    ? d.contracts.filter((c) => c.proposal_id === proposal.id && c.document_kind !== "amendment")
    : [];
  contract = contract ?? candidates[0] ?? null;
  const proposalSigned =
    !!proposal && proposal.status === "accepted" && proposal.locked && !!proposal.decided_at;
  const clausesApproved = !!draft && draft.status === "accepted" && !!draft.client_decided_at;
  const stage =
    contract || clausesApproved
      ? 3
      : proposalSigned
        ? 2
        : proposal
          ? 1
          : quote?.status === "accepted"
            ? 1
            : 0;
  return {
    chosen,
    quote,
    proposal,
    draft,
    contract,
    proposalSigned,
    clausesApproved,
    stage,
    ambiguous: candidates.length > 1,
    historical: !!contract && !proposal,
  };
}
