// ACEITE-MINUTA Entrega 3: regra pura da resposta do cliente (espelho do RPC
// contract_draft_public_decide; a decisão real é no banco).
import type { ProposalDocumentData } from "@/lib/proposals/proposal-document-types";

export type ClientDecision = "accept" | "changes";

const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidDraftToken(token: string): boolean {
  return TOKEN_RE.test(token);
}

export function clientDraftDecisionError(input: {
  token: string;
  status: string | null;
  decision: ClientDecision;
  name: string;
  note: string | null;
}): string | null {
  if (!TOKEN_RE.test(input.token)) return "Link inválido.";
  if (input.status == null) return "Minuta não encontrada.";
  if (input.status !== "sent") return "Esta minuta já foi respondida.";
  if (input.name.trim().length < 3) return "Informe seu nome.";
  if (input.decision === "changes" && (input.note ?? "").trim().length < 5)
    return "Descreva os ajustes desejados.";
  return null;
}

/** Espelho puro da elegibilidade da proposta vinculada na minuta pública (SQL valida de verdade). */
export function isProposalEligibleForPublicDraft(
  proposal:
    | { status?: string | null; locked?: boolean | null; sent_at?: string | null }
    | null
    | undefined,
): boolean {
  if (!proposal) return false;
  const status = proposal.status ?? "";
  return (
    (status === "sent" || status === "accepted" || status === "rejected") &&
    proposal.locked === true &&
    Boolean(proposal.sent_at)
  );
}

/** Remove identificadores internos e token da proposta antes de devolvê-la na página da minuta. */
export function sanitizePublicLinkedProposal(doc: ProposalDocumentData): ProposalDocumentData {
  return {
    proposal: {
      id: "",
      title: doc.proposal.title,
      body: doc.proposal.body,
      status: doc.proposal.status,
      locked: doc.proposal.locked,
      version: doc.proposal.version,
      total_amount: doc.proposal.total_amount,
      currency: doc.proposal.currency,
      expires_at: doc.proposal.expires_at,
      sent_at: doc.proposal.sent_at,
      decided_at: doc.proposal.decided_at,
      created_at: doc.proposal.created_at,
      public_token: null,
      deal_id: null,
      quote_id: null,
    },
    items: doc.items.map((item, index) => ({
      id: `item-${index + 1}`,
      name: item.name,
      billing: item.billing,
    })),
    company: doc.company,
    contact: doc.contact,
    contactEmail: doc.contactEmail,
    agent: doc.agent,
    ...(doc.visualHtml !== undefined ? { visualHtml: doc.visualHtml } : {}),
    ...(doc.visualOrientation !== undefined ? { visualOrientation: doc.visualOrientation } : {}),
  };
}

/** Textos padrão do envio da minuta ao cliente (e-mail e diálogo). */
export function draftSendEmailCopy(input: {
  title: string;
  hasLinkedProposal: boolean;
  linkedProposalTitle?: string | null;
}): {
  subject: string;
  message: string;
  linkLabel: string;
  dialogDescription: string;
  copiedToast: string;
} {
  if (input.hasLinkedProposal) {
    const ref = input.linkedProposalTitle?.trim() ? ` (${input.linkedProposalTitle.trim()})` : "";
    return {
      subject: `Minuta de contrato — ${input.title}`,
      message: `Olá,\n\nSegue a minuta do contrato acompanhada da proposta comercial vinculada${ref} para sua análise. Pelo link abaixo você confere ambos os documentos e pode aceitar a minuta ou pedir ajustes.`,
      linkLabel: "Abrir a minuta do contrato e a proposta comercial",
      dialogDescription:
        "O cliente recebe um link com a minuta e a proposta comercial vinculada para aceitar ou pedir ajustes.",
      copiedToast:
        "Link copiado (inclui a minuta e a proposta comercial vinculada). A minuta foi marcada como enviada.",
    };
  }
  return {
    subject: `Minuta de contrato — ${input.title}`,
    message:
      "Olá,\n\nSegue a minuta do contrato para sua análise. Pelo link abaixo você pode aceitar a minuta ou pedir ajustes.",
    linkLabel: "Abrir a minuta do contrato",
    dialogDescription: "O cliente recebe um link para aceitar a minuta ou pedir ajustes.",
    copiedToast: "Link copiado. A minuta foi marcada como enviada.",
  };
}
