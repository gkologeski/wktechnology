import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { workRpc } from "@/lib/access-control/work-core.server";
import type { RunCtx } from "@/lib/workflows/engine/run-context";
import type { WorkflowAction } from "@/lib/workflows/types";

const dispatchResult = z.object({
  result: z.enum(["queued", "duplicate", "suppressed"]),
  deliveryId: z.string().uuid().optional(),
  reason: z.string().max(80).optional(),
});

/** Enqueue one collective occurrence; the database proves the published step and source. */
export async function dispatchWorkflowSlack(
  client: SupabaseClient,
  action: Extract<WorkflowAction, { type: "send_slack" }>,
  ctx: RunCtx,
) {
  if (!ctx.workflowId || !ctx.runId || ctx.workflowVersion == null || !ctx.notificationStepKey)
    throw Error("Aviso Slack sem execução ou posição de origem verificável.");
  if (action.channel?.trim())
    throw Error(
      "Incoming Webhook tem canal fixo. Remova o canal antigo e revise a política Slack.",
    );
  // Legacy text stays in the draft for review. It never becomes external content.
  return dispatchResult.parse(
    await workRpc(client, "notification_workflow_slack_dispatch", {
      p_workspace: ctx.workspaceId,
      p_workflow: ctx.workflowId,
      p_run: ctx.runId,
      p_step_path: ctx.notificationStepKey,
      p_version: ctx.workflowVersion,
    }),
  );
}
