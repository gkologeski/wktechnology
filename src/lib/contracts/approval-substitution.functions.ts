import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import { workRpc } from "@/lib/access-control/work-core.server";

export type ContractApprovalSubstitutionContext = {
  canAssume: boolean;
  approvals: Array<{
    id: string;
    stage: string;
    status: string;
    approverId: string | null;
    approverName: string | null;
    canAssume: boolean;
    currentActorIsApprover: boolean;
    orderBlockedReason: string | null;
  }>;
};

export const getContractApprovalSubstitutionContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ contractId: z.string().uuid() }).strict())
  .handler(async ({ context, data }) => {
    await getActiveWorkspaceId(context.supabase, context.userId);
    return workRpc<ContractApprovalSubstitutionContext>(
      context.supabase,
      "contract_approval_substitution_context",
      { p_contract: data.contractId },
    );
  });

// The RPC takes the real caller as the replacement. It cannot accept an actor,
// decide an approval, or attribute someone else's signature/decision to a manager.
export const assumeContractApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z
      .object({
        contractId: z.string().uuid(),
        approvalId: z.string().uuid(),
        expectedApproverId: z.string().uuid().nullable(),
        reason: z.string().trim().min(10).max(2000),
      })
      .strict(),
  )
  .handler(async ({ context, data }) => {
    await getActiveWorkspaceId(context.supabase, context.userId);
    return workRpc<ContractApprovalSubstitutionContext>(
      context.supabase,
      "contract_approval_assume",
      {
        p_contract: data.contractId,
        p_approval: data.approvalId,
        p_expected_approver: data.expectedApproverId,
        p_reason: data.reason,
      },
    );
  });
