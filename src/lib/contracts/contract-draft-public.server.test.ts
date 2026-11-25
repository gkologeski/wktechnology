import { describe, expect, it, vi } from "vitest";
import {
  loadPublicContractDraft,
  loadPublicContractDraftProposalDoc,
  type PublicContractDraftDeps,
} from "./contract-draft-public.server";
import type { ProposalDocumentData } from "@/lib/proposals/proposal-document-types";

const VALID_TOKEN = "6f1c2a4e-8b7d-4c3a-9e2f-1a2b3c4d5e6f";
const PROPOSAL_TOKEN = "abcdef1234567890abcdef1234567890";

const sampleProposal: ProposalDocumentData = {
  proposal: {
    id: "e45a43d1-ba91-4add-b8e9-62c3dfe81787",
    title: "CT/Brooks/Sergio/Suporte 18 horas",
    body: "<p>Escopo de 18 horas</p>",
    status: "accepted",
    locked: true,
    version: 2,
    total_amount: 3600,
    currency: "BRL",
    expires_at: null,
    sent_at: "2026-11-20T12:00:00Z",
    decided_at: "2026-11-21T15:00:00Z",
    created_at: "2026-11-20T11:00:00Z",
    public_token: PROPOSAL_TOKEN,
    deal_id: "7f92d45c-c3c3-4858-907a-9859f4c708aa",
    quote_id: null,
  },
  items: [
    { id: "11111111-1111-1111-1111-111111111111", name: "Suporte 18h", billing: "R$ 3.600,00" },
  ],
  company: "BROOKS LTDA",
  contact: "Sergio",
  contactEmail: "sergio@brooks.com.br",
  agent: "Guilherme",
};

describe("loadPublicContractDraft (linked commercial proposal)", () => {
  it("loads and sanitizes the linked proposal without exposing internal ids or proposal token", async () => {
    const deps: PublicContractDraftDeps = {
      rpc: vi.fn(async (fn) => {
        if (fn === "hiring_draft_public") return { data: null, error: null };
        return {
          data: {
            title: "Minuta — CT/Brooks/Sergio/Suporte 18 horas",
            body_html: "<p>Cláusula 1</p>",
            status: "sent",
            workspace_name: "WK Technology",
            client_decided_at: null,
            client_name: null,
            proposal_public_token: PROPOSAL_TOKEN,
          },
          error: null,
        };
      }),
      loadProposal: vi.fn(async () => sampleProposal),
    };

    const res = await loadPublicContractDraft(VALID_TOKEN, deps);
    expect(res).not.toBeNull();
    expect(res?.has_proposal_pdf).toBe(true);
    expect(res?.linked_proposal?.proposal.title).toBe("CT/Brooks/Sergio/Suporte 18 horas");
    expect(res?.linked_proposal?.proposal.id).toBe("");
    expect(res?.linked_proposal?.proposal.public_token).toBeNull();
    expect(res?.linked_proposal?.proposal.deal_id).toBeNull();
    expect(res?.linked_proposal?.items[0]?.id).toBe("item-1");
    expect("proposal_public_token" in (res as Record<string, unknown>)).toBe(false);
  });

  it("keeps the draft readable when the linked proposal fails to load", async () => {
    const deps: PublicContractDraftDeps = {
      rpc: vi.fn(async (fn) => {
        if (fn === "hiring_draft_public") return { data: null, error: null };
        return {
          data: {
            title: "Minuta — Brooks",
            body_html: "<p>Cláusula 1</p>",
            status: "sent",
            workspace_name: "WK Technology",
            client_decided_at: null,
            client_name: null,
            proposal_public_token: PROPOSAL_TOKEN,
          },
          error: null,
        };
      }),
      loadProposal: vi.fn(async () => {
        throw new Error("Proposta indisponível");
      }),
    };

    const res = await loadPublicContractDraft(VALID_TOKEN, deps);
    expect(res?.title).toBe("Minuta — Brooks");
    expect(res?.linked_proposal).toBeNull();
    expect(res?.has_proposal_pdf).toBe(false);
    expect(res?.linked_proposal_error).toBe(true);
  });

  it("returns null linked_proposal when draft has no eligible proposal", async () => {
    const deps: PublicContractDraftDeps = {
      rpc: vi.fn(async (fn) => {
        if (fn === "hiring_draft_public") return { data: null, error: null };
        return {
          data: {
            title: "Minuta avulsa",
            body_html: "<p>Cláusula 1</p>",
            status: "sent",
            workspace_name: "WK Technology",
            client_decided_at: null,
            client_name: null,
            proposal_public_token: null,
          },
          error: null,
        };
      }),
      loadProposal: vi.fn(),
    };

    const res = await loadPublicContractDraft(VALID_TOKEN, deps);
    expect(res?.linked_proposal).toBeNull();
    expect(res?.has_proposal_pdf).toBe(false);
    expect(deps.loadProposal).not.toHaveBeenCalled();
  });

  it("rejects malformed or revoked tokens for both page and proposal PDF", async () => {
    const deps: PublicContractDraftDeps = {
      rpc: vi.fn(async () => ({ data: null, error: null })),
      loadProposal: vi.fn(),
    };

    expect(await loadPublicContractDraft("not-a-uuid", deps)).toBeNull();
    expect(await loadPublicContractDraftProposalDoc("not-a-uuid", deps)).toBeNull();
    expect(deps.rpc).not.toHaveBeenCalled();

    expect(await loadPublicContractDraft(VALID_TOKEN, deps)).toBeNull();
    expect(await loadPublicContractDraftProposalDoc(VALID_TOKEN, deps)).toBeNull();
  });

  it("returns proposal document for PDF download when draft token is valid and linked", async () => {
    const deps: PublicContractDraftDeps = {
      rpc: vi.fn(async () => ({
        data: {
          title: "Minuta — Brooks",
          body_html: "<p>Cláusula 1</p>",
          status: "sent",
          workspace_name: "WK Technology",
          client_decided_at: null,
          client_name: null,
          proposal_public_token: PROPOSAL_TOKEN,
        },
        error: null,
      })),
      loadProposal: vi.fn(async (tok) => {
        expect(tok).toBe(PROPOSAL_TOKEN);
        return sampleProposal;
      }),
    };

    const doc = await loadPublicContractDraftProposalDoc(VALID_TOKEN, deps);
    expect(doc?.proposal.title).toBe("CT/Brooks/Sergio/Suporte 18 horas");
  });
});
