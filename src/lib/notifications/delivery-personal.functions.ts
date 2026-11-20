import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireWorkspaceContext } from "@/lib/access-control/active-workspace.middleware";
import { workRpc } from "@/lib/access-control/work-core.server";
import { assertNotificationWorkspace } from "@/lib/notification-center";
import { deliveryWorkspaceInput, deliveryConsentResult, deliveryPhoneSchema } from "./delivery-api";

export const getNotificationDeliveryConsent = createServerFn({ method: "POST" })
  .middleware([requireWorkspaceContext()])
  .inputValidator((input) => deliveryWorkspaceInput.parse(input))
  .handler(async ({ context, data }) => {
    assertNotificationWorkspace(context, data.workspaceId);
    return deliveryConsentResult.parse(
      await workRpc(context.supabase, "get_notification_delivery_consent", {
        p_workspace: data.workspaceId,
      }),
    );
  });
export const saveNotificationDeliveryConsent = createServerFn({ method: "POST" })
  .middleware([requireWorkspaceContext()])
  .inputValidator((input) =>
    deliveryWorkspaceInput
      .extend({
        granted: z.boolean(),
        phone: z.string().max(100),
        revision: z.number().int().min(0),
      })
      .strict()
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    assertNotificationWorkspace(context, data.workspaceId);
    const phone = data.granted ? deliveryPhoneSchema.parse(data.phone) : data.phone;
    return deliveryConsentResult.parse(
      await workRpc(context.supabase, "save_notification_delivery_consent", {
        p_workspace: data.workspaceId,
        p_granted: data.granted,
        p_phone: phone,
        p_revision: data.revision,
      }),
    );
  });
export const updateNotificationProfilePhone = createServerFn({ method: "POST" })
  .middleware([requireWorkspaceContext()])
  .inputValidator((input) =>
    deliveryWorkspaceInput
      .extend({ phone: deliveryPhoneSchema, expectedPhone: z.string().max(100).nullable() })
      .strict()
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    assertNotificationWorkspace(context, data.workspaceId);
    return z.object({ phone: z.string() }).parse(
      await workRpc(context.supabase, "notification_delivery_profile_phone", {
        p_workspace: data.workspaceId,
        p_phone: data.phone,
        p_expected_phone: data.expectedPhone,
      }),
    );
  });
