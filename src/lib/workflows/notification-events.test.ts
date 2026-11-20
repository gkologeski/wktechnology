import { describe, expect, it } from "vitest";
import { SaveSchema, TriggerSchema } from "./schemas";
import { NOTIFICATION_EVENT_CATALOG } from "@/lib/notification-catalog";
import {
  WORKFLOW_NOTIFICATION_EVENTS,
  WORKFLOW_NOTIFICATION_EVENT_KEYS,
  getWorkflowNotificationEvent,
  notificationEventSelectionSchema,
  workflowNotificationEventTrigger,
  workflowNotificationTriggerLabel,
  workflowNotificationTriggerMatches,
} from "./notification-events";

const workflow = {
  name: "Aviso comercial",
  enabled: false,
  actions: [{ type: "send_notification", title: "Atualização disponível" }],
};

describe("explicit business notification selectors", () => {
  it("preserves the eight commercial events and adds only the four project events", () => {
    expect(WORKFLOW_NOTIFICATION_EVENTS.map(({ key }) => key)).toEqual([
      ...WORKFLOW_NOTIFICATION_EVENT_KEYS,
    ]);
    expect(WORKFLOW_NOTIFICATION_EVENTS).toHaveLength(12);
    expect(WORKFLOW_NOTIFICATION_EVENT_KEYS.slice(0, 8)).toEqual([
      "crm.deal.won",
      "crm.deal.lost",
      "crm.deal.stage_changed",
      "crm.proposal.accepted",
      "contracts.draft.accepted",
      "contracts.signature.completed",
      "contracts.contract.expiring",
      "contracts.contract.renewal_due",
    ]);
    expect(WORKFLOW_NOTIFICATION_EVENT_KEYS.slice(8)).toEqual([
      "projects.project.started",
      "projects.project.overdue",
      "projects.task.overdue",
      "projects.milestone.due",
    ]);
    expect(getWorkflowNotificationEvent("crm.quote.accepted")).toBeNull();
    expect(getWorkflowNotificationEvent("constructor")).toBeNull();
    expect(getWorkflowNotificationEvent("finance.payable.due")).toBeNull();
  });

  it("keeps the active catalogue and workflow registry aligned on keys, labels, modules and source entities", () => {
    const active = NOTIFICATION_EVENT_CATALOG.filter(
      (event) =>
        event.availability === "active" &&
        ["crm", "contracts", "projects"].includes(event.moduleKey ?? ""),
    );
    expect(active.map(({ eventKey }) => eventKey).sort()).toEqual(
      [...WORKFLOW_NOTIFICATION_EVENT_KEYS].sort(),
    );
    const expectedSources = {
      "crm.deal.won": "deals",
      "crm.deal.lost": "deals",
      "crm.deal.stage_changed": "deals",
      "crm.proposal.accepted": "proposals",
      "contracts.draft.accepted": "deals",
      "contracts.signature.completed": "contracts",
      "contracts.contract.expiring": "contracts",
      "contracts.contract.renewal_due": "contracts",
      "projects.project.started": "projects",
      "projects.project.overdue": "projects",
      "projects.task.overdue": "project_tasks",
      "projects.milestone.due": "project_milestones",
    };
    for (const definition of WORKFLOW_NOTIFICATION_EVENTS) {
      expect(active.find(({ eventKey }) => eventKey === definition.key)).toMatchObject({
        eventKey: definition.key,
        label: definition.label,
        moduleKey: definition.moduleKey,
      });
      expect(definition.entity).toBe(expectedSources[definition.key]);
      expect(definition.moduleKey).toBe(definition.key.split(".")[0]);
      expect(definition.deadline).toBe(definition.scheduling === "before_due");
    }
  });

  it.each(WORKFLOW_NOTIFICATION_EVENTS)(
    "builds and validates an explicit editable selector for $key",
    (event) => {
      const trigger = workflowNotificationEventTrigger(event.key);
      const saved = SaveSchema.parse({ ...workflow, entity: event.entity, trigger });
      expect(saved.enabled).toBe(false);
      expect(saved.trigger.notification_event).toEqual({
        key: event.key,
        ...(event.deadline ? { days_before: 30 } : {}),
      });
      expect(workflowNotificationTriggerLabel(trigger)).toBe(event.label);
      expect(
        workflowNotificationTriggerMatches(trigger, {
          entity: event.entity,
          notification_event_key: event.key,
        }),
      ).toBe(true);
    },
  );

  it.each(WORKFLOW_NOTIFICATION_EVENTS)("rejects an unrelated source entity for $key", (event) => {
    expect(
      SaveSchema.safeParse({
        ...workflow,
        entity: "leads",
        trigger: workflowNotificationEventTrigger(event.key),
      }).success,
    ).toBe(false);
  });

  it.each([
    "contracts.contract.expiring",
    "contracts.contract.renewal_due",
    "projects.milestone.due",
  ] as const)("requires an explicit bounded notice window for %s", (key) => {
    for (const days_before of [undefined, 0, -1, 366, 1.5, "30", null])
      expect(notificationEventSelectionSchema.safeParse({ key, days_before }).success).toBe(false);
    expect(workflowNotificationEventTrigger(key, 1).notification_event?.days_before).toBe(1);
    expect(workflowNotificationEventTrigger(key, 365).notification_event?.days_before).toBe(365);
  });

  it.each([
    "projects.project.started",
    "projects.project.overdue",
    "projects.task.overdue",
  ] as const)(
    "rejects invented timer parameters on %s while retaining the canonical scheduling mode",
    (key) => {
      expect(notificationEventSelectionSchema.safeParse({ key }).success).toBe(true);
      for (const extra of [
        { days_before: 1 },
        { days_after: 1 },
        { recurrence: "daily" },
        { timezone: "UTC" },
      ])
        expect(notificationEventSelectionSchema.safeParse({ key, ...extra }).success).toBe(false);
      expect(
        TriggerSchema.safeParse({
          ...workflowNotificationEventTrigger(key),
          time_based: { kind: "time_since_field", amount: 1, unit: "days" },
        }).success,
      ).toBe(false);
      expect(getWorkflowNotificationEvent(key)?.scheduling).toBe(
        key.endsWith("started") ? "transition" : "overdue",
      );
    },
  );

  it("does not accept notice windows on a transition, ambiguous timers or arbitrary selector properties", () => {
    expect(
      notificationEventSelectionSchema.safeParse({ key: "crm.deal.won", days_before: 30 }).success,
    ).toBe(false);
    expect(
      notificationEventSelectionSchema.safeParse({ key: "crm.deal.won", source_id: "untrusted" })
        .success,
    ).toBe(false);
    expect(
      TriggerSchema.safeParse({
        ...workflowNotificationEventTrigger("contracts.contract.expiring"),
        time_based: { kind: "time_since_field", amount: 1, unit: "days" },
      }).success,
    ).toBe(false);
  });

  it("never maps a named public column to a generic trigger or a different named selector", () => {
    const trigger = workflowNotificationEventTrigger("crm.deal.won");
    expect(
      workflowNotificationTriggerMatches(
        {},
        { entity: "deals", notification_event_key: "crm.deal.won" },
      ),
    ).toBe(false);
    expect(workflowNotificationTriggerMatches(trigger, { entity: "deals" })).toBe(false);
    expect(
      workflowNotificationTriggerMatches(trigger, {
        entity: "deals",
        notification_event_key: "crm.deal.lost",
      }),
    ).toBe(false);
    expect(
      workflowNotificationTriggerMatches(trigger, {
        entity: "contracts",
        notification_event_key: "crm.deal.won",
      }),
    ).toBe(false);
    expect(workflowNotificationTriggerMatches({}, { entity: "deals" })).toBe(true);
    expect(workflowNotificationTriggerLabel({})).toBeNull();
  });

  it("retains ordinary CRUD workflow configuration without adding a business selector", () => {
    const saved = SaveSchema.parse({
      ...workflow,
      entity: "deals",
      trigger: { event: "stage_changed", filters: [] },
    });
    expect(saved.trigger).not.toHaveProperty("notification_event");
  });

  it.each([
    { notification_event: null },
    { notification_event: { key: "unknown" } },
    { notification_event: { key: "contracts.contract.expiring" } },
  ])(
    "labels a malformed explicit selector as requiring review instead of generic CRUD: %j",
    (trigger) => {
      expect(workflowNotificationTriggerLabel(trigger as never)).toBe(
        "Evento de negócio requer revisão",
      );
    },
  );
});
