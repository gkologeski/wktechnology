import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireWorkspaceContext } from "@/lib/access-control/active-workspace.middleware";
import { workRpc } from "@/lib/access-control/work-core.server";
import { assertSalesArea, assertSalesRecord } from "@/lib/access-control/sales-core.server";
import { assertNotificationWorkspace } from "@/lib/notification-center";
import { SaveSchema } from "@/lib/workflows/schemas";
import { deliveryWorkspaceInput } from "./delivery-api";
import { inspectNotificationActions } from "./delivery-rule-preview";
import { notificationDeliveryPolicySchema } from "./delivery-types";
import { notificationDeliveryCapabilities } from "./delivery-access.server";

import type { Json } from "@/integrations/supabase/types";
const jsonValue: z.ZodType<Json> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValue), z.record(jsonValue)]),
);
const ruleRow = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    entity: z.string(),
    enabled: z.boolean(),
    status: z.string(),
    published_version: z.number(),
    trigger: jsonValue,
    actions: z.array(jsonValue),
    draft_trigger: jsonValue.nullable(),
    draft_actions: z.array(jsonValue).nullable(),
    goal_filters: jsonValue.optional(),
    draft_goal_filters: jsonValue.optional(),
    updated_at: z.string().optional(),
  })
  .transform((row) => {
    const draftActions = row.draft_actions ?? row.actions;
    const draftTrigger = row.draft_trigger ?? row.trigger;
    const draftGoal = row.draft_goal_filters ?? row.goal_filters;
    return {
      ...row,
      draft_actions: draftActions,
      draft_trigger: draftTrigger,
      draft_goal_filters: draftGoal,
      has_draft_changes:
        JSON.stringify(draftActions ?? []) !== JSON.stringify(row.actions ?? []) ||
        JSON.stringify(draftTrigger ?? {}) !== JSON.stringify(row.trigger ?? {}) ||
        JSON.stringify(draftGoal ?? []) !== JSON.stringify(row.goal_filters ?? []),
    };
  });
export const listNotificationWorkflowRules = createServerFn({ method: "POST" })
  .middleware([requireWorkspaceContext()])
  .inputValidator((input) => deliveryWorkspaceInput.parse(input))
  .handler(async ({ context, data }) => {
    assertNotificationWorkspace(context, data.workspaceId);
    await assertSalesArea(context.supabase, "system.workflows", "view");
    return z.object({ items: z.array(ruleRow).max(100), truncated: z.boolean() }).parse(
      await workRpc(context.supabase, "notification_delivery_rules", {
        p_workspace: data.workspaceId,
      }),
    );
  });
export const previewNotificationWorkflow = createServerFn({ method: "POST" })
  .middleware([requireWorkspaceContext()])
  .inputValidator((input) =>
    deliveryWorkspaceInput.extend({ workflowId: z.string().uuid() }).strict().parse(input),
  )
  .handler(async ({ context, data }) => {
    assertNotificationWorkspace(context, data.workspaceId);
    await assertSalesArea(context.supabase, "system.workflows", "view");
    await assertSalesRecord(context.supabase, "workflows", data.workflowId, "view");
    const { data: row, error } = await context.supabase
      .from("workflows")
      .select(
        "id,name,entity,enabled,trigger,actions,draft_trigger,draft_actions,goal_filters,draft_goal_filters",
      )
      .eq("workspace_id", data.workspaceId)
      .eq("id", data.workflowId)
      .maybeSingle();
    if (error || !row) throw Error("Regra indisponível neste workspace.");
    const parsed = SaveSchema.safeParse({
      ...row,
      trigger: {
        ...((row.draft_trigger ?? row.trigger) as object),
        goal_filters: row.draft_goal_filters ?? row.goal_filters ?? [],
      },
      actions: row.draft_actions ?? row.actions,
    });
    if (!parsed.success)
      return {
        notificationSteps: 0,
        channels: [] as string[],
        issues: ["Há campos incompletos na regra. Revise e salve o rascunho."],
        realMessages: 0 as const,
      };
    const caps = await notificationDeliveryCapabilities(context.supabase, data.workspaceId);
    const raw = caps.settingsView
      ? await workRpc<{ policy: unknown }>(context.supabase, "notification_delivery_settings", {
          p_workspace: data.workspaceId,
        })
      : null;
    const policy = raw ? notificationDeliveryPolicySchema.parse(raw.policy) : null;
    return inspectNotificationActions(parsed.data.actions, policy);
  });
