import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { assertSalesArea, assertSalesRecord } from "@/lib/access-control/sales-core.server";
import { workRpc } from "@/lib/access-control/work-core.server";
import {
  assertNotificationDeliverySettings,
  assertNotificationTemplateAccess,
} from "./delivery-access.server";
import { deliveryPolicyResult } from "./delivery-api";
import {
  notificationSlackSettingsSchema,
  type NotificationDeliveryPolicy,
  type NotificationDeliveryCapabilities,
} from "./delivery-types";
import {
  notificationReadinessInputSchema,
  notificationReadinessWorkflowsInputSchema,
  notificationReadinessWorkflowsSchema,
} from "./readiness-types";
import {
  buildNotificationReadiness,
  type ReadinessDependency,
  type ReadinessSlack,
} from "./readiness-model";

const workflowSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  name: z.string(),
  entity: z.string(),
  enabled: z.boolean(),
  status: z.enum(["draft", "published", "archived"]),
  published_version: z.number().int().min(0),
  trigger: z.unknown(),
  actions: z.unknown(),
  goal_filters: z.unknown().optional(),
});

/** Minimal selector metadata only. Row RLS, not a JSON scan, determines visible Workflows. */
export async function loadNotificationReadinessWorkflows(
  client: SupabaseClient,
  workspaceId: string,
) {
  notificationReadinessWorkflowsInputSchema.parse({ workspaceId });
  try {
    await assertNotificationDeliverySettings(client, workspaceId);
    await assertSalesArea(client, "system.workflows", "view");
  } catch {
    throw Error("Sem permissão para conferir regras neste workspace.");
  }
  try {
    const result = await client
      .from("workflows")
      .select("id,name,status,enabled,published_version")
      .eq("workspace_id", workspaceId)
      .order("name", { ascending: true })
      .order("id", { ascending: true })
      .limit(101);
    if (result.error) throw Error("Workflow selector read failed");
    const rows = z
      .array(
        workflowSchema.pick({
          id: true,
          name: true,
          status: true,
          enabled: true,
          published_version: true,
        }),
      )
      .max(101)
      .parse(result.data);
    return notificationReadinessWorkflowsSchema.parse({
      items: rows.slice(0, 100).map((row) => ({
        id: row.id,
        name: row.name,
        status: row.status,
        enabled: row.enabled,
        publishedVersion: row.published_version,
      })),
      truncated: rows.length > 100,
    });
  } catch {
    throw Error("Não foi possível consultar as regras para conferência neste workspace.");
  }
}

/** Authenticated client only. Existing gateways and row RLS authorize every read. */
export async function loadNotificationReadiness(
  client: SupabaseClient,
  workspaceId: string,
  workflowId: string,
) {
  notificationReadinessInputSchema.parse({ workspaceId, workflowId });
  let capabilities: NotificationDeliveryCapabilities;
  try {
    capabilities = await assertNotificationDeliverySettings(client, workspaceId);
    await assertSalesArea(client, "system.workflows", "view");
    await assertSalesRecord(client, "workflows", workflowId, "view");
  } catch {
    throw Error("Sem permissão para conferir esta regra neste workspace.");
  }
  let data: unknown;
  try {
    const result = await client
      .from("workflows")
      .select(
        "id,workspace_id,name,entity,enabled,status,published_version,trigger,actions,goal_filters",
      )
      .eq("workspace_id", workspaceId)
      .eq("id", workflowId)
      .maybeSingle();
    if (result.error) throw Error("Workflow read failed");
    data = result.data;
  } catch {
    throw Error("Regra indisponível para conferência neste workspace.");
  }
  const parsed = workflowSchema.safeParse(data);
  if (!parsed.success || parsed.data.id !== workflowId || parsed.data.workspace_id !== workspaceId)
    throw Error("Regra indisponível para conferência neste workspace.");
  const workflow = {
    ...parsed.data,
    trigger: parsed.data.trigger,
    actions: parsed.data.actions,
    goal_filters: parsed.data.goal_filters ?? [],
  };
  const checkedAt = new Date().toISOString();
  const initial = buildNotificationReadiness({
    workspaceId,
    checkedAt,
    workflow,
    policy: { available: false, reason: "policy_unavailable" },
    whatsappAccess: false,
    slack: { available: false, reason: "channel_access_unavailable" },
  });
  // Derive dependency demand from validated published steps, never raw draft JSON.
  const whatsappRequested = initial.checks.some((check) => check.code === "whatsapp_policy");
  const slackRequested = initial.checks.some((check) => check.code === "slack_policy");
  const storedPolicy = async (): Promise<ReadinessDependency<NotificationDeliveryPolicy>> => {
    try {
      const result = deliveryPolicyResult.parse(
        await workRpc(client, "notification_delivery_settings", { p_workspace: workspaceId }),
      );
      return { available: true, value: result.policy };
    } catch {
      return { available: false, reason: "policy_unavailable" };
    }
  };
  const whatsappAccess = async () => {
    if (!whatsappRequested) return false;
    try {
      await assertNotificationTemplateAccess(client, workspaceId);
      return true;
    } catch {
      return false;
    }
  };
  const storedSlack = async (): Promise<ReadinessDependency<ReadinessSlack>> => {
    if (!slackRequested || !capabilities.slackView)
      return { available: false, reason: "channel_access_unavailable" };
    try {
      const result = notificationSlackSettingsSchema.parse(
        await workRpc(client, "notification_slack_settings", { p_workspace: workspaceId }),
      );
      return {
        available: true,
        value: {
          policy: result.policy,
          visibleIntegrationIds: result.integrations.map((integration) => integration.id),
        },
      };
    } catch {
      return { available: false, reason: "slack_policy_unavailable" };
    }
  };
  const [policy, whatsapp, slack] = await Promise.all([
    storedPolicy(),
    whatsappAccess(),
    storedSlack(),
  ]);
  return buildNotificationReadiness({
    workspaceId,
    checkedAt,
    workflow,
    policy,
    whatsappAccess: whatsapp,
    slack,
  });
}
