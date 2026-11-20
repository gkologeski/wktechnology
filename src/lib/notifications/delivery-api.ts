import { z } from "zod";
import { notificationCenterCursorSchema } from "@/lib/notification-center";
import { normalizePhone } from "@/lib/phone/e164";
import { notificationDeliveryPolicySchema, NOTIFICATION_DELIVERY_STATUSES } from "./delivery-types";

export const deliveryWorkspaceInput = z.object({ workspaceId: z.string().uuid() }).strict();
export const deliveryPolicyResult = z.object({
  policy: notificationDeliveryPolicySchema,
  revision: z.number().int().min(0),
});
export const deliveryHistoryInput = deliveryWorkspaceInput
  .extend({
    scope: z.enum(["own", "workspace"]).default("own"),
    status: z.enum(NOTIFICATION_DELIVERY_STATUSES).optional(),
    channel: z.enum(["inapp", "email", "whatsapp", "slack"]).optional(),
    cursor: notificationCenterCursorSchema.nullish(),
  })
  .strict();
export const deliveryHistoryResult = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        channel: z.enum(["inapp", "email", "whatsapp", "slack"]),
        status: z.string().max(40),
        eventKey: z.string().max(100).nullable().optional(),
        reason_code: z.string().max(80).nullable(),
        attempts: z.number().int().min(0),
        created_at: z.string(),
        updated_at: z.string(),
        recipient_user_id: z.string().uuid().nullable().optional(),
        workflow_id: z.string().uuid().nullable().optional(),
        provider_id: z.string().max(500).nullable().optional(),
      }),
    )
    .max(50),
  nextCursor: notificationCenterCursorSchema.nullable(),
});
export const deliveryConsentResult = z.object({
  phone: z.string().nullable(),
  consent: z
    .object({
      phone: z.string(),
      grantedAt: z.string().nullable(),
      revokedAt: z.string().nullable(),
      version: z.string(),
      revision: z.number().int().min(0),
    })
    .nullable(),
});
export const deliveryPhoneSchema = z
  .string()
  .max(100)
  .transform((phone, ctx) => {
    const result = normalizePhone(phone, { defaultCountry: null });
    if (result.status !== "valid" || result.extension) {
      ctx.addIssue({
        code: "custom",
        message: "Informe um telefone válido com + e código do país, sem ramal.",
      });
      return z.NEVER;
    }
    return result.e164;
  });
