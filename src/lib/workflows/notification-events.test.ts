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
  notificationEventActionProblem,
  notificationEventConfigurationProblem,
  workflowNotificationEventFields,
  workflowNotificationEventFieldAllowed,
} from "./notification-events";

const workflow = {
  name: "Aviso comercial",
  enabled: false,
  actions: [
    {
      type: "send_notification",
      title: "Atualização disponível",
      recipients: [{ kind: "pending_approvers" }],
    },
  ],
};

describe("explicit business notification selectors", () => {
  it("preserves all twenty-four events in order and appends the thirteen supported Inbox events", () => {
    expect(WORKFLOW_NOTIFICATION_EVENTS.map(({ key }) => key)).toEqual([
      ...WORKFLOW_NOTIFICATION_EVENT_KEYS,
    ]);
    expect(WORKFLOW_NOTIFICATION_EVENTS).toHaveLength(37);
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
    expect(WORKFLOW_NOTIFICATION_EVENT_KEYS.slice(8, 12)).toEqual([
      "projects.project.started",
      "projects.project.overdue",
      "projects.task.overdue",
      "projects.milestone.due",
    ]);
    expect(WORKFLOW_NOTIFICATION_EVENT_KEYS.slice(12, 18)).toEqual([
      "ats.application.received",
      "ats.interview.scheduled",
      "ats.offer.accepted",
      "people.employment.started",
      "people.document.expiring",
      "people.approval.pending",
    ]);
    expect(WORKFLOW_NOTIFICATION_EVENT_KEYS.slice(18, 24)).toEqual([
      "finance.payable.due",
      "finance.receivable.due",
      "finance.payable.overdue",
      "finance.receivable.overdue",
      "finance.invoice.received",
      "shared.message.received",
    ]);
    expect(WORKFLOW_NOTIFICATION_EVENT_KEYS.slice(24)).toEqual([
      "shared.email.message_received",
      "shared.email.conversation_created",
      "shared.email.conversation_assigned",
      "shared.email.first_response",
      "shared.chat.message_received",
      "shared.chat.conversation_created",
      "shared.chat.conversation_assigned",
      "shared.chat.conversation_status_changed",
      "shared.chat.first_response",
      "shared.linkedin.message_received",
      "shared.linkedin.conversation_created",
      "shared.linkedin.conversation_status_changed",
      "shared.linkedin.first_response",
    ]);
    expect(getWorkflowNotificationEvent("crm.quote.accepted")).toBeNull();
    expect(getWorkflowNotificationEvent("constructor")).toBeNull();
    expect(getWorkflowNotificationEvent("shared.approval.pending")).toBeNull();
  });

  it("keeps the active catalogue and workflow registry aligned on keys, labels, modules and source entities", () => {
    const active = NOTIFICATION_EVENT_CATALOG.filter(
      (event) =>
        event.availability === "active" &&
        ["crm", "contracts", "projects", "ats", "people", "finance"].includes(
          event.moduleKey ?? "",
        ),
    );
    expect(active.map(({ eventKey }) => eventKey).sort()).toEqual(
      [...WORKFLOW_NOTIFICATION_EVENT_KEYS].sort(),
    );
    const expectedSources: Record<string, string> = {
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
      "ats.application.received": "ats_applications",
      "ats.interview.scheduled": "ats_interviews",
      "ats.offer.accepted": "ats_offers",
      "people.employment.started": "people",
      "people.document.expiring": "people_documents",
      "people.approval.pending": "hiring_preparation_requests",
      "finance.payable.due": "financial_entries",
      "finance.receivable.due": "financial_entries",
      "finance.payable.overdue": "financial_entries",
      "finance.receivable.overdue": "financial_entries",
      "finance.invoice.received": "hiring_fiscal_documents",
      "shared.message.received": "whatsapp_messages",
      "shared.email.message_received": "inbox_channel_occurrences",
      "shared.email.conversation_created": "inbox_channel_occurrences",
      "shared.email.conversation_assigned": "inbox_channel_occurrences",
      "shared.email.first_response": "inbox_channel_occurrences",
      "shared.chat.message_received": "inbox_channel_occurrences",
      "shared.chat.conversation_created": "inbox_channel_occurrences",
      "shared.chat.conversation_assigned": "inbox_channel_occurrences",
      "shared.chat.conversation_status_changed": "inbox_channel_occurrences",
      "shared.chat.first_response": "inbox_channel_occurrences",
      "shared.linkedin.message_received": "inbox_channel_occurrences",
      "shared.linkedin.conversation_created": "inbox_channel_occurrences",
      "shared.linkedin.conversation_status_changed": "inbox_channel_occurrences",
      "shared.linkedin.first_response": "inbox_channel_occurrences",
    };
    for (const definition of WORKFLOW_NOTIFICATION_EVENTS) {
      expect(active.find(({ eventKey }) => eventKey === definition.key)).toMatchObject({
        eventKey: definition.key,
        label: definition.label,
        moduleKey: definition.moduleKey,
      });
      expect(definition.entity).toBe(expectedSources[definition.key]);
      expect(definition.moduleKey).toBe(
        definition.key.startsWith("shared.") ? "crm" : definition.key.split(".")[0],
      );
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
          ...(event.key === "shared.message.received"
            ? {
                after: {
                  direction: "inbound",
                  source_key: "cloud:aaaaaaaa-1111-4111-8111-111111111111",
                  phone_number_id: "123456",
                },
              }
            : event.entity === "inbox_channel_occurrences"
              ? {
                  after: {
                    channel: event.key.split(".")[1],
                    account_id: "bbbbbbbb-1111-4111-8111-111111111111",
                    event_key: event.key,
                  },
                }
              : {}),
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
    "people.document.expiring",
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
    "ats_offers",
    "people_documents",
    "hiring_preparation_requests",
    "hiring_fiscal_documents",
    "whatsapp_messages",
  ] as const)(
    "rejects a forged generic or timed selector on the new read-only source %s",
    (entity) => {
      expect(
        SaveSchema.safeParse({ ...workflow, entity, trigger: { event: "updated", filters: [] } })
          .success,
      ).toBe(false);
      expect(workflowNotificationTriggerMatches({}, { entity })).toBe(false);
      expect(
        SaveSchema.safeParse({
          ...workflow,
          entity,
          trigger: {
            event: "updated",
            time_based: { kind: "time_since_field", amount: 1, unit: "days" },
          },
        }).success,
      ).toBe(false);
      expect(() =>
        SaveSchema.parse({
          ...workflow,
          entity: "leads",
          trigger: { event: "updated" },
          actions: [
            {
              type: "update_record",
              table: entity,
              target_id: "id",
              values: { status: "changed" },
            },
          ],
        }),
      ).toThrow();
    },
  );

  it("requires the released approver throughout nested actions and preserves same-person channel fallback", () => {
    const trigger = workflowNotificationEventTrigger("people.approval.pending");
    const save = (actions: unknown[]) =>
      SaveSchema.safeParse({
        ...workflow,
        entity: "hiring_preparation_requests",
        trigger,
        actions,
      });
    const notice = {
      type: "send_notification",
      title: "Revisão disponível",
      recipients: [{ kind: "pending_approvers" }],
      delivery: { channels: ["whatsapp"], fallback: "email" },
    };
    expect(save([notice]).success).toBe(true);
    expect(save([{ ...notice, recipients: [{ kind: "workflow_owner" }] }]).success).toBe(false);
    expect(save([{ ...notice, user_id: "11111111-1111-4111-8111-111111111111" }]).success).toBe(
      false,
    );
    expect(
      save([
        {
          type: "branch_if",
          filters: [],
          then: [notice],
          else: [{ ...notice, recipients: [{ kind: "source_responsible" }] }],
        },
      ]).success,
    ).toBe(false);
    expect(
      save([
        {
          type: "parallel",
          join: "all",
          branches: [
            { actions: [notice] },
            { actions: [{ type: "send_slack", text: "Revisão", channel: "geral" }] },
          ],
        },
      ]).success,
    ).toBe(false);
    expect(
      notificationEventActionProblem("people.approval.pending", [
        { type: "switch_by_value", cases: [{ actions: [{ type: "send_email" }] }], default: [] },
      ]),
    ).toMatch(/somente envia/);
    expect(
      notificationEventActionProblem("people.employment.started", [{ type: "send_slack" }]),
    ).toBeNull();
    expect(
      notificationEventActionProblem("people.approval.pending", [
        {
          type: "legacy_container",
          actions: [{ type: "parallel", branches: [{ actions: [{ type: "send_email" }] }] }],
        },
      ]),
    ).toMatch(/somente envia/);
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

describe("minimal financial notification configuration", () => {
  const key = "finance.payable.due";
  const notice = {
    type: "send_notification",
    title: "Consulte {{due_date}}",
    recipients: [{ kind: "source_responsible" }],
  };
  const save = (patch: Record<string, unknown> = {}) =>
    SaveSchema.safeParse({
      ...workflow,
      entity: "financial_entries",
      trigger: workflowNotificationEventTrigger(key),
      actions: [notice],
      ...patch,
    });

  it("offers only fields the financial projection actually supplies and preserves generic catalogues", () => {
    const fields = workflowNotificationEventFields(key)!;
    expect(fields).toContain("direction");
    expect(fields).toContain("due_date");
    for (const field of [
      "amount",
      "paid_amount",
      "description",
      "notes",
      "metadata",
      "bank_account_id",
      "company.name",
      "paid_at",
    ])
      expect(workflowNotificationEventFieldAllowed(key, field)).toBe(false);
    expect(workflowNotificationEventFields(undefined)).toBeNull();
    expect(workflowNotificationEventFieldAllowed(undefined, "amount")).toBe(true);
    expect(workflowNotificationEventFields("finance.invoice.received")).toContain("registered_at");
    expect(workflowNotificationEventFields("finance.invoice.received")).not.toContain(
      "document_number",
    );
    expect(save().success).toBe(true);
    expect(
      save({ trigger: { event: "updated", filters: [{ field: "amount", op: "gt", value: 10 }] } })
        .success,
    ).toBe(true);
  });

  it.each([
    "finance.payable.due",
    "finance.receivable.due",
    "finance.payable.overdue",
    "finance.receivable.overdue",
    "finance.invoice.received",
  ] as const)("uses the canonical %s without user invented timer offsets", (eventKey) => {
    expect(workflowNotificationEventTrigger(eventKey).notification_event).toEqual({
      key: eventKey,
    });
    expect(
      notificationEventSelectionSchema.safeParse({ key: eventKey, days_before: 1 }).success,
    ).toBe(false);
    expect(
      TriggerSchema.safeParse({
        ...workflowNotificationEventTrigger(eventKey),
        time_based: { kind: "time_since_field", amount: 1, unit: "days" },
      }).success,
    ).toBe(false);
  });

  it.each(["eq", "neq", "is_empty", "is_not_empty", "changed_to"])(
    "rejects a missing financial field before evaluating nested %s conditions",
    (op) => {
      const trigger = {
        ...workflowNotificationEventTrigger(key),
        filters: [{ logic: "or", conditions: [{ field: "amount", op, value: 0 }] }],
      };
      expect(save({ trigger }).success).toBe(false);
      expect(
        save({
          trigger: {
            ...workflowNotificationEventTrigger(key),
            goal_filters: [{ field: "bank_account.name", op: "is_empty" }],
          },
        }).success,
      ).toBe(false);
      expect(
        save({
          actions: [
            {
              type: "branch_if",
              filters: [{ field: "notes", op: "is_empty" }],
              then: [notice],
              else: [],
            },
          ],
        }).success,
      ).toBe(false);
      expect(
        save({
          actions: [
            {
              type: "branch_multi",
              branches: [
                { filters: [{ field: "metadata.amount", op: "is_empty" }], actions: [notice] },
              ],
              else: [],
            },
          ],
        }).success,
      ).toBe(false);
    },
  );

  it("accepts public technical and Portuguese date tokens but rejects private aliases and nested reads", () => {
    expect(
      save({
        actions: [
          { ...notice, title: "{{due_date}} {{vence_em}} {{status}} {{variaveis.message}}" },
        ],
      }).success,
    ).toBe(true);
    for (const path of [
      "amount",
      "valor",
      "notes",
      "metadados_tecnicos.counterparty_name",
      "company.name",
      "bank_account.name",
    ])
      expect(save({ actions: [{ ...notice, title: `Unavailable {{${path}}}` }] }).success).toBe(
        false,
      );
    expect(
      save({
        actions: [{ type: "switch_by_value", field: "amount", cases: [], default: [notice] }],
      }).success,
    ).toBe(false);
    expect(
      save({
        actions: [
          {
            type: "format_data",
            op: "number_round",
            source_field: "paid_amount",
            target_var: "paid",
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      notificationEventConfigurationProblem(key, {
        goal_filters: [{ field: "amount", op: "is_empty" }],
      }),
    ).toMatch(/Campo indisponível/);
  });

  it.each([
    { type: "increment_field", field: "amount", amount: 1 },
    { type: "set_field", field: "notes", value: "changed" },
    { type: "assign_to", user_id: "user" },
    { type: "associate_records", association: "company", target_id: "id" },
    { type: "update_record", table: "financial_entries", target_id: "id", values: { amount: 1 } },
    { type: "create_record", table: "bank_payments", values: { amount: 1 } },
    { type: "delete_record", table: "financial_entries", target_id: "id" },
  ])("rejects named financial mutations, including hidden legacy containers: $type", (action) => {
    expect(
      notificationEventActionProblem(key, [
        { type: "legacy", actions: [{ type: "parallel", branches: [{ actions: [action] }] }] },
      ]),
    ).toMatch(/operação financeira canônica/);
    expect(notificationEventActionProblem(undefined, [action])).toBeNull();
  });
});

it.each([
  { type: "create_payable_schedule", amount: "10" },
  { type: "create_receivable_invoice", amount: "10" },
  { type: "cancel_payable_schedules" },
])("rejects the legacy financial effect alias $type only in named Finance", (action) => {
  const base = {
    name: "Configured financial effect",
    enabled: false,
    entity: "financial_entries",
    actions: [action],
  };
  expect(
    SaveSchema.safeParse({
      ...base,
      trigger: workflowNotificationEventTrigger("finance.payable.due"),
    }).success,
  ).toBe(false);
  expect(SaveSchema.safeParse({ ...base, trigger: { event: "updated" } }).success).toBe(true);
  expect(
    SaveSchema.safeParse({
      ...base,
      trigger: workflowNotificationEventTrigger("finance.payable.due"),
      actions: [{ type: "branch_if", filters: [], then: [action], else: [] }],
    }).success,
  ).toBe(false);
  expect(
    notificationEventActionProblem("finance.invoice.received", [
      { type: "legacy", actions: [action] },
    ]),
  ).toMatch(/operação financeira canônica/);
});
