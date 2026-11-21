import { SaveSchema } from "@/lib/workflows/schemas";
import { digestEventAllowed } from "@/lib/workflows/notification-events";
import type { NotificationDeliveryPolicy, NotificationSlackPolicy } from "./delivery-types";
import {
  notificationReadinessReportSchema,
  type NotificationReadinessCheck,
  type NotificationReadinessReport,
} from "./readiness-types";

/** Private input projection from an already-authorized published-column read. */
export type ReadinessWorkflow = {
  id: string;
  workspace_id: string;
  name: string;
  entity: string;
  enabled: boolean;
  status: "draft" | "published" | "archived";
  published_version: number;
  trigger: unknown;
  actions: unknown;
  goal_filters: unknown;
};
export type ReadinessDependency<T> =
  | { available: true; value: T }
  | {
      available: false;
      reason: "policy_unavailable" | "channel_access_unavailable" | "slack_policy_unavailable";
    };
export type ReadinessSlack = {
  policy: NotificationSlackPolicy;
  visibleIntegrationIds: readonly string[];
};

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Configuration observations only. This pure projection is not an authorizer or a send preflight. */
export function buildNotificationReadiness(input: {
  workspaceId: string;
  checkedAt: string;
  workflow: ReadinessWorkflow;
  policy: ReadinessDependency<NotificationDeliveryPolicy>;
  whatsappAccess: boolean;
  slack: ReadinessDependency<ReadinessSlack>;
}): NotificationReadinessReport {
  const wf = input.workflow;
  if (wf.workspace_id !== input.workspaceId)
    throw Error("Configuração indisponível para conferência.");
  const checks: NotificationReadinessCheck[] = [];
  const add = (
    code: NotificationReadinessCheck["code"],
    scope: NotificationReadinessCheck["scope"],
    status: NotificationReadinessCheck["status"],
    reason: NotificationReadinessCheck["reason"],
  ) => checks.push({ code, scope, status, reason });
  const published = wf.status === "published" && wf.published_version > 0;
  add(
    "workflow_publication",
    "workflow",
    published && wf.enabled ? "observed" : "dependency_blocked",
    wf.status !== "published"
      ? "workflow_not_published"
      : wf.published_version < 1
        ? "published_version_missing"
        : !wf.enabled
          ? "workflow_disabled"
          : "published_enabled",
  );
  const parsed = SaveSchema.safeParse({
    id: wf.id,
    name: wf.name,
    entity: wf.entity,
    enabled: wf.enabled,
    trigger: { ...(object(wf.trigger) ?? {}), goal_filters: wf.goal_filters ?? [] },
    actions: wf.actions,
  });
  add(
    "published_configuration",
    "workflow",
    published && parsed.success ? "observed" : "dependency_blocked",
    !published
      ? "workflow_not_published"
      : parsed.success
        ? "published_configuration_valid"
        : "published_configuration_invalid",
  );
  add(
    "delivery_policy",
    "operation",
    input.policy.available ? "observed" : "unavailable",
    input.policy.available ? "policy_observed" : "policy_unavailable",
  );

  const channels = new Set<string>();
  let steps = 0,
    low = false,
    followup = false,
    slackOverride = false;
  const walk = (actions: readonly unknown[]) => {
    for (const value of actions) {
      const action = object(value);
      if (!action) continue;
      if (action.type === "send_notification") {
        steps++;
        const delivery = object(action.delivery);
        for (const channel of (delivery?.channels as string[] | undefined) ?? ["inapp"])
          channels.add(channel);
        if (delivery?.fallback === "email") channels.add("email");
        low ||= delivery?.priority === "low";
        followup ||= delivery?.followup !== undefined;
      } else if (action.type === "send_slack") {
        steps++;
        channels.add("slack");
        slackOverride ||= typeof action.channel === "string" && action.channel.trim() !== "";
      }
      for (const key of ["then", "else", "default", "actions"])
        if (Array.isArray(action[key])) walk(action[key] as unknown[]);
      for (const key of ["branches", "cases"])
        if (Array.isArray(action[key]))
          for (const branch of action[key] as unknown[]) {
            const nested = object(branch)?.actions;
            if (Array.isArray(nested)) walk(nested);
          }
    }
  };
  if (published && parsed.success) {
    walk(parsed.data.actions);
    add(
      "notification_steps",
      "workflow",
      steps ? "observed" : "dependency_blocked",
      steps ? "notification_steps_present" : "notification_steps_missing",
    );
  }
  const policy = input.policy.available ? input.policy.value : null;
  if (channels.has("email")) {
    add(
      "email_policy",
      "email",
      !policy
        ? "unavailable"
        : !policy.email_enabled || !policy.email_daily_limit
          ? "dependency_blocked"
          : "observed",
      !policy
        ? "policy_unavailable"
        : !policy.email_enabled
          ? "email_disabled"
          : !policy.email_daily_limit
            ? "email_quota_missing"
            : "email_policy_observed",
    );
  }
  if (channels.has("whatsapp")) {
    const pin = policy?.wa_sender_id && policy.wa_template_name && policy.wa_template_language;
    const allowance =
      policy &&
      policy.whatsapp_daily_limit > 0 &&
      policy.wa_estimated_unit_micros > 0 &&
      policy.wa_daily_budget_micros >= policy.wa_estimated_unit_micros;
    add(
      "whatsapp_policy",
      "whatsapp",
      !input.whatsappAccess || !policy
        ? "unavailable"
        : !policy.whatsapp_enabled || !pin || !allowance
          ? "dependency_blocked"
          : "observed",
      !input.whatsappAccess
        ? "channel_access_unavailable"
        : !policy
          ? "policy_unavailable"
          : !policy.whatsapp_enabled
            ? "whatsapp_disabled"
            : !pin
              ? "whatsapp_sender_template_missing"
              : !allowance
                ? "whatsapp_quota_budget_missing"
                : "whatsapp_policy_observed",
    );
  }
  if (channels.has("slack")) {
    const s = input.slack.available ? input.slack.value : null;
    const bound =
      s?.policy.integration_id && s.visibleIntegrationIds.includes(s.policy.integration_id);
    add(
      "slack_policy",
      "slack",
      !s
        ? "unavailable"
        : slackOverride || !s.policy.enabled || !bound || !s.policy.daily_limit
          ? "dependency_blocked"
          : "observed",
      !s
        ? input.slack.available
          ? "slack_policy_unavailable"
          : input.slack.reason
        : slackOverride
          ? "slack_channel_override"
          : !s.policy.enabled
            ? "slack_disabled"
            : !bound || !s.policy.daily_limit
              ? "slack_binding_unavailable"
              : "slack_policy_observed",
    );
  }
  const eventKey =
    published && parsed.success ? (parsed.data.trigger.notification_event?.key ?? null) : null;
  if (low && (channels.has("email") || channels.has("whatsapp"))) {
    const eligible = digestEventAllowed(eventKey);
    add(
      "digest_policy",
      "digest",
      !eligible
        ? "observed"
        : !policy
          ? "unavailable"
          : policy.digest_enabled
            ? "observed"
            : "dependency_blocked",
      !eligible
        ? "digest_event_excluded"
        : !policy
          ? "policy_unavailable"
          : policy.digest_enabled
            ? "digest_policy_observed"
            : "digest_disabled",
    );
  }
  if (followup) {
    add(
      "followup_policy",
      "followup",
      !policy
        ? "unavailable"
        : !policy.followups_enabled || !policy.followup_daily_limit
          ? "dependency_blocked"
          : "observed",
      !policy
        ? "policy_unavailable"
        : !policy.followups_enabled
          ? "followups_disabled"
          : !policy.followup_daily_limit
            ? "followup_quota_missing"
            : "followup_policy_observed",
    );
  }
  for (const [code, reason] of [
    ["origin_executor_access", "current_origin_executor_manual"],
    ["recipient_eligibility", "current_recipients_manual"],
    ["personal_consent", "recipient_consent_manual"],
    ["current_limits", "quiet_quotas_budget_manual"],
    ["live_provider", "provider_live_manual"],
    ["cron_deployment", "cron_deployment_manual"],
    ["other_rules_and_queues", "other_rules_queues_manual"],
    ["production_pilot", "real_login_delivery_receipts_manual"],
  ] as const)
    add(code, "operation", "manual_pending", reason);
  return notificationReadinessReportSchema.parse({
    workspaceId: input.workspaceId,
    checkedAt: input.checkedAt,
    workflow: {
      id: wf.id,
      status: wf.status,
      enabled: wf.enabled,
      publishedVersion: wf.published_version,
      eventKey,
    },
    checks,
    notes: [
      "published_configuration_only",
      "drafts_excluded",
      "no_runtime_execution",
      "no_global_send_readiness",
    ],
    runbookVersion: "p13-v1",
  });
}
