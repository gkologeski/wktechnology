import { describe, expect, it } from "vitest";
import { SaveSchema } from "@/lib/workflows/schemas";
import {
  WORKFLOW_NOTIFICATION_EVENTS,
  digestEventAllowed,
  workflowNotificationEventTrigger,
} from "@/lib/workflows/notification-events";
import {
  notificationDeliveryConfigSchema,
  notificationDeliveryJobSchema,
  notificationDeliveryPolicyInputSchema,
  notificationDeliveryPolicySchema,
} from "./delivery-types";
import {
  DEFAULT_NOTIFICATION_DIGEST_SETTINGS,
  NOTIFICATION_FOLLOWUP_EVENT_KEYS,
  notificationDigestSettingsSchema,
  notificationFollowupSchema,
  notificationFollowupProblem,
  notificationSchedulingActionProblem,
} from "./scheduling-types";

const U = "11111111-1111-4111-8111-111111111111";
const reminder = { reminder: { interval_hours: 24, max_occurrences: 3 } };
const notice = {
  type: "send_notification",
  title: "Consulte a central",
  recipients: [{ kind: "source_responsible" }],
  delivery: { channels: ["inapp", "email"], followup: reminder },
};

describe("explicit personal digest and bounded notification follow-up", () => {
  it("keeps digest disabled and separate from visual grouping, consent and automatic fallback", () => {
    expect(notificationDigestSettingsSchema.parse({})).toEqual(
      DEFAULT_NOTIFICATION_DIGEST_SETTINGS,
    );
    expect(DEFAULT_NOTIFICATION_DIGEST_SETTINGS).toEqual({
      enabled: false,
      frequency: "daily",
      at: "08:30",
      timezone: "America/Sao_Paulo",
      weekday: 1,
      channels: [],
    });
    for (const patch of [
      { enabled: true },
      { summary: "daily" },
      { fallback: "email" },
      { userId: U },
      { channels: ["email", "email"] },
      { channels: ["slack"] },
      { at: "24:00" },
      { timezone: "invalid/timezone" },
      { timezone: "CST" },
      { weekday: 0 },
      { weekday: 8 },
    ])
      expect(notificationDigestSettingsSchema.safeParse(patch).success).toBe(false);
    expect(
      notificationDigestSettingsSchema.safeParse({
        enabled: true,
        frequency: "weekly",
        channels: ["email"],
        at: "08:30",
        timezone: "America/New_York",
        weekday: 7,
      }).success,
    ).toBe(true);
  });

  it("allows digest only for proved catalogue keys and keeps the canonical pending approval immediate", () => {
    for (const event of WORKFLOW_NOTIFICATION_EVENTS)
      expect(digestEventAllowed(event.key)).toBe(event.key !== "people.approval.pending");
    for (const key of [
      undefined,
      null,
      "legacy.workflow",
      "shared.approval.pending",
      "unknown",
      "constructor",
    ])
      expect(digestEventAllowed(key)).toBe(false);
  });

  it("does not add priority or follow-up to existing configs and preserves omitted workspace switches", () => {
    expect(notificationDeliveryConfigSchema.parse({ channels: ["inapp"] })).toEqual({
      channels: ["inapp"],
      fallback: "none",
    });
    const input = notificationDeliveryPolicyInputSchema.parse({});
    for (const field of ["digest_enabled", "followups_enabled", "followup_daily_limit"])
      expect(input).not.toHaveProperty(field);
    expect(notificationDeliveryPolicySchema.parse({})).toMatchObject({
      digest_enabled: false,
      followups_enabled: false,
      followup_daily_limit: 0,
    });
    expect(notificationDeliveryPolicySchema.safeParse({ followups_enabled: true }).success).toBe(
      false,
    );
    expect(
      notificationDeliveryPolicySchema.safeParse({
        followups_enabled: true,
        followup_daily_limit: 5,
      }).success,
    ).toBe(true);
  });

  it.each([0, -1, 169, 1.5, "24"])(
    "rejects unbounded or noninteger reminder/escalation hours %j",
    (hours) => {
      expect(
        notificationFollowupSchema.safeParse({
          reminder: { interval_hours: hours, max_occurrences: 1 },
        }).success,
      ).toBe(false);
      expect(
        notificationFollowupSchema.safeParse({
          escalation: { after_hours: hours, recipient: { kind: "user", id: U } },
        }).success,
      ).toBe(false);
    },
  );

  it("bounds the complete reminder horizon and resolves escalation only from one explicit existing selector", () => {
    expect(notificationFollowupSchema.safeParse(reminder).success).toBe(true);
    expect(
      notificationFollowupSchema.safeParse({
        reminder: { interval_hours: 168, max_occurrences: 1 },
      }).success,
    ).toBe(true);
    for (const followup of [
      {},
      { reminder: { interval_hours: 60, max_occurrences: 3 } },
      { reminder: { interval_hours: 1, max_occurrences: 4 } },
      { escalation: { after_hours: 1 } },
      { escalation: { after_hours: 1, recipient: [{ kind: "user", id: U }] } },
      { escalation: { after_hours: 1, recipient: { kind: "ceo" } } },
      { escalation: { after_hours: 1, recipient: { kind: "followers" } } },
    ])
      expect(notificationFollowupSchema.safeParse(followup).success).toBe(false);
  });

  it("validates the twelve closed current-state event families and requires an original in-app notice", () => {
    expect(NOTIFICATION_FOLLOWUP_EVENT_KEYS).toHaveLength(12);
    for (const key of NOTIFICATION_FOLLOWUP_EVENT_KEYS) {
      const event = WORKFLOW_NOTIFICATION_EVENTS.find((event) => event.key === key)!;
      const action =
        key === "people.approval.pending"
          ? { ...notice, recipients: [{ kind: "pending_approvers" }] }
          : notice;
      expect(
        SaveSchema.safeParse({
          name: "Follow-up",
          enabled: false,
          entity: event.entity,
          trigger: workflowNotificationEventTrigger(key),
          actions: [action],
        }).success,
      ).toBe(true);
    }
    expect(notificationFollowupProblem("crm.deal.won", notice.delivery)).toMatch(/não permite/);
    expect(
      notificationFollowupProblem("finance.payable.due", {
        ...notice.delivery,
        channels: ["email"],
      }),
    ).toMatch(/aplicativo/);
    expect(
      notificationFollowupProblem("people.approval.pending", {
        ...notice.delivery,
        followup: { escalation: { after_hours: 1, recipient: { kind: "workflow_owner" } } },
      }),
    ).toMatch(/sem escalonamento/);
  });

  it("rejects unsupported and invalid nested follow-ups as structured SaveSchema issues without hiding an earlier effect", () => {
    const actions = [
      { type: "webhook", url: "https://example.invalid" },
      { type: "branch_if", filters: [], then: [notice], else: [] },
    ];
    const input = {
      name: "Nested",
      enabled: false,
      entity: "deals",
      trigger: workflowNotificationEventTrigger("crm.deal.won"),
      actions,
    };
    expect(SaveSchema.safeParse(input).success).toBe(false);
    expect(
      notificationSchedulingActionProblem(undefined, [{ type: "legacy", actions: [notice] }]),
    ).toMatch(/não permite/);
    expect(
      SaveSchema.safeParse({
        ...input,
        actions: [
          {
            ...notice,
            delivery: {
              channels: ["inapp"],
              followup: { reminder: { interval_hours: 1, max_occurrences: 4 } },
            },
          },
        ],
      }).success,
    ).toBe(false);
  });
});

it("uses real digest and follow-up identities without accepting a forged cross-subtype job", () => {
  const transport = {
    id: U,
    token: U,
    workspaceId: U,
    recipientId: U,
    channel: "email",
    idempotencyKey: "nfd:batch:email",
    email: "test@example.test",
  };
  const digest = { ...transport, kind: "digest", batchId: U };
  expect(notificationDeliveryJobSchema.parse(digest)).toEqual(digest);
  for (const extra of [
    { workflowId: U },
    { runId: U },
    { parentIntentId: U },
    { source: {} },
    { sourceId: U },
    { sourceTable: "people" },
    { channel: "slack" },
  ])
    expect(notificationDeliveryJobSchema.safeParse({ ...digest, ...extra }).success).toBe(false);
  const original = { ...transport, workflowId: U, runId: U };
  expect(notificationDeliveryJobSchema.safeParse(original).success).toBe(true);
  expect(notificationDeliveryJobSchema.safeParse({ ...original, kind: "reminder" }).success).toBe(
    false,
  );
  expect(
    notificationDeliveryJobSchema.safeParse({ ...original, kind: "reminder", parentIntentId: U })
      .success,
  ).toBe(true);
  expect(notificationDeliveryJobSchema.safeParse({ ...original, parentIntentId: U }).success).toBe(
    false,
  );
});
