import type { SupabaseClient } from "@supabase/supabase-js";
import { workRpc } from "@/lib/access-control/work-core.server";
import type { RunCtx } from "./run-context";
/** All commercial writes retain current RLS, column ACLs and process guards. */
export async function workflowRecord(
  client: SupabaseClient,
  ctx: RunCtx,
  table: string,
  action: "create" | "update" | "delete",
  id: string | null,
  payload: Record<string, unknown> = {},
) {
  if (!ctx.workflowId) throw new Error("Workflow sem origem de autorização.");
  return workRpc<{ id: string }>(client, "sales_workflow_record", {
    p_workflow: ctx.workflowId,
    p_version: ctx.workflowVersion ?? null,
    p_table: table,
    p_action: action,
    p_id: id,
    p_payload: payload,
  });
}
