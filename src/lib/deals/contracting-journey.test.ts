import { describe, expect, it } from "vitest";
import { journeyOrigins, selectJourney, type JourneyData } from "./contracting-journey";
const q = {
  id: "q",
  title: "Cotação",
  status: "accepted",
  created_at: "2026-11-14",
  number: "Q1",
  total: 100,
  currency: "BRL",
};
const p = {
  id: "p",
  title: "Proposta",
  status: "accepted",
  created_at: "2026-11-14",
  quote_id: "q",
  version: 1,
  locked: true,
  decided_at: "2026-11-14",
  total_amount: 100,
  currency: "BRL",
  legal_entity_id: "l",
};
const draft = {
  id: "d",
  title: "Minuta",
  status: "sent",
  created_at: "2026-11-14",
  proposal_id: "p",
  revision: 1,
  client_decided_at: null,
  client_note: null,
  missing_template: false,
};
const contract = {
  id: "c",
  title: "Contrato",
  status: "draft",
  created_at: "2026-11-14",
  proposal_id: "p",
  quote_id: "q",
  number: "C1",
  document_kind: "main",
  starts_at: null,
  ends_at: null,
};
const data = (): JourneyData => ({
  quotes: [q],
  proposals: [p],
  drafts: [draft],
  contracts: [],
  access: { quotes: true, proposals: true, drafts: true, contracts: true },
  truncated: false,
});
describe("deal contracting journey lineage", () => {
  it("keeps the quote in the proposal origin instead of duplicating a journey", () =>
    expect(journeyOrigins(data()).map((x) => x.id)).toEqual(["proposal:p"]));
  it("never mixes the latest draft of another proposal", () => {
    const d = data();
    d.drafts.unshift({
      ...draft,
      id: "other",
      proposal_id: "other",
      status: "accepted",
      client_decided_at: "2026-11-14",
    });
    expect(selectJourney(d, null).clausesApproved).toBe(false);
  });
  it("does not treat accepted without a locked signature/decision as signed", () => {
    const d = data();
    d.proposals[0] = { ...p, locked: false };
    expect(selectJourney(d, null).proposalSigned).toBe(false);
  });
  it("requires a client decision for approved clauses", () => {
    const d = data();
    d.drafts[0] = { ...draft, status: "accepted" };
    expect(selectJourney(d, null).clausesApproved).toBe(false);
  });
  it("routes accepted clauses to Finance before a contract exists", () => {
    const d = data();
    d.drafts[0] = { ...draft, status: "accepted", client_decided_at: "2026-11-14" };
    expect(selectJourney(d, null).stage).toBe(3);
  });
  it("changes requested remain at the legal/client stage", () => {
    const d = data();
    d.drafts[0] = { ...draft, status: "changes_requested", revision: 3 };
    expect(selectJourney(d, null).stage).toBe(2);
  });
  it("never assumes active status is evidence of signature", () => {
    const d = data();
    d.contracts = [{ ...contract, status: "active" }];
    expect(selectJourney(d, null).stage).toBe(3);
  });
  it("does not select an amendment as the main contract", () => {
    const d = data();
    d.contracts = [{ ...contract, document_kind: "amendment" }];
    expect(selectJourney(d, null).contract).toBeNull();
  });
  it("flags multiple principal contracts instead of assuming signature is sufficient", () => {
    const d = data();
    d.contracts = [contract, { ...contract, id: "second" }];
    expect(selectJourney(d, null).ambiguous).toBe(true);
  });
  it("keeps historical contracts without inventing a commercial signature", () => {
    const d = data();
    d.proposals = [];
    d.contracts = [{ ...contract, proposal_id: null }];
    const j = selectJourney(d, "contract:c");
    expect(j.historical).toBe(true);
    expect(j.proposalSigned).toBe(false);
  });
  it("resolves a disappeared selection to an available origin", () =>
    expect(selectJourney(data(), "proposal:gone").chosen).toBe("proposal:p"));
  it("does not hide an independent quote or join it to the wrong proposal", () => {
    const d = data();
    d.quotes.push({ ...q, id: "q2" });
    expect(selectJourney(d, "quote:q2").proposal).toBeNull();
  });
});
