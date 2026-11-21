import { describe, expect, it } from "vitest";
import { SaveSchema } from "./schemas";
import {
  notificationEventSelectionSchema,
  workflowNotificationEventFields,
  workflowNotificationEventTrigger,
  workflowNotificationTriggerMatches,
  notificationEventConfigurationProblem,
} from "./notification-events";
import { ENTITY_GROUPS, WORKFLOW_WRITABLE_TABLES, isWorkflowReadonlySource } from "./types";
import { buildTextTokens } from "./token-catalog";
import { resolveWorkflowTokenPath } from "./token-aliases";

const KEY = "shared.message.received" as const;
const CLOUD = "cloud:aaaaaaaa-1111-4111-8111-111111111111";
const LOVABLE = "lovable:bbbbbbbb-2222-4222-8222-222222222222";
const after = {
  direction: "inbound",
  source_key: CLOUD,
  phone_number_id: "123456789",
  provider: "cloud",
};
const event = { entity: "whatsapp_messages" as const, notification_event_key: KEY, after };
const workflow = {
  name: "Avisar recebimento",
  entity: "whatsapp_messages",
  enabled: false,
  trigger: workflowNotificationEventTrigger(KEY),
  actions: [
    {
      type: "send_notification",
      title: "Mensagem recebida",
      recipients: [{ kind: "source_responsible" }],
    },
  ],
};

describe("WhatsApp reception selection", () => {
  it("registers an explicitly named read-only Inbox source without making messages generically writable", () => {
    expect(ENTITY_GROUPS.find((group) => group.label === "Atendimento")?.entities).toContain(
      "whatsapp_messages",
    );
    expect(isWorkflowReadonlySource("whatsapp_messages")).toBe(true);
    expect(WORKFLOW_WRITABLE_TABLES).not.toContain("whatsapp_messages");
    expect(SaveSchema.parse(workflow).trigger.notification_event?.key).toBe(KEY);
    expect(SaveSchema.safeParse({ ...workflow, trigger: { event: "created" } }).success).toBe(
      false,
    );
  });

  it("preserves explicit account and number intersections including an empty any-authorized selection", () => {
    const selection = {
      key: KEY,
      source_keys: [CLOUD, LOVABLE],
      phone_number_ids: ["123456789", "987654321"],
    };
    expect(notificationEventSelectionSchema.parse(selection)).toEqual(selection);
    expect(
      notificationEventSelectionSchema.parse({ key: KEY, source_keys: [], phone_number_ids: [] }),
    ).toEqual({ key: KEY, source_keys: [], phone_number_ids: [] });
    expect(notificationEventSelectionSchema.parse({ key: KEY })).toEqual({ key: KEY });
  });

  it.each([
    { source_keys: ["cloud:invalid"] },
    { source_keys: ["other:aaaaaaaa-1111-4111-8111-111111111111"] },
    { source_keys: [CLOUD, CLOUD] },
    { phone_number_ids: ["+55 48 3012-1055"] },
    { phone_number_ids: [123456789] },
    { phone_number_ids: ["1234"] },
    { phone_number_ids: ["123456789", "123456789"] },
    { phone_number_ids: Array.from({ length: 101 }, (_, i) => `12345${i}`) },
    { days_before: 1 },
    { channel: "email" },
  ])("rejects malformed or invented reception selection %j", (filters) => {
    expect(notificationEventSelectionSchema.safeParse({ key: KEY, ...filters }).success).toBe(
      false,
    );
  });

  it("keeps WhatsApp filters off all unrelated events", () => {
    for (const key of ["crm.deal.won", "finance.invoice.received", "ats.application.received"])
      for (const filters of [
        { source_keys: [] },
        { source_keys: [CLOUD] },
        { phone_number_ids: [] },
        { phone_number_ids: ["123456789"] },
      ])
        expect(notificationEventSelectionSchema.safeParse({ key, ...filters }).success).toBe(false);
  });

  it("matches inbound metadata only when both selected account and number agree", () => {
    const trigger = {
      notification_event: { key: KEY, source_keys: [CLOUD], phone_number_ids: ["123456789"] },
    };
    expect(workflowNotificationTriggerMatches(trigger, event)).toBe(true);
    expect(
      workflowNotificationTriggerMatches(trigger, {
        ...event,
        after: { ...after, source_key: LOVABLE },
      }),
    ).toBe(false);
    expect(
      workflowNotificationTriggerMatches(trigger, {
        ...event,
        after: { ...after, phone_number_id: "987654321" },
      }),
    ).toBe(false);
    expect(workflowNotificationTriggerMatches({ notification_event: { key: KEY } }, event)).toBe(
      true,
    );
    expect(
      workflowNotificationTriggerMatches(
        { notification_event: { key: KEY, source_keys: [], phone_number_ids: [] } },
        event,
      ),
    ).toBe(true);
  });

  it("refuses generic, outbound, incomplete and forged public envelope shapes before proof validation", () => {
    const trigger = workflowNotificationEventTrigger(KEY);
    expect(workflowNotificationTriggerMatches({}, event)).toBe(false);
    expect(
      workflowNotificationTriggerMatches(trigger, { ...event, notification_event_key: undefined }),
    ).toBe(false);
    for (const payload of [
      undefined,
      [],
      null,
      {},
      { ...after, direction: "outbound" },
      { ...after, source_key: "forged" },
      { ...after, phone_number_id: null },
    ])
      expect(workflowNotificationTriggerMatches(trigger, { ...event, after: payload })).toBe(false);
    expect(workflowNotificationTriggerMatches(trigger, { ...event, entity: "leads" })).toBe(false);
  });

  it("offers safe source metadata and rejects raw conversation content in filters and templates", () => {
    const fields = workflowNotificationEventFields(KEY)!;
    for (const field of [
      "id",
      "conversation_id",
      "source_key",
      "phone_number_id",
      "provider",
      "occurred_at",
      "message_type",
      "assigned_to",
    ])
      expect(fields).toContain(field);
    for (const field of [
      "body",
      "raw",
      "from_number",
      "to_number",
      "media_url",
      "contact_phone",
      "credentials_ciphertext",
    ]) {
      expect(fields).not.toContain(field);
      expect(
        notificationEventConfigurationProblem(KEY, {
          trigger: { filters: [{ field, op: "is_not_empty" }] },
        }),
      ).not.toBeNull();
      expect(
        notificationEventConfigurationProblem(KEY, {
          actions: [{ type: "send_notification", title: `{{${field}}}` }],
        }),
      ).not.toBeNull();
    }
  });

  it("inserts Portuguese safe metadata tokens that resolve to the canonical snapshot", () => {
    const fields = [
      { name: "source_key", label: "Conta de origem" },
      { name: "occurred_at", label: "Recebida em" },
      { name: "message_type", label: "Tipo de mensagem" },
      { name: "provider", label: "Integração de origem" },
    ];
    const tokens = buildTextTokens(fields, [], "whatsapp_messages");
    expect(tokens.map((token) => token.token)).toEqual([
      "{{conta_de_origem}}",
      "{{recebida_em}}",
      "{{tipo_mensagem}}",
      "{{integracao_de_origem}}",
    ]);
    const snapshot = {
      source_key: CLOUD,
      occurred_at: "2026-11-21T12:00:00Z",
      message_type: "text",
      provider: "cloud",
    };
    for (const [i, token] of tokens.entries())
      expect(resolveWorkflowTokenPath(snapshot, token.token.slice(2, -2))).toBe(fields[i].name);
  });

  it.each([
    "set_field",
    "clear_field",
    "assign_to",
    "rotate_assign",
    "send_whatsapp",
    "send_email",
    "handoff",
    "sdr_agent",
    "add_to_sequence",
  ])("refuses source-dependent action %s even nested below controls", (type) => {
    expect(
      notificationEventConfigurationProblem(KEY, {
        actions: [{ type: "branch_if", then: [{ type, field: "body", value: "rewrite" }] }],
      }),
    ).not.toBeNull();
  });

  it("permits independent canonical tasks and protected notifications without mutating the received message", () => {
    expect(
      SaveSchema.safeParse({
        ...workflow,
        actions: [
          { type: "create_task", subject: "Conferir mensagem recebida" },
          ...workflow.actions,
        ],
      }).success,
    ).toBe(true);
    expect(
      notificationEventConfigurationProblem(KEY, {
        trigger: { filters: [{ field: "provider", op: "eq", value: "cloud" }] },
        actions: workflow.actions,
      }),
    ).toBeNull();
  });
});
