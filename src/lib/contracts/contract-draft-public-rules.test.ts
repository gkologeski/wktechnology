import { describe, expect, it } from "vitest";
import {
  clientDraftDecisionError,
  draftSendEmailCopy,
  isProposalEligibleForPublicDraft,
  sanitizePublicLinkedProposal,
} from "./contract-draft-public-rules";
import type { ProposalDocumentData } from "@/lib/proposals/proposal-document-types";

const T = "6f1c2a4e-8b7d-4c3a-9e2f-1a2b3c4d5e6f";
const base = {
  token: T,
  status: "sent",
  decision: "accept" as const,
  name: "Alan Fuentes",
  note: null,
};

describe("contract draft client acceptance", () => {
  it("client draft accepts a sent draft with a valid token and name", () => {
    expect(clientDraftDecisionError(base)).toBeNull();
  });
  it("client draft rejects a malformed token", () => {
    expect(clientDraftDecisionError({ ...base, token: "abc" })).toBe("Link inválido.");
  });
  it("client draft rejects an unknown token", () => {
    expect(clientDraftDecisionError({ ...base, status: null })).toBe("Minuta não encontrada.");
  });
  it("client draft rejects a draft not yet sent or already answered", () => {
    expect(clientDraftDecisionError({ ...base, status: "approved" })).toBe(
      "Esta minuta já foi respondida.",
    );
    expect(clientDraftDecisionError({ ...base, status: "accepted" })).toBe(
      "Esta minuta já foi respondida.",
    );
  });
  it("client draft requires a reason when asking for changes", () => {
    expect(clientDraftDecisionError({ ...base, decision: "changes", note: "ok" })).toBe(
      "Descreva os ajustes desejados.",
    );
    expect(
      clientDraftDecisionError({ ...base, decision: "changes", note: "Ajustar multa" }),
    ).toBeNull();
  });

  it("identifies only locked sent/accepted/rejected proposals with sent_at as eligible", () => {
    expect(
      isProposalEligibleForPublicDraft({
        status: "accepted",
        locked: true,
        sent_at: "2026-11-25T10:00:00Z",
      }),
    ).toBe(true);
    expect(
      isProposalEligibleForPublicDraft({
        status: "sent",
        locked: true,
        sent_at: "2026-11-25T10:00:00Z",
      }),
    ).toBe(true);
    expect(
      isProposalEligibleForPublicDraft({
        status: "draft",
        locked: false,
        sent_at: null,
      }),
    ).toBe(false);
    expect(
      isProposalEligibleForPublicDraft({
        status: "accepted",
        locked: false,
        sent_at: "2026-11-25T10:00:00Z",
      }),
    ).toBe(false);
    expect(
      isProposalEligibleForPublicDraft({
        status: "accepted",
        locked: true,
        sent_at: null,
      }),
    ).toBe(false);
  });

  it("strips internal identifiers and public_token from linked proposal document", () => {
    const raw: ProposalDocumentData = {
      proposal: {
        id: "e45a43d1-ba91-4add-b8e9-62c3dfe81787",
        title: "CT/Brooks/Sergio/Suporte 18 horas",
        body: "<p>Escopo</p>",
        status: "accepted",
        locked: true,
        version: 2,
        total_amount: 3600,
        currency: "BRL",
        expires_at: null,
        sent_at: "2026-11-20T12:00:00Z",
        decided_at: "2026-11-21T15:00:00Z",
        created_at: "2026-11-20T11:00:00Z",
        public_token: "secret-proposal-token-1234567890",
        deal_id: "7f92d45c-c3c3-4858-907a-9859f4c708aa",
        quote_id: "11111111-2222-3333-4444-555555555555",
      },
      items: [
        { id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", name: "Suporte 18h", billing: "R$ 3.600,00" },
      ],
      company: "BROOKS LTDA",
      contact: "Sergio",
      contactEmail: "sergio@brooks.com.br",
      agent: "Guilherme",
      visualHtml: '<div class="vp-deck"></div>',
      visualOrientation: "portrait",
    };
    const clean = sanitizePublicLinkedProposal(raw);
    expect(clean.proposal.id).toBe("");
    expect(clean.proposal.public_token).toBeNull();
    expect(clean.proposal.deal_id).toBeNull();
    expect(clean.proposal.quote_id).toBeNull();
    expect(clean.items[0]?.id).toBe("item-1");
    expect(clean.proposal.title).toBe("CT/Brooks/Sergio/Suporte 18 horas");
    expect(clean.proposal.total_amount).toBe(3600);
    expect(clean.visualHtml).toBe('<div class="vp-deck"></div>');
  });

  it("builds client email copy mentioning the linked proposal when present", () => {
    const withProp = draftSendEmailCopy({
      title: "Minuta — Brooks",
      hasLinkedProposal: true,
      linkedProposalTitle: "CT/Brooks/Sergio/Suporte 18 horas",
    });
    expect(withProp.message).toContain("acompanhada da proposta comercial vinculada");
    expect(withProp.message).toContain("CT/Brooks/Sergio/Suporte 18 horas");
    expect(withProp.linkLabel).toBe("Abrir a minuta do contrato e a proposta comercial");

    const withoutProp = draftSendEmailCopy({
      title: "Minuta avulsa",
      hasLinkedProposal: false,
    });
    expect(withoutProp.message).not.toContain("proposta comercial vinculada");
    expect(withoutProp.linkLabel).toBe("Abrir a minuta do contrato");
  });
});
