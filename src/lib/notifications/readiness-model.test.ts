import { describe, expect, it } from "vitest";
import { workflowNotificationEventTrigger } from "@/lib/workflows/notification-events";
import { DEFAULT_NOTIFICATION_DELIVERY_POLICY } from "./delivery-types";
import { buildNotificationReadiness, type ReadinessWorkflow } from "./readiness-model";
import {
  notificationReadinessInputSchema,
  notificationReadinessReportSchema,
} from "./readiness-types";

const W = "11111111-1111-4111-8111-111111111111";
const WF = "22222222-2222-4222-8222-222222222222";
const INTEGRATION = "33333333-3333-4333-8333-333333333333";
const action = {
  type: "send_notification",
  title: "PRIVATE source title",
  body: "PRIVATE source body",
  recipients: [{ kind: "source_responsible" }],
  delivery: {
    channels: ["inapp", "email", "whatsapp"],
    fallback: "none",
    priority: "low",
    followup: { reminder: { interval_hours: 24, max_occurrences: 3 } },
  },
};
const workflow: ReadinessWorkflow = {
  id: WF,
  workspace_id: W,
  name: "PRIVATE workflow name",
  entity: "project_tasks",
  enabled: true,
  status: "published",
  published_version: 3,
  trigger: workflowNotificationEventTrigger("projects.task.overdue"),
  actions: [action],
  goal_filters: [],
};
const input = () => ({
  workspaceId: W,
  checkedAt: "2026-11-20T15:00:00.000Z",
  workflow,
  policy: {
    available: true as const,
    value: {
      ...DEFAULT_NOTIFICATION_DELIVERY_POLICY,
      email_enabled: true,
      email_daily_limit: 20,
      whatsapp_enabled: true,
      whatsapp_daily_limit: 20,
      wa_sender_id: "123456789",
      wa_template_name: "notification_update",
      wa_template_language: "pt_BR",
      wa_estimated_unit_micros: 1000,
      wa_daily_budget_micros: 10000,
      digest_enabled: true,
      followups_enabled: true,
      followup_daily_limit: 10,
    },
  },
  whatsappAccess: true,
  slack: {
    available: true as const,
    value: {
      policy: {
        enabled: true,
        daily_limit: 10,
        integration_id: INTEGRATION,
        template_version: "neutral-v1" as const,
      },
      visibleIntegrationIds: [INTEGRATION],
    },
  },
});

describe("published-only configuration observations", () => {
  it("keeps all live authorization and operational checks pending even when stored dependencies are configured", () => {
    const report = buildNotificationReadiness(input());
    expect(report.checks.find((check) => check.code === "published_configuration")).toMatchObject({
      status: "observed",
    });
    expect(
      report.checks.filter((check) => check.status === "manual_pending").map((check) => check.code),
    ).toEqual([
      "origin_executor_access",
      "recipient_eligibility",
      "personal_consent",
      "current_limits",
      "live_provider",
      "cron_deployment",
      "other_rules_and_queues",
      "production_pilot",
    ]);
    expect(report).not.toHaveProperty("ready");
    expect(report).not.toHaveProperty("readyToSend");
    expect(
      notificationReadinessReportSchema.safeParse({ ...report, readyToSend: true }).success,
    ).toBe(false);
    expect(JSON.stringify(report)).not.toMatch(
      /PRIVATE|notification_update|123456789|source_responsible/,
    );
    expect(JSON.stringify(report)).not.toContain(INTEGRATION);
    expect(report.notes).toContain("drafts_excluded");
  });

  it("ignores even invalid private draft actions instead of mixing them with the published configuration", () => {
    const before = buildNotificationReadiness(input());
    const withDraft = {
      ...workflow,
      draft_actions: [{ type: "send_email", to: "PRIVATE@example.test" }],
      draft_trigger: { notification_event: { key: "invalid" } },
    };
    expect(buildNotificationReadiness({ ...input(), workflow: withDraft })).toEqual(before);
  });

  it.each([
    { status: "draft" as const, published_version: 0, reason: "workflow_not_published" },
    { status: "archived" as const, reason: "workflow_not_published" },
    { enabled: false, reason: "workflow_disabled" },
    { published_version: 0, reason: "published_version_missing" },
  ])(
    "reports a blocked workflow dependency without claiming runtime eligibility: $reason",
    (patch) => {
      const report = buildNotificationReadiness({
        ...input(),
        workflow: { ...workflow, ...patch },
      });
      expect(report.checks).toContainEqual({
        code: "workflow_publication",
        scope: "workflow",
        status: "dependency_blocked",
        reason: patch.reason,
      });
      if (patch.status || patch.published_version === 0)
        expect(report.workflow.eventKey).toBeNull();
    },
  );

  it("blocks invalid published financial filters without reflecting private values or parse errors", () => {
    const report = buildNotificationReadiness({
      ...input(),
      workflow: {
        ...workflow,
        entity: "financial_entries",
        trigger: {
          ...workflowNotificationEventTrigger("finance.payable.due"),
          filters: [{ field: "amount", op: "is_empty" }],
        },
        actions: [{ ...action, delivery: { channels: ["inapp"] } }],
      },
    });
    expect(report.checks).toContainEqual({
      code: "published_configuration",
      scope: "workflow",
      status: "dependency_blocked",
      reason: "published_configuration_invalid",
    });
    expect(report.checks.some((check) => check.code === "email_policy")).toBe(false);
    expect(JSON.stringify(report)).not.toMatch(/PRIVATE|amount|ZodError/);
  });

  it("does not turn unavailable policy or unvalidated channel access into positive checks", () => {
    const report = buildNotificationReadiness({
      ...input(),
      policy: { available: false, reason: "policy_unavailable" },
      whatsappAccess: false,
    });
    expect(report.checks).toContainEqual({
      code: "delivery_policy",
      scope: "operation",
      status: "unavailable",
      reason: "policy_unavailable",
    });
    expect(report.checks).toContainEqual({
      code: "whatsapp_policy",
      scope: "whatsapp",
      status: "unavailable",
      reason: "channel_access_unavailable",
    });
    expect(report.checks.find((check) => check.code === "email_policy")?.status).toBe(
      "unavailable",
    );
  });

  it("keeps a legacy Slack channel override blocked and does not expose the endpoint binding", () => {
    const report = buildNotificationReadiness({
      ...input(),
      workflow: {
        ...workflow,
        actions: [{ type: "send_slack", text: "PRIVATE text", channel: "PRIVATE channel" }],
      },
    });
    expect(report.checks).toContainEqual({
      code: "slack_policy",
      scope: "slack",
      status: "dependency_blocked",
      reason: "slack_channel_override",
    });
    expect(JSON.stringify(report)).not.toMatch(/PRIVATE|webhook|endpoint/);
    const hidden = buildNotificationReadiness({
      ...input(),
      workflow: { ...workflow, actions: [{ type: "send_slack", text: "PRIVATE" }] },
      slack: { available: false, reason: "channel_access_unavailable" },
    });
    expect(hidden.checks.find((check) => check.code === "slack_policy")?.status).toBe(
      "unavailable",
    );
  });

  it("keeps pending approval excluded from digests despite an explicitly low priority", () => {
    const report = buildNotificationReadiness({
      ...input(),
      workflow: {
        ...workflow,
        entity: "hiring_preparation_requests",
        trigger: workflowNotificationEventTrigger("people.approval.pending"),
        actions: [{ ...action, recipients: [{ kind: "pending_approvers" }] }],
      },
    });
    expect(report.checks).toContainEqual({
      code: "digest_policy",
      scope: "digest",
      status: "observed",
      reason: "digest_event_excluded",
    });
    expect(report.checks.find((check) => check.code === "personal_consent")?.status).toBe(
      "manual_pending",
    );
  });
});

it("requires an exact selected workspace and workflow, without arbitrary actor, source, endpoint or execution inputs", () => {
  expect(notificationReadinessInputSchema.parse({ workspaceId: W, workflowId: WF })).toEqual({
    workspaceId: W,
    workflowId: WF,
  });
  for (const value of [
    { workspaceId: W },
    { workflowId: WF },
    { workspaceId: W, workflowId: "invalid" },
    { workspaceId: W, workflowId: WF, userId: WF },
    { workspaceId: W, workflowId: WF, execute: true },
    { workspaceId: W, workflowId: WF, sourceId: WF },
    { workspaceId: W, workflowId: WF, endpoint: "https://example.test" },
  ])
    expect(notificationReadinessInputSchema.safeParse(value).success).toBe(false);
});
