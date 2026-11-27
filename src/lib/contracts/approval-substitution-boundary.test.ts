import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), workspace: vi.fn(), from: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validator: { parse: (input: unknown) => unknown };
    const builder = {
      middleware: () => builder,
      inputValidator: (value: typeof validator) => {
        validator = value;
        return builder;
      },
      handler:
        (fn: (args: { data: unknown; context: unknown }) => unknown) =>
        (args: { data: unknown; context: unknown }) =>
          fn({ ...args, data: validator.parse(args.data) }),
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/access-control/enforce.server", () => ({ getActiveWorkspaceId: mocks.workspace }));
vi.mock("@/lib/access-control/work-core.server", () => ({ workRpc: mocks.rpc }));
import {
  assumeContractApproval,
  getContractApprovalSubstitutionContext,
} from "./approval-substitution.functions";

const contractId = "40000000-1111-4111-8111-111111111111";
const approvalId = "50000000-1111-4111-8111-111111111111";
const expectedApproverId = "60000000-1111-4111-8111-111111111111";
const reason = "Substituição autorizada para continuidade da análise contratual.";
const context = { supabase: { userClient: true, from: mocks.from }, userId: "actual-user" };
const input = { contractId, approvalId, expectedApproverId, reason };
const invoke = (fn: unknown, data: unknown) =>
  Promise.resolve().then(() =>
    (fn as (args: { context: unknown; data: unknown }) => unknown)({ context, data }),
  );
beforeEach(() => {
  vi.clearAllMocks();
  mocks.workspace.mockResolvedValue("active-workspace");
  mocks.rpc.mockResolvedValue({ canAssume: false, approvals: [] });
});
it("assumes only through the authorized user RPC and preserves expected assignee CAS", async () => {
  await invoke(assumeContractApproval, input);
  expect(mocks.workspace).toHaveBeenCalledExactlyOnceWith(context.supabase, context.userId);
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(context.supabase, "contract_approval_assume", {
    p_contract: contractId,
    p_approval: approvalId,
    p_expected_approver: expectedApproverId,
    p_reason: reason,
  });
  expect(mocks.from).not.toHaveBeenCalled();
});
it("context is read through the same active-workspace user boundary", async () => {
  await invoke(getContractApprovalSubstitutionContext, { contractId });
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(
    context.supabase,
    "contract_approval_substitution_context",
    { p_contract: contractId },
  );
});
it.each(["missing capability", "explicit deny", "foreign workspace", "inactive member"])(
  "does not retry as privileged actor or decide on substitution denial: %s",
  async (message) => {
    mocks.rpc.mockRejectedValue(Error(message));
    await expect(invoke(assumeContractApproval, input)).rejects.toThrow(message);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc.mock.calls[0][0]).toBe(context.supabase);
    expect(mocks.rpc.mock.calls[0][1]).toBe("contract_approval_assume");
    expect(mocks.from).not.toHaveBeenCalled();
  },
);
it("requires an active workspace before reading or mutating an approval", async () => {
  mocks.workspace.mockRejectedValue(Error("workspace inactive"));
  await expect(invoke(getContractApprovalSubstitutionContext, { contractId })).rejects.toThrow(
    "workspace inactive",
  );
  await expect(invoke(assumeContractApproval, input)).rejects.toThrow("workspace inactive");
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it.each([
  { actorId: expectedApproverId },
  { decision: "approved" },
  { decidedBy: expectedApproverId },
])(
  "rejects attempts to impersonate a decision maker or approve inside substitution %j",
  async (extra) => {
    await expect(invoke(assumeContractApproval, { ...input, ...extra })).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  },
);
it("requires the original assignee explicitly, accepting null only for an unassigned step", async () => {
  const { expectedApproverId: _, ...missing } = input;
  await expect(invoke(assumeContractApproval, missing)).rejects.toThrow();
  expect(mocks.rpc).not.toHaveBeenCalled();
  await invoke(assumeContractApproval, { ...input, expectedApproverId: null });
  expect(mocks.rpc).toHaveBeenCalledWith(context.supabase, "contract_approval_assume", {
    p_contract: contractId,
    p_approval: approvalId,
    p_expected_approver: null,
    p_reason: reason,
  });
});
it("rejects a missing or excessively long justification before SQL effects", async () => {
  await expect(invoke(assumeContractApproval, { ...input, reason: "   " })).rejects.toThrow();
  await expect(
    invoke(assumeContractApproval, { ...input, reason: "x".repeat(2001) }),
  ).rejects.toThrow();
  expect(mocks.rpc).not.toHaveBeenCalled();
});
