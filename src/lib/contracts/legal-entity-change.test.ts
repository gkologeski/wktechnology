import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Pure guard mirroring the server/SQL boundaries for changing the WK legal entity
 * on editable quotes, proposals, contract drafts, and contracts.
 */
type Actor = {
  workspaceId: string;
  memberActive: boolean;
  readOnly?: boolean;
  listedApprover?: boolean;
  keys: Set<string>;
};

function canChangeLegalEntityOnDraft(
  draft: { workspace_id: string; status: string },
  actor: Actor,
): boolean {
  if (!actor.memberActive || actor.readOnly) return false;
  if (draft.workspace_id !== actor.workspaceId) return false;
  if (!actor.listedApprover) return false;
  if (!actor.keys.has("techcontracts.contract_drafts.approve.workspace")) return false;
  return draft.status === "pending_legal" || draft.status === "changes_requested";
}

function canChangeLegalEntityOnContract(
  contract: {
    workspace_id: string;
    status: string;
    signed_at: string | null;
    hasAcceptedDraft: boolean;
  },
  actor: Actor,
): boolean {
  if (!actor.memberActive || actor.readOnly) return false;
  if (contract.workspace_id !== actor.workspaceId) return false;
  if (
    !actor.keys.has("techcontracts.contracts.update.workspace") &&
    !actor.keys.has("techcontracts.contracts.update.team") &&
    !actor.keys.has("techcontracts.contracts.update.own")
  )
    return false;
  if (contract.signed_at !== null || contract.hasAcceptedDraft) return false;
  return ["draft", "in_review", "in_negotiation"].includes(contract.status);
}

describe("legal entity change authorization and immutability boundaries", () => {
  const okDraft = { workspace_id: "w1", status: "pending_legal" };
  const okContract = {
    workspace_id: "w1",
    status: "draft",
    signed_at: null,
    hasAcceptedDraft: false,
  };

  it("legal entity change allows authorized active member in same workspace", () => {
    const approver: Actor = {
      workspaceId: "w1",
      memberActive: true,
      listedApprover: true,
      keys: new Set([
        "techcontracts.contract_drafts.approve.workspace",
        "techcontracts.contracts.update.workspace",
      ]),
    };
    expect(canChangeLegalEntityOnDraft(okDraft, approver)).toBe(true);
    expect(canChangeLegalEntityOnContract(okContract, approver)).toBe(true);
  });

  it("legal entity change rejects missing permission", () => {
    const viewerOnly: Actor = {
      workspaceId: "w1",
      memberActive: true,
      listedApprover: true,
      keys: new Set([
        "techcontracts.contract_drafts.view.workspace",
        "techcontracts.contracts.view.workspace",
      ]),
    };
    expect(canChangeLegalEntityOnDraft(okDraft, viewerOnly)).toBe(false);
    expect(canChangeLegalEntityOnContract(okContract, viewerOnly)).toBe(false);
  });

  it("legal entity change respects explicit deny (key absent from effective set)", () => {
    const denied: Actor = {
      workspaceId: "w1",
      memberActive: true,
      listedApprover: false,
      keys: new Set(["techcontracts.contract_drafts.approve.workspace"]),
    };
    expect(canChangeLegalEntityOnDraft(okDraft, denied)).toBe(false);
    expect(
      canChangeLegalEntityOnContract(okContract, {
        workspaceId: "w1",
        memberActive: true,
        keys: new Set([]),
      }),
    ).toBe(false);
  });

  it("legal entity change rejects foreign workspace", () => {
    const foreign: Actor = {
      workspaceId: "w2",
      memberActive: true,
      listedApprover: true,
      keys: new Set([
        "techcontracts.contract_drafts.approve.workspace",
        "techcontracts.contracts.update.workspace",
      ]),
    };
    expect(canChangeLegalEntityOnDraft(okDraft, foreign)).toBe(false);
    expect(canChangeLegalEntityOnContract(okContract, foreign)).toBe(false);
  });

  it("legal entity change rejects inactive membership and read-only view", () => {
    const inactive: Actor = {
      workspaceId: "w1",
      memberActive: false,
      listedApprover: true,
      keys: new Set([
        "techcontracts.contract_drafts.approve.workspace",
        "techcontracts.contracts.update.workspace",
      ]),
    };
    expect(canChangeLegalEntityOnDraft(okDraft, inactive)).toBe(false);
    expect(canChangeLegalEntityOnContract(okContract, inactive)).toBe(false);
    expect(
      canChangeLegalEntityOnContract(okContract, {
        ...inactive,
        memberActive: true,
        readOnly: true,
      }),
    ).toBe(false);
  });

  it("blocks edits on decided drafts, signed contracts, and contracts locked by an accepted draft", () => {
    const approver: Actor = {
      workspaceId: "w1",
      memberActive: true,
      listedApprover: true,
      keys: new Set([
        "techcontracts.contract_drafts.approve.workspace",
        "techcontracts.contracts.update.workspace",
      ]),
    };
    expect(canChangeLegalEntityOnDraft({ workspace_id: "w1", status: "accepted" }, approver)).toBe(
      false,
    );
    expect(canChangeLegalEntityOnDraft({ workspace_id: "w1", status: "sent" }, approver)).toBe(
      false,
    );
    expect(canChangeLegalEntityOnContract({ ...okContract, status: "active" }, approver)).toBe(
      false,
    );
    expect(
      canChangeLegalEntityOnContract(
        { ...okContract, signed_at: "2026-11-24T12:00:00Z" },
        approver,
      ),
    ).toBe(false);
    expect(
      canChangeLegalEntityOnContract({ ...okContract, hasAcceptedDraft: true }, approver),
    ).toBe(false);
  });

  it("SQL migrations enforce authorization, immutability, and REVOKE FROM PUBLIC/anon", () => {
    const m470 = readFileSync(
      "drizzle/migrations/0470_legal_entity_merge_and_edit_everywhere.sql",
      "utf8",
    );
    const m471 = readFileSync(
      "drizzle/migrations/0471_contract_draft_open_and_proposal_entity_guard.sql",
      "utf8",
    );
    expect(m470).toContain(
      "REVOKE ALL ON FUNCTION public.contract_draft_set_legal_entity(uuid, uuid) FROM PUBLIC, anon;",
    );
    expect(m470).toContain(
      "REVOKE ALL ON FUNCTION public.contract_set_legal_entity(uuid, uuid) FROM PUBLIC, anon;",
    );
    expect(m470).toContain("work_area_authorize('techcontracts.contracts', 'update', p_contract)");
    expect(m470).toContain("contract_draft_is_approver(d.workspace_id, auth.uid())");
    expect(m470).toContain(
      "OLD.status::text='accepted' AND NEW.legal_entity_id IS DISTINCT FROM OLD.legal_entity_id",
    );
    expect(m471).toContain(
      "INSERT INTO contract_drafts(workspace_id,deal_id,proposal_id,template_id,legal_entity_id",
    );
    expect(m471).toContain("NEW.legal_entity_id");
  });
});
