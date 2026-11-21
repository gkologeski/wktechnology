import { z } from "zod";
import { notificationPrioritySchema, notificationFollowupSchema } from "./scheduling-types";

export const notificationDeliveryConfigSchema = z
  .object({
    channels: z
      .array(z.enum(["inapp", "email", "whatsapp"]))
      .min(1)
      .max(3)
      .refine((channels) => new Set(channels).size === channels.length, "Não repita um canal."),
    fallback: z.enum(["none", "email"]).default("none"),
    priority: notificationPrioritySchema.optional(),
    followup: notificationFollowupSchema.optional(),
  })
  .strict()
  .refine(
    (config) =>
      config.fallback !== "email" ||
      (config.channels.includes("whatsapp") && !config.channels.includes("email")),
    { message: "O fallback de e-mail exige WhatsApp como canal primário, sem e-mail em paralelo." },
  )
  .refine((config) => !config.followup || config.channels.includes("inapp"), {
    message: "O acompanhamento exige o aviso original no aplicativo.",
  });
export type NotificationDeliveryConfig = z.infer<typeof notificationDeliveryConfigSchema>;

const personalTransportShape = {
  id: z.string().uuid(),
  token: z.string().uuid(),
  channel: z.enum(["email", "whatsapp"]),
  idempotencyKey: z.string().min(1).max(500),
  workspaceId: z.string().uuid(),

  recipientId: z.string().uuid(),
  connectionId: z.string().uuid().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  senderPhoneNumberId: z.string().nullable().optional(),
  templateName: z.string().nullable().optional(),
  templateLanguage: z.string().nullable().optional(),
};
const personalDeliveryJobSchema = z
  .object({
    ...personalTransportShape,
    kind: z.enum(["initial", "reminder", "escalation"]).optional(),
    parentIntentId: z.string().uuid().optional(),
    workflowId: z.string().uuid(),
    runId: z.string().uuid(),
    batchId: z.never().optional(),
  })
  .superRefine((job, ctx) => {
    const followup = job.kind === "reminder" || job.kind === "escalation";
    if (followup !== (job.parentIntentId !== undefined))
      ctx.addIssue({
        code: "custom",
        path: ["parentIntentId"],
        message: "A ocorrência de acompanhamento exige a intenção original.",
      });
  });
export const notificationDigestJobSchema = z.object({
  ...personalTransportShape,
  kind: z.literal("digest"),
  batchId: z.string().uuid(),
  parentIntentId: z.never().optional(),
  source: z.never().optional(),
  sourceId: z.never().optional(),
  sourceTable: z.never().optional(),
  workflowId: z.never().optional(),
  runId: z.never().optional(),
});
export const notificationSlackJobSchema = z.object({
  id: z.string().uuid(),
  token: z.string().uuid(),
  channel: z.literal("slack"),
  kind: z.never().optional(),
  batchId: z.never().optional(),
  idempotencyKey: z.string().min(1).max(500),
  workspaceId: z.string().uuid(),
  workflowId: z.string().uuid(),
  runId: z.string().uuid(),
  integrationId: z.string().uuid(),
  endpointRevision: z.number().int().positive(),
  endpointHash: z.string().regex(/^[a-f0-9]{64}$/),
});
export const notificationDeliveryJobSchema = z.union([
  personalDeliveryJobSchema,
  notificationDigestJobSchema,
  notificationSlackJobSchema,
]);
export type NotificationDigestJob = z.infer<typeof notificationDigestJobSchema>;
export type NotificationPersonalDeliveryJob =
  | z.infer<typeof personalDeliveryJobSchema>
  | NotificationDigestJob;
export type NotificationSlackJob = z.infer<typeof notificationSlackJobSchema>;
export type NotificationDeliveryJob = z.infer<typeof notificationDeliveryJobSchema>;
export type NotificationTransportResult = {
  status: "accepted" | "suppressed" | "retry_scheduled" | "failed" | "uncertain";
  provider: "meta_cloud" | "lovable_whatsapp" | "managed_email" | "slack_webhook";
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

const deliveryPolicyShape = {
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
};

const schedulingPolicyShape = {
  digest_enabled: z.boolean(),
  followups_enabled: z.boolean(),
  followup_daily_limit: z.number().int().min(0).max(10000),
};
const legacyPolicySchema = z.object(deliveryPolicyShape);
function validateDeliveryPolicy(
  policy: z.infer<typeof legacyPolicySchema> & {
    followups_enabled?: boolean;
    followup_daily_limit?: number;
  },
  ctx: z.RefinementCtx,
) {
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

  if (policy.followups_enabled && policy.followup_daily_limit === 0)
    ctx.addIssue({
      code: "custom",
      path: ["followup_daily_limit"],
      message: "Defina uma cota positiva para habilitar acompanhamentos.",
    });
}
export const notificationDeliveryPolicySchema = legacyPolicySchema
  .extend({
    digest_enabled: schedulingPolicyShape.digest_enabled.default(false),
    followups_enabled: schedulingPolicyShape.followups_enabled.default(false),
    followup_daily_limit: schedulingPolicyShape.followup_daily_limit.default(0),
  })
  .strict()
  .superRefine(validateDeliveryPolicy);
/** Legacy clients omit new switches; only supplied fields may change stored scheduling policy. */
export const notificationDeliveryPolicyInputSchema = legacyPolicySchema
  .extend({
    digest_enabled: schedulingPolicyShape.digest_enabled.optional(),
    followups_enabled: schedulingPolicyShape.followups_enabled.optional(),
    followup_daily_limit: schedulingPolicyShape.followup_daily_limit.optional(),
  })
  .strict()
  .superRefine(validateDeliveryPolicy);
export type NotificationDeliveryPolicy = z.infer<typeof notificationDeliveryPolicySchema>;
export const DEFAULT_NOTIFICATION_DELIVERY_POLICY: NotificationDeliveryPolicy =
  notificationDeliveryPolicySchema.parse({});
export type NotificationDeliveryCapabilities = {
  settingsView: boolean;
  settingsManage: boolean;
  deliveriesView: boolean;
  deliveriesWorkspaceView: boolean;
  whatsappConfigure?: boolean;
  slackView?: boolean;
  slackConfigure?: boolean;
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
  eventKey?: string | null;
  occurrence_kind?: "initial" | "reminder" | "escalation" | "digest";
  parent_intent_id?: string | null;
  batch_id?: string | null;
  channel: "inapp" | "email" | "whatsapp" | "slack";
  status: string;
  reason_code: string | null;
  attempts: number;
  created_at: string;
  updated_at: string;
  recipient_user_id?: string | null;
  workflow_id?: string | null;
  provider_id?: string | null;
};

export const notificationSlackPolicySchema = z
  .object({
    enabled: z.boolean().default(false),
    daily_limit: z.number().int().min(0).max(10000).default(0),
    integration_id: z.string().uuid().nullable().default(null),
    template_version: z.literal("neutral-v1").default("neutral-v1"),
  })
  .strict()
  .refine((policy) => !policy.enabled || (policy.daily_limit > 0 && !!policy.integration_id), {
    message: "Selecione uma conexão e uma cota positiva antes de habilitar o canal compartilhado.",
  });
export type NotificationSlackPolicy = z.infer<typeof notificationSlackPolicySchema>;
export const notificationSlackSettingsSchema = z.object({
  policy: notificationSlackPolicySchema,
  revision: z.number().int().min(0),
  integrations: z
    .array(
      z.object({
        id: z.string().uuid(),
        team_name: z.string().nullable(),
        default_channel_name: z.string().nullable(),
        endpoint_revision: z.number().int().positive(),
      }),
    )
    .max(100),
});
export type NotificationSlackSettings = z.infer<typeof notificationSlackSettingsSchema> & {
  canManage: boolean;
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
