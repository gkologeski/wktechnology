import { z } from "zod";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_EVENT_CATALOG,
  resolveAvailableNotificationEvent,
  resolveNotificationRecordEvent,
  type NotificationCategory,
  type NotificationEventKey,
  type AvailableNotificationEventKey,
} from "./notification-catalog";
import {
  normalizeNotificationPrefs,
  type NotificationChannels,
  type NotificationPrefs,
} from "./notification-preferences";

export const LEGACY_NOTIFICATION_EVENTS = NOTIFICATION_EVENT_CATALOG.filter(
  (event) => event.availability === "legacy",
);
export type LegacyNotificationEventKey = Extract<NotificationEventKey, `legacy.${string}`>;
export const AVAILABLE_NOTIFICATION_EVENTS = NOTIFICATION_EVENT_CATALOG.filter(
  (event) => event.availability !== "planned",
);
export type AvailableEventKey = AvailableNotificationEventKey;
export type WorkspaceNotificationChannels = NotificationChannels & { whatsapp?: boolean };
const CHANNELS = ["inapp", "email", "sound", "shake", "whatsapp"] as const;
const channelSchema = z
  .object({
    inapp: z.boolean().optional(),
    email: z.boolean().optional(),
    sound: z.boolean().optional(),
    shake: z.boolean().optional(),
    whatsapp: z.boolean().optional(),
  })
  .strict();
const channelPatchSchema = z
  .object({
    inapp: z.boolean().nullable().optional(),
    email: z.boolean().nullable().optional(),
    sound: z.boolean().nullable().optional(),
    shake: z.boolean().nullable().optional(),
    whatsapp: z.boolean().nullable().optional(),
  })
  .strict();
const categoryShape = Object.fromEntries(
  NOTIFICATION_CATEGORIES.map(({ key }) => [key, channelSchema.optional()]),
) as Record<NotificationCategory, z.ZodOptional<typeof channelSchema>>;
const eventShape = Object.fromEntries(
  AVAILABLE_NOTIFICATION_EVENTS.map(({ eventKey }) => [eventKey, channelSchema.optional()]),
) as Record<AvailableEventKey, z.ZodOptional<typeof channelSchema>>;
const categoryPatchShape = Object.fromEntries(
  NOTIFICATION_CATEGORIES.map(({ key }) => [key, channelPatchSchema.nullable().optional()]),
) as Record<NotificationCategory, z.ZodOptional<z.ZodNullable<typeof channelPatchSchema>>>;
const eventPatchShape = Object.fromEntries(
  AVAILABLE_NOTIFICATION_EVENTS.map(({ eventKey }) => [
    eventKey,
    channelPatchSchema.nullable().optional(),
  ]),
) as Record<AvailableEventKey, z.ZodOptional<z.ZodNullable<typeof channelPatchSchema>>>;

export function validNotificationTimeZone(value: string): boolean {
  try {
    if (!value || value.length > 80 || (value !== "UTC" && !value.includes("/"))) return false;
    new Intl.DateTimeFormat("en", { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Use o formato HH:mm.");
const quietSchema = z
  .object({
    enabled: z.boolean(),
    timezone: z.string().refine(validNotificationTimeZone, "Informe um fuso horário IANA válido."),
    start: time,
    end: time,
  })
  .strict()
  .refine((quiet) => !quiet.enabled || quiet.start !== quiet.end, {
    message: "O início e o fim do silêncio devem ser diferentes.",
    path: ["end"],
  });
export const centerSettingsSchema = z
  .object({
    categories: z.object(categoryShape).strict(),
    eventOverrides: z.object(eventShape).strict(),
    quiet: quietSchema,
    summary: z.enum(["none", "daily", "weekly"]),
  })
  .strict();
export const centerSettingsPatchSchema = z
  .object({
    categories: z.object(categoryPatchShape).strict().optional(),
    eventOverrides: z.object(eventPatchShape).strict().optional(),
    quiet: quietSchema.optional(),
    summary: z.enum(["none", "daily", "weekly"]).optional(),
  })
  .strict();
export type CenterSettings = z.infer<typeof centerSettingsSchema>;
export type CenterSettingsPatch = z.infer<typeof centerSettingsPatchSchema>;
export const DEFAULT_CENTER_SETTINGS: CenterSettings = {
  categories: {},
  eventOverrides: {},
  quiet: { enabled: false, timezone: "America/Sao_Paulo", start: "22:00", end: "08:00" },
  summary: "none",
};
const silent: NotificationChannels = { inapp: false, email: false, sound: false, shake: false };
const workspaceSilent = { ...silent, whatsapp: false };
const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

// Stored future fields remain in the database, but never become client-writable input.
export function normalizeCenterSettings(raw: unknown): CenterSettings {
  const settings = structuredClone(DEFAULT_CENTER_SETTINGS);
  if (raw === null || raw === undefined) return settings;
  const stored = record(raw);
  if (!stored) {
    settings.categories = Object.fromEntries(
      NOTIFICATION_CATEGORIES.map(({ key }) => [key, { ...workspaceSilent }]),
    );
    return settings;
  }
  let malformed = false;
  const overlay = (value: unknown, keys: readonly string[]) => {
    const result: Record<string, Partial<WorkspaceNotificationChannels>> = {};
    const groups = record(value);
    if (value !== undefined && !groups) {
      malformed = true;
      return Object.fromEntries(keys.map((key) => [key, { ...workspaceSilent }]));
    }
    for (const key of keys) {
      if (!groups || !Object.hasOwn(groups, key)) continue;
      const channels = record(groups[key]);
      if (!channels) {
        malformed = true;
        result[key] = { ...workspaceSilent };
        continue;
      }
      result[key] = Object.fromEntries(
        CHANNELS.filter((c) => Object.hasOwn(channels, c)).map((channel) => [
          channel,
          channels[channel] === true,
        ]),
      );
    }
    return result;
  };
  settings.categories = overlay(
    stored.categories,
    NOTIFICATION_CATEGORIES.map(({ key }) => key),
  );
  settings.eventOverrides = overlay(
    stored.eventOverrides,
    AVAILABLE_NOTIFICATION_EVENTS.map(({ eventKey }) => eventKey),
  );
  if (stored.quiet !== undefined) {
    const rawQuiet = record(stored.quiet);
    const quiet = quietSchema.safeParse(
      rawQuiet
        ? {
            enabled: rawQuiet.enabled,
            timezone: rawQuiet.timezone,
            start: rawQuiet.start,
            end: rawQuiet.end,
          }
        : stored.quiet,
    );
    if (quiet.success) settings.quiet = quiet.data;
    else malformed = true;
  }
  if (["none", "daily", "weekly"].includes(String(stored.summary)))
    settings.summary = stored.summary as CenterSettings["summary"];
  if (malformed) {
    settings.categories = Object.fromEntries(
      NOTIFICATION_CATEGORIES.map(({ key }) => [key, { ...workspaceSilent }]),
    );
    settings.eventOverrides = {};
  }
  return settings;
}

/** Merge only known incoming fields. Null removes an override and restores inheritance. */
export function applyCenterSettingsPatch(stored: unknown, input: unknown): Record<string, unknown> {
  const patch = centerSettingsPatchSchema.parse(input);
  const result = structuredClone(record(stored) ?? {});
  for (const section of ["categories", "eventOverrides"] as const) {
    if (patch[section] === undefined) continue;
    const groups = { ...record(result[section]) };
    for (const [key, changes] of Object.entries(patch[section])) {
      if (changes === undefined) continue;
      if (changes === null) {
        delete groups[key];
        continue;
      }
      const channels = { ...record(groups[key]) };
      for (const [channel, value] of Object.entries(changes)) {
        if (value === null) delete channels[channel];
        else if (value !== undefined) channels[channel] = value;
      }
      if (Object.keys(channels).length) groups[key] = channels;
      else delete groups[key];
    }
    result[section] = groups;
  }
  if (patch.quiet !== undefined) result.quiet = { ...record(result.quiet), ...patch.quiet };
  if (patch.summary !== undefined) result.summary = patch.summary;
  return result;
}

export function diffCenterSettings(
  before: CenterSettings,
  after: CenterSettings,
): CenterSettingsPatch {
  const diff: CenterSettingsPatch = {};
  for (const section of ["categories", "eventOverrides"] as const) {
    const changes: Record<string, Record<string, boolean | null> | null> = {};
    for (const key of new Set([...Object.keys(before[section]), ...Object.keys(after[section])])) {
      const old = (before[section] as Record<string, Partial<WorkspaceNotificationChannels>>)[key];
      const next = (after[section] as Record<string, Partial<WorkspaceNotificationChannels>>)[key];
      if (!next && old) {
        changes[key] = null;
        continue;
      }
      const channels: Record<string, boolean | null> = {};
      for (const channel of CHANNELS) {
        if (old?.[channel] !== next?.[channel]) channels[channel] = next?.[channel] ?? null;
      }
      if (Object.keys(channels).length) changes[key] = channels;
    }
    if (Object.keys(changes).length) diff[section] = changes;
  }
  if (JSON.stringify(before.quiet) !== JSON.stringify(after.quiet)) diff.quiet = after.quiet;
  if (before.summary !== after.summary) diff.summary = after.summary;
  return centerSettingsPatchSchema.parse(diff);
}

export function effectiveChannels(
  basePrefs: NotificationPrefs,
  settings: CenterSettings,
  notification: string | { type?: string | null; eventKey?: string | null },
): NotificationChannels {
  const event =
    typeof notification === "string"
      ? resolveAvailableNotificationEvent(notification)
      : resolveNotificationRecordEvent(notification);
  if (!event) return { ...silent };
  const base = normalizeNotificationPrefs(basePrefs)[event.category];
  const effective = {
    ...base,
    ...(event.availability === "active" ? { sound: false, shake: false } : {}),
    ...settings.categories[event.category],
    ...settings.eventOverrides[event.eventKey as AvailableEventKey],
  };
  return {
    inapp: effective.inapp,
    email: effective.email,
    sound: effective.sound,
    shake: effective.shake,
  };
}

/** Undefined inherits personal consent; true is a preference only, never proof of eligibility. */
export function effectiveWhatsAppPreference(
  settings: CenterSettings,
  eventKey: AvailableEventKey,
): boolean | undefined {
  const event = resolveAvailableNotificationEvent(eventKey);
  if (!event) return false;
  return (
    settings.eventOverrides[eventKey]?.whatsapp ?? settings.categories[event.category]?.whatsapp
  );
}

/** Repeated DST hours are both quiet; nonexistent civil times never represent an instant. */
export function isQuietNow(quiet: CenterSettings["quiet"], at = new Date()): boolean {
  const parsed = quietSchema.safeParse(quiet);
  if (!parsed.success || !Number.isFinite(at.getTime())) return true;
  if (!quiet.enabled) return false;
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: quiet.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const current = `${parts.find((p) => p.type === "hour")!.value}:${parts.find((p) => p.type === "minute")!.value}`;
  return quiet.start < quiet.end
    ? current >= quiet.start && current < quiet.end
    : current >= quiet.start || current < quiet.end;
}

export function groupSummary<T extends { created_at: string }>(
  items: readonly T[],
  mode: CenterSettings["summary"],
  timezone: string,
): { key: string; label: string; items: T[] }[] {
  if (mode === "none")
    return items.length ? [{ key: "all", label: "Todas", items: [...items] }] : [];
  if (!validNotificationTimeZone(timezone))
    throw new Error("Fuso horário inválido para organizar a central.");
  const formatter = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const groups = new Map<string, { key: string; label: string; items: T[] }>();
  for (const item of items) {
    const instant = new Date(item.created_at);
    let key = "unknown";
    if (Number.isFinite(instant.getTime())) {
      const parts = formatter.formatToParts(instant);
      const part = (name: string) => Number(parts.find((p) => p.type === name)!.value);
      const day = new Date(Date.UTC(part("year"), part("month") - 1, part("day")));
      if (mode === "weekly") day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
      key = day.toISOString().slice(0, 10);
    }
    if (!groups.has(key)) {
      const label =
        key === "unknown"
          ? "Sem data válida"
          : `${mode === "weekly" ? "Semana de " : ""}${key.slice(8)}/${key.slice(5, 7)}/${key.slice(0, 4)}`;
      groups.set(key, { key, label, items: [] });
    }
    groups.get(key)!.items.push(item);
  }
  return [...groups.values()];
}
