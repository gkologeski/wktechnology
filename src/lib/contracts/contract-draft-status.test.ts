import { describe, expect, it } from "vitest";
import {
  CONTRACT_DRAFT_APPROVE_KEY,
  canReviewContractDraft,
  contractDraftHasText,
  isContractDraftReviewable,
} from "./contract-draft-status";

const WS = "11111111-1111-1111-1111-111111111111";
const base = {
  workspaceId: WS,
  memberActive: true,
  listedApprover: true,
  keys: new Set([CONTRACT_DRAFT_APPROVE_KEY]),
};

describe("revisão jurídica da minuta", () => {
  it("contract draft review permits a listed active approver", () => {
    expect(canReviewContractDraft(WS, base)).toBe(true);
  });
  it("contract draft review rejects missing permission", () => {
    expect(canReviewContractDraft(WS, { ...base, keys: new Set() })).toBe(false);
  });
  it("contract draft review rejects explicit deny", () => {
    // deny remove a chave das permissões efetivas
    const effective = new Set([CONTRACT_DRAFT_APPROVE_KEY]);
    effective.delete(CONTRACT_DRAFT_APPROVE_KEY);
    expect(canReviewContractDraft(WS, { ...base, keys: effective })).toBe(false);
  });
  it("contract draft review rejects a foreign workspace", () => {
    expect(canReviewContractDraft("22222222-2222-2222-2222-222222222222", base)).toBe(false);
  });
  it("contract draft review rejects inactive membership", () => {
    expect(canReviewContractDraft(WS, { ...base, memberActive: false })).toBe(false);
  });
  it("contract draft review rejects a member not listed as approver", () => {
    expect(canReviewContractDraft(WS, { ...base, listedApprover: false })).toBe(false);
  });
  it("only pending drafts are reviewable", () => {
    expect(isContractDraftReviewable("pending_legal")).toBe(true);
    expect(isContractDraftReviewable("changes_requested")).toBe(true);
    expect(isContractDraftReviewable("approved")).toBe(false);
    expect(isContractDraftReviewable("rejected")).toBe(false);
  });
  it("approval needs at least 20 visible characters", () => {
    expect(contractDraftHasText("<p>curto</p>")).toBe(false);
    expect(contractDraftHasText("<p>Cláusula primeira — do objeto do contrato.</p>")).toBe(true);
  });
});
