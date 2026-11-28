import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isValidDraftToken,
  sanitizePublicLinkedProposal,
} from "@/lib/contracts/contract-draft-public-rules";
import type { ProposalDocumentData } from "@/lib/proposals/proposal-document-types";
import { loadProposalDocument } from "@/lib/proposals/proposal-document.server";

export type PublicContractDraftDto = {
  title: string;
  body_html: string;
  status: string;
  workspace_name: string | null;
  client_decided_at: string | null;
  client_name: string | null;
  requires_code?: boolean;
  expires_at?: string;
  attachments?: Array<{ id: string; name: string; sha256: string }>;
  linked_proposal?: ProposalDocumentData | null;
  has_proposal_pdf?: boolean;
  linked_proposal_error?: boolean;
};

type RawPublicContractDraft = {
  title: string;
  body_html: string;
  status: string;
  workspace_name: string | null;
  client_decided_at: string | null;
  client_name: string | null;
  proposal_public_token?: string | null;
  document_audience?: "client" | "supplier";
  requires_code?: boolean;
  expires_at?: string;
  attachments?: Array<{ id: string; name: string; sha256: string }>;
};

export type PublicContractDraftDeps = {
  rpc: (
    fn: "hiring_draft_public" | "contract_draft_public_get",
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  loadProposal: (token: string) => Promise<ProposalDocumentData>;
};

function defaultDeps(sb: SupabaseClient): PublicContractDraftDeps {
  return {
    rpc: (fn, args) => (sb as unknown as { rpc: PublicContractDraftDeps["rpc"] }).rpc(fn, args),
    loadProposal: (token) => loadProposalDocument(sb, { token }),
  };
}

export async function loadPublicContractDraft(
  token: string,
  deps?: PublicContractDraftDeps,
): Promise<PublicContractDraftDto | null> {
  if (!isValidDraftToken(token)) return null;
  const d =
    deps ??
    defaultDeps(
      (await import("@/integrations/supabase/client.server"))
        .supabaseAdmin as unknown as SupabaseClient,
    );

  const hiring = await d.rpc("hiring_draft_public", { token });
  if (hiring.data) {
    const doc = hiring.data as RawPublicContractDraft;
    return {
      title: doc.title,
      body_html: doc.body_html,
      status: doc.status,
      workspace_name: doc.workspace_name,
      client_decided_at: doc.client_decided_at,
      client_name: doc.client_name,
      requires_code: doc.requires_code,
      expires_at: doc.expires_at,
      attachments: doc.attachments?.map(({ id, name, sha256 }) => ({ id, name, sha256 })),
      linked_proposal: null,
      has_proposal_pdf: false,
    };
  }

  const { data: raw, error } = await d.rpc("contract_draft_public_get", { p_token: token });
  if (error) throw new Error("Não foi possível carregar a minuta.");
  if (!raw) return null;

  const doc = raw as RawPublicContractDraft;
  const proposalToken =
    doc.document_audience === "client" &&
    typeof doc.proposal_public_token === "string" &&
    doc.proposal_public_token.length >= 16
      ? doc.proposal_public_token
      : null;

  let linkedProposal: ProposalDocumentData | null = null;
  let linkedProposalError = false;
  if (proposalToken) {
    try {
      const loaded = await d.loadProposal(proposalToken);
      linkedProposal = sanitizePublicLinkedProposal(loaded);
    } catch {
      linkedProposalError = true;
    }
  }

  return {
    title: doc.title,
    body_html: doc.body_html,
    status: doc.status,
    workspace_name: doc.workspace_name,
    client_decided_at: doc.client_decided_at,
    client_name: doc.client_name,
    linked_proposal: linkedProposal,
    has_proposal_pdf: Boolean(linkedProposal && proposalToken),
    ...(linkedProposalError ? { linked_proposal_error: true } : {}),
  };
}

export async function loadPublicContractDraftProposalDoc(
  token: string,
  deps?: PublicContractDraftDeps,
): Promise<ProposalDocumentData | null> {
  if (!isValidDraftToken(token)) return null;
  const d =
    deps ??
    defaultDeps(
      (await import("@/integrations/supabase/client.server"))
        .supabaseAdmin as unknown as SupabaseClient,
    );

  const { data: raw, error } = await d.rpc("contract_draft_public_get", { p_token: token });
  if (error || !raw) return null;

  const doc = raw as RawPublicContractDraft;
  if (
    doc.document_audience !== "client" ||
    typeof doc.proposal_public_token !== "string" ||
    doc.proposal_public_token.length < 16
  ) {
    return null;
  }
  return d.loadProposal(doc.proposal_public_token);
}
