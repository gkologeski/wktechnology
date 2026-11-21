import { describe, expect, it } from "vitest";
import { normalizeNotificationPrefs } from "./notification-preferences";
import {
  DEFAULT_CENTER_SETTINGS,
  AVAILABLE_NOTIFICATION_EVENTS,
  LEGACY_NOTIFICATION_EVENTS,
  applyCenterSettingsPatch,
  centerSettingsPatchSchema,
  centerSettingsSchema,
  diffCenterSettings,
  effectiveChannels,
  effectiveWhatsAppPreference,
  groupSummary,
  isQuietNow,
  normalizeCenterSettings,
  validNotificationTimeZone,
} from "./notification-center-preferences";

const quiet = (start = "22:00", end = "08:00", timezone = "America/Sao_Paulo") => ({
  enabled: true,
  start,
  end,
  timezone,
});
const base = () => normalizeNotificationPrefs(null);
const settings = () => normalizeCenterSettings(null);
const silent = { inapp: false, email: false, sound: false, shake: false };

describe("workspace notification preference overlays", () => {
  it("inherits global preferences without creating overrides on initial load", () => {
    const loaded = settings();
    expect(loaded).toEqual(DEFAULT_CENTER_SETTINGS);
    expect(effectiveChannels(base(), loaded, "mention")).toEqual(base().mention);
    expect(diffCenterSettings(loaded, structuredClone(loaded))).toEqual({});
  });
  it("preserves the legacy event list and adds only the twenty-three operational module choices", () => {
    expect(LEGACY_NOTIFICATION_EVENTS).toHaveLength(22);
    expect(LEGACY_NOTIFICATION_EVENTS.every((event) => event.eventKey.startsWith("legacy."))).toBe(
      true,
    );
    expect(AVAILABLE_NOTIFICATION_EVENTS).toHaveLength(45);
    expect(AVAILABLE_NOTIFICATION_EVENTS.map((event) => event.eventKey)).not.toContain(
      "shared.approval.pending",
    );
  });
  it("keeps WhatsApp overrides optional and applies exact event precedence without changing global profile channels", () => {
    const key = "contracts.contract.expiring";
    expect(effectiveWhatsAppPreference(settings(), key)).toBeUndefined();
    const stored = normalizeCenterSettings({
      categories: { task: { whatsapp: true } },
      eventOverrides: { [key]: { whatsapp: false } },
    });
    expect(effectiveWhatsAppPreference(stored, key)).toBe(false);
    expect(effectiveWhatsAppPreference(stored, "contracts.contract.renewal_due")).toBe(true);
    expect(Object.keys(effectiveChannels(base(), stored, key)).sort()).toEqual([
      "email",
      "inapp",
      "shake",
      "sound",
    ]);
    expect(Object.hasOwn(base().task, "whatsapp")).toBe(false);
    const inherited = normalizeCenterSettings(
      applyCenterSettingsPatch(stored, { eventOverrides: { [key]: { whatsapp: null } } }),
    );
    expect(effectiveWhatsAppPreference(inherited, key)).toBe(true);
    const reset = normalizeCenterSettings(
      applyCenterSettingsPatch(inherited, { categories: { task: { whatsapp: null } } }),
    );
    expect(effectiveWhatsAppPreference(reset, key)).toBeUndefined();
  });
  it("fails closed for malformed WhatsApp preferences and roundtrips a targeted opt-out", () => {
    const key = "crm.deal.won";
    const before = settings();
    const after = normalizeCenterSettings(
      applyCenterSettingsPatch(before, { eventOverrides: { [key]: { whatsapp: false } } }),
    );
    expect(diffCenterSettings(before, after)).toEqual({
      eventOverrides: { [key]: { whatsapp: false } },
    });
    expect(effectiveWhatsAppPreference(after, key)).toBe(false);
    for (const raw of [
      false,
      { eventOverrides: { [key]: { whatsapp: "true" } } },
      { quiet: false },
    ]) {
      expect(effectiveWhatsAppPreference(normalizeCenterSettings(raw), key)).toBe(false);
    }
  });
  it("keeps canonical sounds quiet until a workspace category or exact event opts in", () => {
    const prefs = normalizeNotificationPrefs({
      task: { inapp: true, email: true, sound: true, shake: true },
    });
    const key = "contracts.contract.expiring";
    expect(effectiveChannels(prefs, settings(), key)).toEqual({
      inapp: true,
      email: true,
      sound: false,
      shake: false,
    });
    const custom = normalizeCenterSettings({
      categories: { task: { sound: true, shake: true } },
      eventOverrides: { [key]: { shake: false } },
    });
    expect(effectiveChannels(prefs, custom, key)).toEqual({
      inapp: true,
      email: true,
      sound: true,
      shake: false,
    });
    expect(effectiveChannels(prefs, settings(), "task").sound).toBe(true);
  });
  it.each([
    "projects.project.started",
    "projects.project.overdue",
    "projects.task.overdue",
    "projects.milestone.due",
    "ats.application.received",
    "ats.interview.scheduled",
    "ats.offer.accepted",
    "people.employment.started",
    "people.document.expiring",
    "people.approval.pending",
    "finance.payable.due",
    "finance.receivable.due",
    "finance.payable.overdue",
    "finance.receivable.overdue",
    "finance.invoice.received",
  ] as const)(
    "exposes %s conservatively and preserves exact WhatsApp opt-out without changing other events",
    (key) => {
      const prefs = normalizeNotificationPrefs({
        workflow: { sound: true, shake: true },
        task: { sound: true, shake: true },
      });
      expect(effectiveChannels(prefs, settings(), { type: "workflow", eventKey: key })).toEqual({
        inapp: true,
        email: false,
        sound: false,
        shake: false,
      });
      expect(effectiveWhatsAppPreference(settings(), key)).toBeUndefined();
      const patch = { eventOverrides: { [key]: { whatsapp: false, sound: true } } };
      expect(centerSettingsPatchSchema.safeParse(patch).success).toBe(true);
      const after = normalizeCenterSettings(applyCenterSettingsPatch(settings(), patch));
      expect(diffCenterSettings(settings(), after)).toEqual(patch);
      expect(effectiveWhatsAppPreference(after, key)).toBe(false);
      expect(effectiveWhatsAppPreference(after, "contracts.contract.expiring")).toBeUndefined();
      expect(effectiveChannels(prefs, after, key).sound).toBe(true);
    },
  );
  it("accepts and roundtrips a canonical override without enabling a channel or touching another event", () => {
    const stored = {
      eventOverrides: { "legacy.workflow": { inapp: false }, future: { keep: true } },
    };
    const next = applyCenterSettingsPatch(stored, {
      eventOverrides: { "crm.deal.won": { sound: true, email: false } },
    });
    expect(next).toEqual({
      eventOverrides: { ...stored.eventOverrides, "crm.deal.won": { sound: true, email: false } },
    });
    expect(normalizeCenterSettings(next).eventOverrides).toEqual({
      "legacy.workflow": { inapp: false },
      "crm.deal.won": { sound: true, email: false },
    });
    expect(effectiveChannels(base(), normalizeCenterSettings(next), "crm.deal.won").email).toBe(
      false,
    );
  });
  it.each([null, "unknown", "mention", "shared.approval.pending"])(
    "does not inherit a legacy preference after invalid explicit eventKey %s",
    (eventKey) => {
      expect(effectiveChannels(base(), settings(), { type: "mention", eventKey })).toEqual(silent);
    },
  );
  it("keeps explicit false through global, category and exact event precedence", () => {
    const prefs = normalizeNotificationPrefs({ mention: { email: false, sound: false } });
    const loaded = normalizeCenterSettings({
      categories: { mention: { inapp: false, sound: true } },
      eventOverrides: { "legacy.mention": { sound: false, shake: false } },
    });
    expect(effectiveChannels(prefs, loaded, { eventKey: "legacy.mention" })).toEqual(silent);
    expect(effectiveChannels(prefs, loaded, { type: "mention" })).toEqual(silent);
    expect(effectiveChannels(prefs, loaded, "assignment")).toEqual(prefs.assignment);
  });
  it.each(["unknown", "shared.approval.pending", "sla.future", "constructor", "__proto__"])(
    "does not enable planned or unknown event %s",
    (event) => expect(effectiveChannels(base(), settings(), event)).toEqual(silent),
  );
  it("normalizes only known stored fields without exposing future JSON", () => {
    expect(
      normalizeCenterSettings({
        categories: { mention: { sound: false, future: true }, future: { sound: true } },
        eventOverrides: {
          "legacy.mention": { inapp: true },
          "shared.approval.pending": { sound: true },
        },
        quiet: { ...DEFAULT_CENTER_SETTINGS.quiet, future: "keep in DB" },
        future: { secret: "not returned" },
      }),
    ).toEqual({
      ...settings(),
      categories: { mention: { sound: false } },
      eventOverrides: { "legacy.mention": { inapp: true } },
    });
  });
  it.each([false, [], "false", 1])("fails closed for malformed stored root %j", (raw) => {
    const loaded = normalizeCenterSettings(raw);
    expect(effectiveChannels(base(), loaded, "mention")).toEqual(silent);
  });
  it("does not coerce invalid stored channels or malformed groups", () => {
    const loaded = normalizeCenterSettings({
      categories: {
        mention: { inapp: "true", sound: 1 },
        assignment: "false",
      },
    });
    expect(effectiveChannels(base(), loaded, "mention").inapp).toBe(false);
    expect(effectiveChannels(base(), loaded, "mention").sound).toBe(false);
    expect(effectiveChannels(base(), loaded, "assignment")).toEqual(silent);
  });
  it("fails closed for invalid stored quiet configuration even with an event override", () => {
    const loaded = normalizeCenterSettings({
      quiet: quiet("22:00", "08:00", "invalid"),
      eventOverrides: { "legacy.mention": { sound: true, inapp: true } },
    });
    expect(effectiveChannels(base(), loaded, "mention")).toEqual(silent);
  });
  it.each([
    { future: true },
    { categories: { future: { sound: true } } },
    { eventOverrides: { "shared.approval.pending": { sound: true } } },
    { eventOverrides: { "legacy.mention": { future: true } } },
    { categories: { mention: { inapp: "false" } } },
    { quiet: { enabled: true } },
    { summary: "email" },
    JSON.parse('{"__proto__":{"sound":true}}'),
  ])("rejects unknown, planned or malformed incoming patch %j", (input) => {
    expect(centerSettingsPatchSchema.safeParse(input).success).toBe(false);
  });
  it("merges partial changes retaining unknown stored JSON and concurrent unrelated fields", () => {
    const stored = {
      categories: { mention: { email: false, future: "keep" }, task: { sound: false } },
      eventOverrides: { "legacy.message": { inapp: false, future: "retain" } },
      quiet: { ...DEFAULT_CENTER_SETTINGS.quiet, future: "retain" },
      future: { budget: "unrelated" },
    };
    const next = applyCenterSettingsPatch(stored, {
      categories: { mention: { sound: false } },
      summary: "weekly",
    });
    expect(next).toEqual({
      ...stored,
      summary: "weekly",
      categories: { ...stored.categories, mention: { ...stored.categories.mention, sound: false } },
    });
    expect(stored.categories.mention).not.toHaveProperty("sound");
  });
  it("resets one channel or entire event to inheritance through null without resetting neighbors", () => {
    const stored = {
      categories: { mention: { sound: false, email: false, future: true } },
      eventOverrides: { "legacy.mention": { inapp: false }, "legacy.message": { shake: false } },
    };
    expect(
      applyCenterSettingsPatch(stored, {
        categories: { mention: { sound: null } },
        eventOverrides: { "legacy.mention": null },
      }),
    ).toEqual({
      categories: { mention: { email: false, future: true } },
      eventOverrides: { "legacy.message": { shake: false } },
    });
  });
  it("emits only changed fields and reset markers, never a materialized default snapshot", () => {
    const before = normalizeCenterSettings({
      categories: { mention: { sound: false, shake: false } },
      eventOverrides: { "legacy.message": { inapp: false } },
    });
    const after = structuredClone(before);
    delete after.categories.mention!.sound;
    delete after.eventOverrides["legacy.message"];
    after.categories.task = { sound: true };
    expect(diffCenterSettings(before, after)).toEqual({
      categories: { mention: { sound: null }, task: { sound: true } },
      eventOverrides: { "legacy.message": null },
    });
    expect(
      normalizeCenterSettings(applyCenterSettingsPatch(before, diffCenterSettings(before, after))),
    ).toEqual(after);
  });
  it("roundtrips a whole quiet update and summary mode", () => {
    const before = settings();
    const after = { ...before, quiet: quiet(), summary: "daily" as const };
    const patch = diffCenterSettings(before, after);
    expect(patch).toEqual({ quiet: quiet(), summary: "daily" });
    expect(
      centerSettingsSchema.parse(normalizeCenterSettings(applyCenterSettingsPatch(before, patch))),
    ).toEqual(after);
  });
});

describe("civil quiet hours", () => {
  it.each([
    ["2026-11-20T00:59:00Z", false],
    ["2026-11-20T01:00:00Z", true],
    ["2026-11-20T10:59:59Z", true],
    ["2026-11-20T11:00:00Z", false],
    ["2026-11-20T03:00:00Z", true],
  ])("handles overnight start inclusive/end exclusive at %s", (at, expected) => {
    expect(isQuietNow(quiet(), new Date(at))).toBe(expected);
  });
  it.each([
    ["2026-11-20T12:59:00Z", false],
    ["2026-11-20T13:00:00Z", true],
    ["2026-11-20T14:59:00Z", true],
    ["2026-11-20T15:00:00Z", false],
  ])("handles same-day intervals at %s", (at, expected) => {
    expect(isQuietNow(quiet("10:00", "12:00"), new Date(at))).toBe(expected);
  });
  it("treats both instances of a repeated DST hour as quiet", () => {
    const q = quiet("01:00", "02:00", "America/New_York");
    expect(isQuietNow(q, new Date("2026-11-01T05:30:00Z"))).toBe(true);
    expect(isQuietNow(q, new Date("2026-11-01T06:30:00Z"))).toBe(true);
    expect(isQuietNow(q, new Date("2026-11-01T07:00:00Z"))).toBe(false);
  });
  it("does not invent an instant in the DST spring gap", () => {
    const q = quiet("02:00", "03:00", "America/New_York");
    expect(isQuietNow(q, new Date("2026-03-08T06:59:00Z"))).toBe(false);
    expect(isQuietNow(q, new Date("2026-03-08T07:00:00Z"))).toBe(false);
  });
  it("supports fractional offsets and UTC without a fixed offset assumption", () => {
    expect(
      isQuietNow(quiet("22:00", "23:00", "Asia/Kathmandu"), new Date("2026-11-20T16:15:00Z")),
    ).toBe(true);
    expect(isQuietNow(quiet("22:00", "23:00", "UTC"), new Date("2026-11-20T22:00:00Z"))).toBe(true);
    expect(validNotificationTimeZone("EST")).toBe(false);
  });
  it("rejects ambiguous equal boundaries and invalid time or zone", () => {
    for (const q of [quiet("08:00", "08:00"), quiet("24:00"), quiet("22:00", "08:00", "bad")])
      expect(centerSettingsPatchSchema.safeParse({ quiet: q }).success).toBe(false);
    expect(isQuietNow(quiet(), new Date("invalid"))).toBe(true);
    expect(isQuietNow(quiet("24:00"), new Date())).toBe(true);
    expect(isQuietNow(DEFAULT_CENTER_SETTINGS.quiet, new Date())).toBe(false);
  });
});

describe("central-only summary grouping", () => {
  const items = [
    { id: "late", created_at: "2026-11-23T02:00:00Z" },
    { id: "monday", created_at: "2026-11-23T03:01:00Z" },
    { id: "bad", created_at: "invalid" },
  ];
  it("groups on recipient civil dates, preserves item order and invalid dates", () => {
    const grouped = groupSummary(items, "daily", "America/Sao_Paulo");
    expect(grouped.map((g) => g.key)).toEqual(["2026-11-22", "2026-11-23", "unknown"]);
    expect(grouped.flatMap((g) => g.items)).toEqual(items);
    expect(grouped[2].label).toBe("Sem data válida");
  });
  it("starts each week on local Monday including year boundaries", () => {
    expect(groupSummary(items, "weekly", "America/Sao_Paulo").map((g) => g.key)).toEqual([
      "2026-11-16",
      "2026-11-23",
      "unknown",
    ]);
    expect(groupSummary([{ created_at: "2027-01-01T12:00:00Z" }], "weekly", "UTC")[0].key).toBe(
      "2026-12-28",
    );
  });
  it("never removes or mutates an item, marks read, sends or schedules external effects", () => {
    const input = Object.freeze(items.map((i) => Object.freeze({ ...i })));
    expect(groupSummary(input, "none", "UTC")).toEqual([{ key: "all", label: "Todas", items }]);
    expect(groupSummary([], "daily", "UTC")).toEqual([]);
    expect(() => groupSummary(items, "daily", "bad")).toThrow("Fuso");
  });
});
