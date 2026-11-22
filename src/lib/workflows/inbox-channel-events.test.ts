import { describe, expect, it } from "vitest";
import {
  inboxEventChannel,
  INBOX_CHANNEL_EVENT_KEYS,
  INBOX_CHANNEL_RUNTIME_READY,
} from "./inbox-channel-events";
import {
  notificationEventSelectionSchema,
  workflowNotificationTriggerMatches,
  notificationEventConfigurationProblem,
} from "./notification-events";
import { projectWorkflowSnapshot } from "./engine/authorization.server";
const account = "10000000-0000-4000-8000-000000000001";
describe("explicit Inbox channel events", () => {
  it("offers the reviewed runtime in the released build", () => {
    expect(INBOX_CHANNEL_RUNTIME_READY).toBe(true);
  });
  it("keeps shared.message.received WhatsApp only", () => {
    expect(inboxEventChannel("shared.message.received")).toBeNull();
    expect(
      workflowNotificationTriggerMatches(
        { notification_event: { key: "shared.message.received" } },
        {
          entity: "inbox_channel_occurrences",
          notification_event_key: "shared.email.message_received",
        },
      ),
    ).toBe(false);
  });
  it("never offers invented email status or LinkedIn assignment", () => {
    expect(INBOX_CHANNEL_EVENT_KEYS).not.toContain("shared.linkedin.conversation_assigned");
    expect(INBOX_CHANNEL_EVENT_KEYS).not.toContain("shared.email.conversation_status_changed");
  });
  it("matches only the selected channel and account", () => {
    const trigger = {
      notification_event: { key: "shared.email.message_received" as const, account_ids: [account] },
    };
    const event = {
      entity: "inbox_channel_occurrences" as const,
      notification_event_key: "shared.email.message_received",
      after: { channel: "email", account_id: account, event_key: "shared.email.message_received" },
    };
    expect(workflowNotificationTriggerMatches(trigger, event)).toBe(true);
    expect(
      workflowNotificationTriggerMatches(trigger, {
        ...event,
        after: { ...event.after, channel: "chat" },
      }),
    ).toBe(false);
    expect(
      workflowNotificationTriggerMatches(trigger, {
        ...event,
        after: { ...event.after, account_id: "foreign" },
      }),
    ).toBe(false);
  });
  it("rejects incompatible channel account and WhatsApp filters", () => {
    expect(
      notificationEventSelectionSchema.safeParse({
        key: "shared.email.message_received",
        channel: "chat",
      }).success,
    ).toBe(false);
    expect(
      notificationEventSelectionSchema.safeParse({
        key: "shared.message.received",
        account_ids: [account],
      }).success,
    ).toBe(false);
    expect(
      notificationEventSelectionSchema.safeParse({
        key: "shared.email.message_received",
        phone_number_ids: ["123456"],
      }).success,
    ).toBe(false);
  });
  it("removes private bodies and proofs from snapshots", () => {
    expect(
      projectWorkflowSnapshot(
        { id: account, channel: "chat", body: "private", envelope_id: account, cookie: "private" },
        "inbox_channel_occurrences",
        "shared.chat.message_received",
      ),
    ).toEqual({ id: account, channel: "chat" });
    expect(
      notificationEventConfigurationProblem("shared.email.message_received", [
        { type: "send_email" },
      ]),
    ).not.toBeNull();
    expect(
      notificationEventConfigurationProblem("shared.email.message_received", [
        { type: "send_notification", title: "{{body}}" },
      ]),
    ).not.toBeNull();
  });
  it.each(INBOX_CHANNEL_EVENT_KEYS)(
    "never projects customer content or proof secrets for %s",
    (key) => {
      expect(
        projectWorkflowSnapshot(
          {
            id: account,
            channel: inboxEventChannel(key),
            event_key: key,
            body: "private message",
            body_text: "private message",
            body_html: "private message",
            subject: "private subject",
            sender_email: "private@example.invalid",
            phone: "+12025550123",
            attachments: [{ url: "https://example.invalid/private" }],
            envelope_id: account,
            envelope_hash: "private proof",
            raw_payload: { private: true },
            access_token: "synthetic credential",
            visitor_id: "synthetic visitor capability",
          },
          "inbox_channel_occurrences",
          key,
        ),
      ).toEqual({
        id: account,
        channel: inboxEventChannel(key),
        event_key: key,
      });
    },
  );
  it.each(INBOX_CHANNEL_EVENT_KEYS)(
    "rejects nested private reads and direct source mutations for %s",
    (key) => {
      for (const field of ["body", "subject", "sender_email", "envelope_hash", "raw_payload"]) {
        expect(
          notificationEventConfigurationProblem(key, [
            {
              type: "if_else",
              then: [{ type: "send_notification", title: `{{${field}}}` }],
            },
          ]),
        ).not.toBeNull();
      }
      for (const type of ["create_record", "update_record", "delete_record"]) {
        expect(
          notificationEventConfigurationProblem(key, [
            {
              type: "if_else",
              else: [{ type, table: "inbox_channel_occurrences" }],
            },
          ]),
        ).not.toBeNull();
      }
    },
  );
});
