import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireWorkspaceContext } from "@/lib/access-control/active-workspace.middleware";
import { workRpc } from "@/lib/access-control/work-core.server";
import { assertNotificationWorkspace } from "@/lib/notification-center";
import {
  notificationDeliveryPolicySchema,
  notificationSlackPolicySchema,
  notificationSlackSettingsSchema,
} from "./delivery-types";
import {
  deliveryWorkspaceInput,
  deliveryPolicyResult,
  deliveryHistoryInput,
  deliveryHistoryResult,
} from "./delivery-api";
import {
  notificationDeliveryCapabilities,
  assertNotificationDeliverySettings,
  assertNotificationTemplateAccess,
} from "./delivery-access.server";

export const getNotificationDeliveryCapabilities = createServerFn({ method: "POST" })
  .middleware([requireWorkspaceContext()])
  .inputValidator((input) => deliveryWorkspaceInput.parse(input))
  .handler(async ({ context, data }) => {
    assertNotificationWorkspace(context, data.workspaceId);
    return notificationDeliveryCapabilities(context.supabase, data.workspaceId);
  });
export const getNotificationDeliverySettings = createServerFn({ method: "POST" })
  .middleware([requireWorkspaceContext()])
  .inputValidator((input) => deliveryWorkspaceInput.parse(input))
  .handler(async ({ context, data }) => {
    assertNotificationWorkspace(context, data.workspaceId);
    await assertNotificationDeliverySettings(context.supabase, data.workspaceId);
    return deliveryPolicyResult.parse(
      await workRpc(context.supabase, "notification_delivery_settings", {
        p_workspace: data.workspaceId,
      }),
    );
  });
export const saveNotificationDeliverySettings = createServerFn({ method: "POST" })
  .middleware([requireWorkspaceContext()])
  .inputValidator((input) =>
    deliveryWorkspaceInput
      .extend({ policy: notificationDeliveryPolicySchema, revision: z.number().int().min(0) })
      .strict()
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    assertNotificationWorkspace(context, data.workspaceId);
    await assertNotificationDeliverySettings(context.supabase, data.workspaceId, true);
    return deliveryPolicyResult.parse(
      await workRpc(context.supabase, "notification_delivery_settings_save", {
        p_workspace: data.workspaceId,
        p_policy: data.policy,
        p_revision: data.revision,
      }),
    );
  });
export const listNotificationDeliveryHistory = createServerFn({ method: "POST" })
  .middleware([requireWorkspaceContext()])
  .inputValidator((input) => deliveryHistoryInput.parse(input))
  .handler(async ({ context, data }) => {
    assertNotificationWorkspace(context, data.workspaceId);
    const caps = await notificationDeliveryCapabilities(context.supabase, data.workspaceId);
    if (!caps.deliveriesView || (data.scope === "workspace" && !caps.deliveriesWorkspaceView))
      throw Error("Sem permissão para consultar entregas.");
    return deliveryHistoryResult.parse(
      await workRpc(context.supabase, "notification_delivery_history", {
        p_workspace: data.workspaceId,
        p_scope: data.scope,
        p_cursor: data.cursor ?? null,
        p_status: data.status ?? null,
        p_channel: data.channel ?? null,
      }),
    );
  });
export const listNotificationWhatsAppSenders = createServerFn({ method: "POST" })
  .middleware([requireWorkspaceContext()])
  .inputValidator((input) => deliveryWorkspaceInput.parse(input))
  .handler(async ({ context, data }) => {
    assertNotificationWorkspace(context, data.workspaceId);
    await assertNotificationTemplateAccess(context.supabase, data.workspaceId);
    const [numbers, connections] = await Promise.all([
      context.supabase
        .from("wa_cloud_numbers")
        .select(
          "phone_number_id,connection_id,display_phone_number,verified_name,quality_rating,status,available,synced_at",
        )
        .eq("workspace_id", data.workspaceId)
        .order("display_phone_number")
        .limit(100),
      context.supabase
        .from("wa_cloud_connections")
        .select("id,enabled,webhook_verified_at")
        .eq("workspace_id", data.workspaceId)
        .limit(100),
    ]);
    if (numbers.error || connections.error)
      throw Error("Não foi possível consultar os remetentes do WhatsApp.");
    const connectionsById = new Map((connections.data ?? []).map((row) => [row.id, row]));
    return {
      items: (numbers.data ?? []).map((row) => {
        const connection = connectionsById.get(row.connection_id);
        const available = row.available === true && row.status === "CONNECTED";
        const reason = !available
          ? "sender_unavailable"
          : !connection?.enabled
            ? "connection_unavailable"
            : !connection.webhook_verified_at
              ? "webhook_unverified"
              : !["GREEN", "HIGH"].includes(row.quality_rating ?? "")
                ? "quality_not_high"
                : null;
        return {
          id: row.phone_number_id,
          phone: row.display_phone_number ?? "",
          label: row.verified_name || row.display_phone_number || "Número conectado",
          available,
          quality: row.quality_rating,
          status: row.status,
          syncedAt: row.synced_at,
          eligible: reason === null,
          reason,
        };
      }),
    };
  });
export const listNotificationWhatsAppTemplates = createServerFn({ method: "POST" })
  .middleware([requireWorkspaceContext()])
  .inputValidator((input) =>
    deliveryWorkspaceInput
      .extend({ senderPhoneNumberId: z.string().regex(/^\d{5,30}$/) })
      .strict()
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    assertNotificationWorkspace(context, data.workspaceId);
    await assertNotificationTemplateAccess(context.supabase, data.workspaceId);
    const { data: sender, error } = await context.supabase
      .from("wa_cloud_numbers")
      .select("phone_number_id")
      .eq("workspace_id", data.workspaceId)
      .eq("phone_number_id", data.senderPhoneNumberId)
      .maybeSingle();
    if (error || !sender) throw Error("Remetente indisponível neste workspace.");
    const { loadNotificationWhatsAppTemplates } = await import("./delivery-adapters.server");
    return {
      items: await loadNotificationWhatsAppTemplates(data.workspaceId, data.senderPhoneNumberId),
    };
  });

export const getNotificationSlackSettings = createServerFn({ method: "POST" })
  .middleware([requireWorkspaceContext()])
  .inputValidator((input) => deliveryWorkspaceInput.parse(input))
  .handler(async ({ context, data }) => {
    assertNotificationWorkspace(context, data.workspaceId);
    const caps = await notificationDeliveryCapabilities(context.supabase, data.workspaceId);
    if (!caps.slackView) throw Error("Sem permissão para consultar o canal Slack.");
    const settings = notificationSlackSettingsSchema.parse(
      await workRpc(context.supabase, "notification_slack_settings", {
        p_workspace: data.workspaceId,
      }),
    );
    return { ...settings, canManage: caps.slackConfigure === true };
  });

export const saveNotificationSlackSettings = createServerFn({ method: "POST" })
  .middleware([requireWorkspaceContext()])
  .inputValidator((input) =>
    deliveryWorkspaceInput
      .extend({ policy: notificationSlackPolicySchema, revision: z.number().int().min(0) })
      .strict()
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    assertNotificationWorkspace(context, data.workspaceId);
    const caps = await notificationDeliveryCapabilities(context.supabase, data.workspaceId);
    if (!caps.slackView || !caps.slackConfigure)
      throw Error("Sem permissão para configurar o canal Slack.");
    const settings = notificationSlackSettingsSchema.parse(
      await workRpc(context.supabase, "notification_slack_settings_save", {
        p_workspace: data.workspaceId,
        p_policy: data.policy,
        p_revision: data.revision,
      }),
    );
    return { ...settings, canManage: true };
  });
