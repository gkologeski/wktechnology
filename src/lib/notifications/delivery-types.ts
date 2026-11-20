import { z } from "zod";

export const notificationDeliveryConfigSchema = z
  .object({
    channels: z
      .array(z.enum(["inapp", "email", "whatsapp"]))
      .min(1)
      .max(3)
      .refine((channels) => new Set(channels).size === channels.length, "Não repita um canal."),
    fallback: z.enum(["none", "email"]).default("none"),
  })
  .strict()
  .refine(
    (config) =>
      config.fallback !== "email" ||
      (config.channels.includes("whatsapp") && !config.channels.includes("email")),
    { message: "O fallback de e-mail exige WhatsApp como canal primário, sem e-mail em paralelo." },
  );
export type NotificationDeliveryConfig = z.infer<typeof notificationDeliveryConfigSchema>;

export const notificationDeliveryJobSchema = z.object({
  id: z.string().uuid(),
  token: z.string().uuid(),
  channel: z.enum(["email", "whatsapp"]),
  idempotencyKey: z.string().min(1).max(500),
  workspaceId: z.string().uuid(),
  workflowId: z.string().uuid(),
  runId: z.string().uuid(),
  recipientId: z.string().uuid(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  senderPhoneNumberId: z.string().nullable().optional(),
  templateName: z.string().nullable().optional(),
  templateLanguage: z.string().nullable().optional(),
});
export type NotificationDeliveryJob = z.infer<typeof notificationDeliveryJobSchema>;
export type NotificationTransportResult = {
  status: "accepted" | "suppressed" | "retry_scheduled" | "failed" | "uncertain";
  provider: "meta_cloud" | "lovable_whatsapp" | "managed_email";
  providerId?: string | null;
  reasonCode?:
    | "invalid_recipient"
    | "invalid_configuration"
    | "invalid_template"
    | "sender_unavailable"
    | "provider_rejected"
    | "provider_rate_limited"
    | "provider_preflight_unavailable"
    | "transport_unknown"
    | "recipient_suppressed";
  retryAfterSeconds?: number;
};

export const notificationDeliveryPolicySchema = z
  .object({
    email_enabled: z.boolean().default(false),
    whatsapp_enabled: z.boolean().default(false),
    email_daily_limit: z.number().int().min(0).max(10000).default(0),
    whatsapp_daily_limit: z.number().int().min(0).max(10000).default(0),
    wa_sender_id: z
      .string()
      .regex(/^\d{5,30}$/)
      .nullable()
      .default(null),
    wa_template_name: z
      .string()
      .regex(/^[a-z0-9_]{1,512}$/)
      .nullable()
      .default(null),
    wa_template_language: z
      .string()
      .regex(/^[a-z]{2,3}(_[A-Z]{2})?$/)
      .nullable()
      .default(null),
    wa_estimated_unit_micros: z.number().int().min(0).max(1_000_000_000_000).default(0),
    wa_daily_budget_micros: z.number().int().min(0).max(1_000_000_000_000).default(0),
    currency: z.enum(["BRL", "USD", "EUR"]).default("BRL"),
  })
  .strict()
  .superRefine((policy, ctx) => {
    if (policy.email_enabled && !policy.email_daily_limit)
      ctx.addIssue({
        code: "custom",
        path: ["email_daily_limit"],
        message: "Defina uma cota positiva para habilitar e-mail.",
      });
    if (
      policy.whatsapp_enabled &&
      (!policy.wa_sender_id ||
        !policy.wa_template_name ||
        !policy.wa_template_language ||
        !policy.whatsapp_daily_limit ||
        !policy.wa_estimated_unit_micros ||
        policy.wa_daily_budget_micros < policy.wa_estimated_unit_micros)
    )
      ctx.addIssue({
        code: "custom",
        path: ["whatsapp_enabled"],
        message:
          "Configure remetente, modelo, idioma, cota e orçamento estimado antes de habilitar WhatsApp.",
      });
  });
export type NotificationDeliveryPolicy = z.infer<typeof notificationDeliveryPolicySchema>;
export const DEFAULT_NOTIFICATION_DELIVERY_POLICY: NotificationDeliveryPolicy =
  notificationDeliveryPolicySchema.parse({});
export type NotificationDeliveryCapabilities = {
  settingsView: boolean;
  settingsManage: boolean;
  deliveriesView: boolean;
  deliveriesWorkspaceView: boolean;
  whatsappConfigure?: boolean;
};
export type NotificationDeliveryConsent = {
  phone: string | null;
  consent: {
    phone: string;
    grantedAt: string | null;
    revokedAt: string | null;
    version: string;
    revision: number;
  } | null;
};
export type NotificationDeliveryHistoryItem = {
  id: string;
  channel: "inapp" | "email" | "whatsapp";
  status: string;
  reason_code: string | null;
  attempts: number;
  created_at: string;
  updated_at: string;
  recipient_user_id?: string | null;
  workflow_id?: string | null;
  provider_id?: string | null;
};
export type NotificationDeliveryHistory = {
  items: NotificationDeliveryHistoryItem[];
  nextCursor: { createdAt: string; id: string } | null;
};

export const NOTIFICATION_DELIVERY_STATUSES = [
  "available",
  "queued",
  "in_flight",
  "accepted",
  "sent",
  "delivered",
  "read",
  "retry_scheduled",
  "failed",
  "uncertain",
  "suppressed",
  "deduped",
] as const;
