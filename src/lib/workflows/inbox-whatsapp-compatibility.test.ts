import { describe, expect, it } from "vitest";
import { INBOX_CHANNEL_EVENT_KEYS } from "./inbox-channel-events";
import { SaveSchema } from "./schemas";
import { workflowNotificationTriggerMatches } from "./notification-events";

// Frozen shape of a saved package-1 rule. Never derive this fixture from the
// current event factory: changing that factory must not redefine compatibility.
const savedWhatsAppRule = {
  name: "Aviso da conta comercial",
  entity: "whatsapp_messages",
  enabled: false,
  trigger: {
    event: "updated",
    filters: [],
    notification_event: {
      key: "shared.message.received",
      source_keys: ["cloud:aaaaaaaa-1111-4111-8111-111111111111"],
      phone_number_ids: ["123456789"],
    },
  },
  actions: [{ type: "send_notification", title: "Nova mensagem disponível" }],
};

describe("saved WhatsApp rules across the multichannel release", () => {
  it("retains the saved WhatsApp key and both source filters exactly", () => {
    expect(SaveSchema.parse(savedWhatsAppRule).trigger).toEqual(savedWhatsAppRule.trigger);
  });

  it.each(INBOX_CHANNEL_EVENT_KEYS)("does not enroll WhatsApp rules for %s", (key) => {
    expect(
      workflowNotificationTriggerMatches(SaveSchema.parse(savedWhatsAppRule).trigger, {
        entity: "inbox_channel_occurrences",
        notification_event_key: key,
        after: {
          direction: "inbound",
          channel: key.split(".")[1],
          account_id: "bbbbbbbb-1111-4111-8111-111111111111",
          // Even metadata resembling a WhatsApp source cannot change the origin.
          source_key: savedWhatsAppRule.trigger.notification_event.source_keys[0],
          phone_number_id: "123456789",
        },
      }),
    ).toBe(false);
  });

  it("retains the original account boundary for a real WhatsApp event", () => {
    const trigger = SaveSchema.parse(savedWhatsAppRule).trigger;
    const event = {
      entity: "whatsapp_messages" as const,
      notification_event_key: "shared.message.received",
      after: {
        direction: "inbound",
        source_key: "cloud:aaaaaaaa-1111-4111-8111-111111111111",
        phone_number_id: "123456789",
      },
    };
    expect(workflowNotificationTriggerMatches(trigger, event)).toBe(true);
    expect(
      workflowNotificationTriggerMatches(trigger, {
        ...event,
        after: { ...event.after, source_key: "cloud:cccccccc-1111-4111-8111-111111111111" },
      }),
    ).toBe(false);
  });
});
