import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { workRpc } from "@/lib/access-control/work-core.server";
import type { NotificationDeliveryCapabilities } from "./delivery-types";

const capabilitiesSchema = z.object({
  settingsView: z.boolean(),
  settingsManage: z.boolean(),
  deliveriesView: z.boolean(),
  deliveriesWorkspaceView: z.boolean(),
  whatsappConfigure: z.boolean().default(false),
  slackView: z.boolean().default(false),
  slackConfigure: z.boolean().default(false),
});
export async function notificationDeliveryCapabilities(
  client: SupabaseClient,
  workspaceId: string,
): Promise<NotificationDeliveryCapabilities> {
  return capabilitiesSchema.parse(
    await workRpc(client, "notification_delivery_capabilities", { p_workspace: workspaceId }),
  );
}
export async function assertNotificationDeliverySettings(
  client: SupabaseClient,
  workspaceId: string,
  manage = false,
) {
  const capabilities = await notificationDeliveryCapabilities(client, workspaceId);
  if (!capabilities.settingsView || (manage && !capabilities.settingsManage))
    throw Error("Sem permissão para configurar notificações.");
  return capabilities;
}
export async function assertNotificationTemplateAccess(
  client: SupabaseClient,
  workspaceId: string,
) {
  await assertNotificationDeliverySettings(client, workspaceId);
  // Shared channels were added after the legacy sales-area whitelist. Resolve
  // the caller's canonical keys instead; raw sender RLS already requires the
  // workspace WhatsApp view key, so own/team do not widen this catalogue.
  const context = z
    .object({
      actor: z.string().uuid(),
      workspace: z.string().uuid(),
      keys: z.record(z.string(), z.boolean()),
    })
    .safeParse(await workRpc(client, "work_access_context", {}));
  if (
    !context.success ||
    context.data.workspace !== workspaceId ||
    ![
      "system.notification_settings.view.workspace",
      "system.channels.view.workspace",
      "system.whatsapp.view.workspace",
    ].every((key) => context.data.keys[key] === true)
  )
    throw Error("Sem permissão para consultar remetentes e modelos de WhatsApp.");
}
