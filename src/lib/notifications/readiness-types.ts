import { z } from "zod";

export const NOTIFICATION_READINESS_CODES = [
  "workflow_publication",
  "published_configuration",
  "notification_steps",
  "delivery_policy",
  "email_policy",
  "whatsapp_policy",
  "slack_policy",
  "digest_policy",
  "followup_policy",
  "origin_executor_access",
  "recipient_eligibility",
  "personal_consent",
  "current_limits",
  "live_provider",
  "cron_deployment",
  "other_rules_and_queues",
  "production_pilot",
] as const;
export const NOTIFICATION_READINESS_REASONS = [
  "published_enabled",
  "workflow_not_published",
  "workflow_disabled",
  "published_version_missing",
  "published_configuration_valid",
  "published_configuration_invalid",
  "notification_steps_present",
  "notification_steps_missing",
  "policy_observed",
  "policy_unavailable",
  "email_disabled",
  "email_quota_missing",
  "email_policy_observed",
  "whatsapp_disabled",
  "whatsapp_sender_template_missing",
  "whatsapp_quota_budget_missing",
  "whatsapp_policy_observed",
  "channel_access_unavailable",
  "slack_policy_unavailable",
  "slack_disabled",
  "slack_binding_unavailable",
  "slack_channel_override",
  "slack_policy_observed",
  "digest_disabled",
  "digest_policy_observed",
  "digest_event_excluded",
  "followups_disabled",
  "followup_quota_missing",
  "followup_policy_observed",
  "current_origin_executor_manual",
  "current_recipients_manual",
  "recipient_consent_manual",
  "quiet_quotas_budget_manual",
  "provider_live_manual",
  "cron_deployment_manual",
  "other_rules_queues_manual",
  "real_login_delivery_receipts_manual",
] as const;
export const notificationReadinessInputSchema = z
  .object({ workspaceId: z.string().uuid(), workflowId: z.string().uuid() })
  .strict();
export const notificationReadinessWorkflowsInputSchema = z
  .object({ workspaceId: z.string().uuid() })
  .strict();
export const notificationReadinessWorkflowsSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            name: z.string(),
            status: z.enum(["draft", "published", "archived"]),
            enabled: z.boolean(),
            publishedVersion: z.number().int().min(0),
          })
          .strict(),
      )
      .max(100),
    truncated: z.boolean(),
  })
  .strict();
export type NotificationReadinessWorkflows = z.infer<typeof notificationReadinessWorkflowsSchema>;
export const notificationReadinessReportSchema = z
  .object({
    workspaceId: z.string().uuid(),
    checkedAt: z.string().datetime(),
    workflow: z
      .object({
        id: z.string().uuid(),
        status: z.enum(["draft", "published", "archived"]),
        enabled: z.boolean(),
        publishedVersion: z.number().int().min(0),
        eventKey: z.string().max(100).nullable(),
      })
      .strict(),
    checks: z
      .array(
        z
          .object({
            code: z.enum(NOTIFICATION_READINESS_CODES),
            scope: z.enum([
              "workflow",
              "email",
              "whatsapp",
              "slack",
              "digest",
              "followup",
              "operation",
            ]),
            status: z.enum(["observed", "dependency_blocked", "manual_pending", "unavailable"]),
            reason: z.enum(NOTIFICATION_READINESS_REASONS),
          })
          .strict(),
      )
      .min(1)
      .max(30)
      .refine((checks) => new Set(checks.map((check) => check.code)).size === checks.length),
    notes: z.tuple([
      z.literal("published_configuration_only"),
      z.literal("drafts_excluded"),
      z.literal("no_runtime_execution"),
      z.literal("no_global_send_readiness"),
    ]),
    runbookVersion: z.literal("p13-v1"),
  })
  .strict();
export type NotificationReadinessReport = z.infer<typeof notificationReadinessReportSchema>;
export type NotificationReadinessCheck = NotificationReadinessReport["checks"][number];
