import { describe, expect, it } from "vitest";
import {
  canBypassClientAcceptance,
  CONTRACT_DRAFT_APPROVE_KEY,
  CONTRACT_DRAFT_BYPASS_KEY,
  contractDraftGate,
} from "./contract-draft-status";

const reviewer = (keys: string[], over: Partial<{ ws: string; active: boolean }> = {}) => ({
  workspaceId: over.ws ?? "w1",
  memberActive: over.active ?? true,
  listedApprover: true,
  keys: new Set(keys),
});

describe("MINUTA-BLOQUEIO", () => {
  it("sem minuta o contrato fica bloqueado", () => {
    expect(contractDraftGate(null)).toBe("missing");
  });
  it("minuta aprovada aguardando cliente bloqueia", () => {
    expect(contractDraftGate({ status: "sent", decided_at: "x", client_decided_at: null })).toBe(
      "awaiting_client",
    );
  });
  it("minuta aguardando Jurídico bloqueia", () => {
    expect(
      contractDraftGate({ status: "pending_legal", decided_at: null, client_decided_at: null }),
    ).toBe("pending_legal");
  });
  it("aceita (ou dispensada) libera", () => {
    expect(contractDraftGate({ status: "accepted", decided_at: "x", client_decided_at: "y" })).toBe(
      "ready",
    );
  });
  const both = [CONTRACT_DRAFT_APPROVE_KEY, CONTRACT_DRAFT_BYPASS_KEY];
  it("dispensa permitida a aprovador com a chave, após o Jurídico", () => {
    expect(canBypassClientAcceptance("sent", "w1", reviewer(both))).toBe(true);
  });
  it("dispensa negada sem a chave, outro workspace, inativo ou sem Jurídico", () => {
    expect(canBypassClientAcceptance("sent", "w1", reviewer([CONTRACT_DRAFT_APPROVE_KEY]))).toBe(false);
    expect(canBypassClientAcceptance("sent", "w1", reviewer(both, { ws: "w2" }))).toBe(false);
    expect(canBypassClientAcceptance("sent", "w1", reviewer(both, { active: false }))).toBe(false);
    expect(canBypassClientAcceptance("pending_legal", "w1", reviewer(both))).toBe(false);
  });
});
