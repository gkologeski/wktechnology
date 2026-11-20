import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { workRpc } from "@/lib/access-control/work-core.server";
import { assertSalesArea } from "@/lib/access-control/sales-core.server";
import type { NotificationDeliveryCapabilities } from "./delivery-types";

const capabilitiesSchema = z.object({
  settingsView: z.boolean(),
  settingsManage: z.boolean(),
  deliveriesView: z.boolean(),
  deliveriesWorkspaceView: z.boolean(),
  whatsappConfigure: z.boolean().default(false),
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
  await assertSalesArea(client, "system.channels", "view");
  await assertSalesArea(client, "system.whatsapp", "view");
}
