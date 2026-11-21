import { z } from "zod";
import {
  NOTIFICATION_CATEGORIES,
  resolveNotificationRecordEvent,
  type NotificationCategory,
} from "./notification-catalog";

export type NotificationChannels = {
  inapp: boolean;
  email: boolean;
  sound: boolean;
  shake: boolean;
};
export type NotificationPrefs = Record<NotificationCategory, NotificationChannels>;
const quiet: NotificationChannels = { inapp: true, email: false, sound: false, shake: false };

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  mention: { inapp: true, email: true, sound: true, shake: true },
  assignment: { inapp: true, email: true, sound: true, shake: true },
  deal_stage: { ...quiet },
  ticket: { inapp: true, email: true, sound: true, shake: true },
  task: { inapp: true, email: false, sound: true, shake: false },
  sla: { inapp: true, email: true, sound: true, shake: true },
  message: { inapp: true, email: false, sound: true, shake: true },
  workflow: { ...quiet },
  approval: { ...quiet },
  hiring: { ...quiet },
  form: { ...quiet },
  portfolio: { ...quiet },
  platform: { ...quiet },
};

const channelPatch = z
  .object({
    inapp: z.boolean().optional(),
    email: z.boolean().optional(),
    sound: z.boolean().optional(),
    shake: z.boolean().optional(),
  })
  .strict();
export const notificationPrefsPatchSchema = z
  .object(
    Object.fromEntries(
      NOTIFICATION_CATEGORIES.map(({ key }) => [key, channelPatch.optional()]),
    ) as Record<NotificationCategory, z.ZodOptional<typeof channelPatch>>,
  )
  .strict();
export type NotificationPrefsPatch = z.infer<typeof notificationPrefsPatchSchema>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

export function normalizeNotificationPrefs(raw: unknown): NotificationPrefs {
  const stored = record(raw);
  return Object.fromEntries(
    NOTIFICATION_CATEGORIES.map(({ key }) => {
      const present = Object.hasOwn(stored, key);
      const channels = record(present ? stored[key] : undefined);
      const malformed =
        (raw !== null && raw !== undefined && !isRecord(raw)) ||
        (present && !isRecord(stored[key]));
      const defaults = DEFAULT_NOTIFICATION_PREFS[key];
      return [
        key,
        Object.fromEntries(
          Object.entries(defaults).map(([channel, fallback]) => [
            channel,
            malformed
              ? false
              : Object.hasOwn(channels, channel)
                ? channels[channel] === true
                : fallback,
          ]),
        ),
      ];
    }),
  ) as NotificationPrefs;
}

// Only trusted stored JSON is preserved; unknown incoming fields are rejected by the schema.
// Missing categories/channels in older clients are not reset to defaults on save.
export function applyNotificationPrefsPatch(
  stored: unknown,
  input: unknown,
): Record<string, unknown> {
  const patch = notificationPrefsPatchSchema.parse(input);
  const result = { ...record(stored) };
  for (const { key } of NOTIFICATION_CATEGORIES) {
    if (patch[key] !== undefined) {
      const channels = Object.fromEntries(
        Object.entries(patch[key]).filter(([, value]) => value !== undefined),
      );
      result[key] = { ...record(result[key]), ...channels };
    }
  }
  return result;
}

export function notificationPrefsDiff(
  before: unknown,
  after: NotificationPrefs,
): NotificationPrefsPatch {
  const original = normalizeNotificationPrefs(before);
  const patch: NotificationPrefsPatch = {};
  for (const { key } of NOTIFICATION_CATEGORIES) {
    const changed: Partial<NotificationChannels> = {};
    for (const channel of Object.keys(original[key]) as (keyof NotificationChannels)[]) {
      if (original[key][channel] !== after[key][channel]) changed[channel] = after[key][channel];
    }
    if (Object.keys(changed).length) patch[key] = changed;
  }
  return patch;
}

export type NotificationInterruption = { toast: boolean; sound: boolean; shake: boolean };
export function notificationInterruption(
  notification: {
    type?: string | null;
    eventKey?: string | null;
    entity?: string | null;
    link?: string | null;
  },
  prefs: NotificationPrefs | null,
  pathname: string,
  effective?: NotificationChannels,
): NotificationInterruption {
  const event = resolveNotificationRecordEvent(notification);
  // No interruption before the current user's preferences load, or for an unknown producer.
  if (!prefs || !event) return { toast: false, sound: false, shake: false };
  const channel =
    effective ??
    (event.availability === "active"
      ? { ...prefs[event.category], sound: false, shake: false }
      : prefs[event.category]);
  const inboxMessage =
    notification.type === "message" &&
    (notification.entity === "inbox_conversation" ||
      /^\/inbox(?:\/|\?|$)/.test(notification.link ?? ""));
  const inInbox = /^\/inbox(?:\/|$)/.test(pathname);
  if (channel?.inapp !== true || (inboxMessage && inInbox))
    return { toast: false, sound: false, shake: false };
  return { toast: true, sound: channel.sound === true, shake: channel.shake === true };
}
