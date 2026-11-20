import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { workRpc } from "./access-control/work-core.server";
import { effectiveNotificationRecipients } from "./notification-recipients";
import type { WorkflowAction } from "./workflows/types";
import type { RunCtx } from "./workflows/engine/run-context";

const resultSchema = z.object({
  sent: z.number().int().min(0).max(200),
  // Up to 201 candidates per selector can be counted to detect overflow; none is
  // dispatched when the deduplicated set exceeds 200.
  candidates: z.number().int().min(0).max(2010),
  excluded: z.number().int().min(0).max(2010),
  duplicate: z.number().int().min(0).max(200),
  issues: z.array(z.string().max(100)).max(30),
});
export type NotificationDispatchResult = z.infer<typeof resultSchema>;

export async function dispatchWorkflowNotification(
  client: SupabaseClient,
  action: Extract<WorkflowAction, { type: "send_notification" }>,
  ctx: RunCtx,
): Promise<NotificationDispatchResult> {
  if (!ctx.workflowId || !ctx.runId || ctx.workflowVersion == null || !ctx.notificationStepKey)
    throw new Error("Aviso sem execução, versão ou posição de origem verificável.");
  // The service-only gateway binds these identifiers to actual published workflow/run rows.
  // Never render ctx.after or ctx.vars: those are the executor's data, not the recipient's.
  const raw = await workRpc<unknown>(client, "notification_workflow_dispatch", {
    p_workflow: ctx.workflowId,
    p_run: ctx.runId,
    p_version: ctx.workflowVersion,
    p_entity: ctx.entity,
    p_record: ctx.entityId,
    p_rules: effectiveNotificationRecipients(action),
    p_title: action.title,
    p_body: action.body ?? null,
    p_step: ctx.notificationStepKey,
  });
  const result = resultSchema.parse(raw);
  const suppressed =
    result.issues.length > 0 &&
    result.issues.every((issue) => ["preferences_disabled", "test_mode"].includes(issue));
  if (result.sent === 0 && result.duplicate === 0 && !suppressed) {
    if (result.issues.includes("recipient_limit_exceeded"))
      throw new Error(
        "Notificação bloqueada: limite de 200 destinatários por ação excedido. Reduza o público.",
      );
    if (result.issues.includes("recipient_source_ambiguous"))
      throw new Error(
        "Notificação bloqueada: há mais de um gestor elegível. Revise a alçada da origem.",
      );
    if (result.issues.includes("followers_unavailable"))
      throw new Error(
        "Notificação bloqueada: não há uma fonte de seguidores configurada para o registro.",
      );
    throw new Error(
      "Notificação bloqueada: não há destinatário elegível. Revise os vínculos, a alçada e o acesso à origem.",
    );
  }
  return result;
}
