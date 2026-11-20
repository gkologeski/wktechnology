import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createNotificationRealtimeBatcher,
  isNotificationRealtimeId,
} from "./notification-center-realtime";
import { DEFAULT_CENTER_SETTINGS } from "./notification-center-preferences";
import { DEFAULT_NOTIFICATION_PREFS } from "./notification-preferences";
import type { NotificationCenterItem } from "./notification-center";
const NOW = "2026-11-20T12:00:00Z";
const id = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const notice = (
  n: number,
  patch: Partial<NotificationCenterItem> = {},
): NotificationCenterItem => ({
  id: id(n),
  type: "mention",
  title: "PRIVATE source title",
  body: "PRIVATE source body",
  entity: "deals",
  entity_id: id(900),
  link: `/deals/${id(900)}`,
  created_at: NOW,
  read_at: null,
  snoozed_until: null,
  moduleKey: "crm",
  event: { eventKey: "legacy.mention", category: "mention", moduleKey: null },
  ...patch,
});
function fixture() {
  let active = true;
  const preferences = vi.fn(async () => ({
    settings: structuredClone(DEFAULT_CENTER_SETTINGS),
    legacyPrefs: structuredClone(DEFAULT_NOTIFICATION_PREFS),
  }));
  const lookup = vi.fn(async (ids: string[]) => ({
    items: ids.map((value) => notice(1, { id: value })),
    checkedAt: new Date().toISOString(),
  }));
  const invalidate = vi.fn(),
    interrupt = vi.fn();
  const batcher = createNotificationRealtimeBatcher({
    isActive: () => active,
    lookup,
    preferences,
    invalidate,
    interrupt,
    pathname: () => "/deals",
  });
  return {
    batcher,
    lookup,
    preferences,
    invalidate,
    interrupt,
    deactivate: () => {
      active = false;
    },
  };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});
describe("scoped realtime notifications are bounded and coalesced", () => {
  it("resolves an 85-item burst in batches of at most 30 with one policy read and one interruption", async () => {
    const f = fixture();
    for (let n = 1; n <= 85; n++) f.batcher.inserted(id(n));
    f.batcher.inserted(id(1));
    await vi.advanceTimersByTimeAsync(100);
    expect(f.lookup.mock.calls.map(([ids]) => ids.length)).toEqual([30, 30, 25]);
    expect(f.preferences).toHaveBeenCalledTimes(1);
    expect(f.invalidate).toHaveBeenCalledTimes(1);
    expect(f.interrupt).toHaveBeenCalledExactlyOnceWith({ toast: true, sound: true, shake: true });
    expect(JSON.stringify(f.interrupt.mock.calls)).not.toContain("PRIVATE");
  });
  it("bounds a large burst at 100 IDs without an unbounded recipient queue", async () => {
    const f = fixture();
    for (let n = 1; n <= 140; n++) f.batcher.inserted(id(n));
    await vi.advanceTimersByTimeAsync(100);
    expect(f.lookup.mock.calls.flatMap(([ids]) => ids)).toHaveLength(100);
    expect(f.interrupt).toHaveBeenCalledTimes(1);
    expect(f.invalidate).toHaveBeenCalledTimes(1);
  });
  it("coalesces updates/deletions as silent cache refreshes", async () => {
    const f = fixture();
    for (let n = 0; n < 50; n++) f.batcher.changed();
    await vi.advanceTimersByTimeAsync(100);
    expect(f.invalidate).toHaveBeenCalledTimes(1);
    expect(f.lookup).not.toHaveBeenCalled();
    expect(f.preferences).not.toHaveBeenCalled();
    expect(f.interrupt).not.toHaveBeenCalled();
  });
  it.each(["bad-id", "not-uuid", { id: id(1), title: "PRIVATE" }, null, 1])(
    "ignores malformed provider metadata without IO: %j",
    async (value) => {
      const f = fixture();
      f.batcher.inserted(value);
      await vi.advanceTimersByTimeAsync(100);
      expect(f.invalidate).not.toHaveBeenCalled();
      expect(f.lookup).not.toHaveBeenCalled();
    },
  );
  it("deduplicates repeated inserts after an authorized batch completed", async () => {
    const f = fixture();
    f.batcher.inserted(id(1));
    await vi.advanceTimersByTimeAsync(100);
    f.batcher.inserted(id(1));
    await vi.advanceTimersByTimeAsync(100);
    expect(f.lookup).toHaveBeenCalledTimes(1);
    expect(f.invalidate).toHaveBeenCalledTimes(1);
    expect(f.interrupt).toHaveBeenCalledTimes(1);
  });
  it("does not consume another identity's queued IDs", async () => {
    const f = fixture();
    f.batcher.inserted(id(1));
    f.deactivate();
    await vi.advanceTimersByTimeAsync(100);
    expect(f.invalidate).not.toHaveBeenCalled();
    expect(f.lookup).not.toHaveBeenCalled();
  });
  it("disposes a queued callback without refreshing or interrupting a new workspace", async () => {
    const f = fixture();
    f.batcher.inserted(id(1));
    f.batcher.dispose();
    await vi.advanceTimersByTimeAsync(100);
    f.batcher.changed();
    f.batcher.inserted(id(2));
    await f.batcher.flush();
    expect(f.invalidate).not.toHaveBeenCalled();
    expect(f.interrupt).not.toHaveBeenCalled();
  });
  it("rechecks active identity after current preferences before any interruption", async () => {
    const f = fixture();
    f.preferences.mockImplementationOnce(async () => {
      f.deactivate();
      return {
        settings: structuredClone(DEFAULT_CENTER_SETTINGS),
        legacyPrefs: structuredClone(DEFAULT_NOTIFICATION_PREFS),
      };
    });
    f.batcher.inserted(id(1));
    await vi.advanceTimersByTimeAsync(100);
    expect(f.lookup).toHaveBeenCalledTimes(1);
    expect(f.interrupt).not.toHaveBeenCalled();
  });
  it("cannot interrupt after a lookup completed for an obsolete identity", async () => {
    const f = fixture();
    let resolve!: (value: { items: NotificationCenterItem[]; checkedAt: string }) => void;
    f.lookup.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    f.batcher.inserted(id(1));
    await vi.advanceTimersByTimeAsync(100);
    f.deactivate();
    resolve({ items: [notice(1)], checkedAt: NOW });
    await Promise.resolve();
    await Promise.resolve();
    expect(f.interrupt).not.toHaveBeenCalled();
  });
  it("does not trust a response containing an ID outside the requested set", async () => {
    const f = fixture();
    f.lookup.mockResolvedValue({ items: [notice(9)], checkedAt: NOW });
    f.batcher.inserted(id(1));
    await vi.advanceTimersByTimeAsync(100);
    expect(f.interrupt).not.toHaveBeenCalled();
  });
  it.each([
    { read_at: NOW },
    { snoozed_until: "2026-11-21T12:00:00Z" },
    { type: "unknown-future-event" },
  ])("does not interrupt an ineligible authorized item: %j", async (patch) => {
    const f = fixture();
    f.lookup.mockResolvedValue({ items: [notice(1, patch)], checkedAt: NOW });
    f.batcher.inserted(id(1));
    await vi.advanceTimersByTimeAsync(100);
    expect(f.interrupt).not.toHaveBeenCalled();
  });
  it("uses current disabled channel preferences rather than cached defaults", async () => {
    const f = fixture();
    const prefs = structuredClone(DEFAULT_NOTIFICATION_PREFS);
    prefs.mention.inapp = false;
    f.preferences.mockResolvedValue({
      legacyPrefs: prefs,
      settings: structuredClone(DEFAULT_CENTER_SETTINGS),
    });
    f.batcher.inserted(id(1));
    await vi.advanceTimersByTimeAsync(100);
    expect(f.interrupt).not.toHaveBeenCalled();
  });
  it("respects current quiet hours without interrupting", async () => {
    const f = fixture();
    const settings = structuredClone(DEFAULT_CENTER_SETTINGS);
    settings.quiet = { enabled: true, timezone: "UTC", start: "11:00", end: "13:00" };
    f.preferences.mockResolvedValue({
      legacyPrefs: structuredClone(DEFAULT_NOTIFICATION_PREFS),
      settings,
    });
    f.batcher.inserted(id(1));
    await vi.advanceTimersByTimeAsync(100);
    expect(f.lookup).toHaveBeenCalledTimes(1);
    expect(f.interrupt).not.toHaveBeenCalled();
  });
  it("discards an operation that takes over 60 seconds without comparing different clocks", async () => {
    const f = fixture();
    f.lookup.mockImplementationOnce(async () => {
      await new Promise((done) => setTimeout(done, 60_001));
      return { items: [notice(1)], checkedAt: new Date().toISOString() };
    });
    f.batcher.inserted(id(1));
    await vi.advanceTimersByTimeAsync(60_101);
    expect(f.interrupt).not.toHaveBeenCalled();
    expect(f.preferences).not.toHaveBeenCalled();
  });
  it("propagates neither payload nor error details when source authorization fails", async () => {
    const f = fixture();
    f.lookup.mockRejectedValue(Error("PRIVATE denied source"));
    f.batcher.inserted(id(1));
    await vi.advanceTimersByTimeAsync(100);
    expect(f.interrupt).not.toHaveBeenCalled();
  });
  it("rejects an invalid database reference timestamp", async () => {
    const f = fixture();
    f.lookup.mockResolvedValue({ items: [notice(1)], checkedAt: "invalid" });
    f.batcher.inserted(id(1));
    await vi.advanceTimersByTimeAsync(100);
    expect(f.interrupt).not.toHaveBeenCalled();
  });
  it("validates exact UUID shape before buffering IDs", () => {
    expect(isNotificationRealtimeId(id(1))).toBe(true);
    expect(isNotificationRealtimeId(id(1) + "extra")).toBe(false);
  });
});

it("reloads channel preferences after source lookup rather than using a policy from before the burst", async () => {
  const f = fixture();
  const prefs = structuredClone(DEFAULT_NOTIFICATION_PREFS);
  prefs.mention.inapp = false;
  f.lookup.mockImplementationOnce(async (ids) => {
    f.preferences.mockResolvedValue({
      settings: structuredClone(DEFAULT_CENTER_SETTINGS),
      legacyPrefs: prefs,
    });
    return { items: ids.map((value) => notice(1, { id: value })), checkedAt: NOW };
  });
  f.batcher.inserted(id(1));
  await vi.advanceTimersByTimeAsync(100);
  expect(f.lookup.mock.invocationCallOrder[0]).toBeLessThan(
    f.preferences.mock.invocationCallOrder[0],
  );
  expect(f.interrupt).not.toHaveBeenCalled();
});

it.each([-120_000, 120_000])(
  "accepts fresh lookups with a browser clock offset of %s ms",
  async (offset) => {
    vi.setSystemTime(Date.parse(NOW) + offset);
    const f = fixture();
    f.lookup.mockResolvedValue({
      items: [notice(1, { snoozed_until: "2026-11-20T11:59:00Z" })],
      checkedAt: NOW,
    });
    f.batcher.inserted(id(1));
    await vi.advanceTimersByTimeAsync(100);
    expect(f.interrupt).toHaveBeenCalledTimes(1);
  },
);
it.each([-120_000, 120_000])(
  "applies quiet hours using the server reference when browser clock differs by %s ms",
  async (offset) => {
    vi.setSystemTime(Date.parse(NOW) + offset);
    const f = fixture();
    const settings = structuredClone(DEFAULT_CENTER_SETTINGS);
    settings.quiet = { enabled: true, timezone: "UTC", start: "11:59", end: "12:01" };
    f.preferences.mockResolvedValue({
      settings,
      legacyPrefs: structuredClone(DEFAULT_NOTIFICATION_PREFS),
    });
    f.lookup.mockResolvedValue({ items: [notice(1)], checkedAt: NOW });
    f.batcher.inserted(id(1));
    await vi.advanceTimersByTimeAsync(100);
    expect(f.interrupt).not.toHaveBeenCalled();
  },
);
it.each([-120_000, 120_000])(
  "keeps an active server-side snooze with browser clock offset %s ms",
  async (offset) => {
    vi.setSystemTime(Date.parse(NOW) + offset);
    const f = fixture();
    f.lookup.mockResolvedValue({
      items: [notice(1, { snoozed_until: "2026-11-20T12:01:00Z" })],
      checkedAt: NOW,
    });
    f.batcher.inserted(id(1));
    await vi.advanceTimersByTimeAsync(100);
    expect(f.interrupt).not.toHaveBeenCalled();
  },
);
