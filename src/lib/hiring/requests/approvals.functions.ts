import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import { workRpc } from "@/lib/access-control/work-core.server";
import { requestKind } from "./types";
import { approvalInput, approvalDecisionInput, type ApprovalContext } from "./approval-types";
export const getPreparationApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z
      .object({
        kind: requestKind,
        id: z.string().uuid(),
        offset: z.number().int().min(0).default(0),
      })
      .strict(),
  )
  .handler(async ({ context, data }) => {
    const ws = await getActiveWorkspaceId(context.supabase, context.userId);
    return workRpc<ApprovalContext>(context.supabase, "hiring_preparation_approval_context", {
      p_ws: ws,
      p_kind: data.kind,
      p_id: data.id,
      p_offset: data.offset,
    });
  });
export const requestPreparationApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(approvalInput)
  .handler(async ({ context, data }) => {
    const ws = await getActiveWorkspaceId(context.supabase, context.userId);
    return workRpc<string>(context.supabase, "hiring_preparation_approval_request", {
      p_ws: ws,
      p_kind: data.kind,
      p_id: data.id,
      p_revision: data.revision,
    });
  });
export const decidePreparationApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(approvalDecisionInput)
  .handler(async ({ context, data }) => {
    const ws = await getActiveWorkspaceId(context.supabase, context.userId);
    return workRpc<string>(context.supabase, "hiring_preparation_approval_decide", {
      p_ws: ws,
      p_kind: data.kind,
      p_id: data.id,
      p_revision: data.revision,
      p_approval: data.approval,
      p_stage: data.stage,
      p_decision: data.decision,
      p_note: data.note,
      p_operation: data.operation,
    });
  });
