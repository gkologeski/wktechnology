import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireWorkspaceContext } from "@/lib/access-control/active-workspace.middleware";
import { workRpc } from "@/lib/access-control/work-core.server";
import { assertNotificationWorkspace } from "@/lib/notification-center";
import { notificationDeliveryPolicySchema } from "./delivery-types";
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
    const { data: rows, error } = await context.supabase
      .from("wa_cloud_numbers")
      .select("phone_number_id,display_phone_number,verified_name,quality_rating,status,available")
      .eq("workspace_id", data.workspaceId)
      .order("display_phone_number")
      .limit(100);
    if (error) throw Error("Não foi possível consultar os remetentes do WhatsApp.");
    return {
      items: (rows ?? []).map((row) => ({
        id: row.phone_number_id,
        phone: row.display_phone_number ?? "",
        label: row.verified_name || row.display_phone_number || "Número conectado",
        available: row.available === true && row.status === "CONNECTED",
        quality: row.quality_rating,
      })),
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
