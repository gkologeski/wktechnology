import { z } from "zod";
import type { NotificationCenterItem } from "./notification-center";
import {
  effectiveChannels,
  isQuietNow,
  type CenterSettings,
} from "./notification-center-preferences";
import {
  notificationInterruption,
  type NotificationInterruption,
  type NotificationPrefs,
} from "./notification-preferences";
import { resolveLegacyNotificationEvent } from "./notification-catalog";

const notificationId = z.string().uuid();
export const NOTIFICATION_BELL_MAX_PAGES = 3;
const MAX_PENDING_IDS = 100;
const LOOKUP_BATCH_SIZE = 30;
const MAX_SEEN_IDS = 200;
const COALESCE_MS = 100;
export function isNotificationRealtimeId(value: unknown): value is string {
  return notificationId.safeParse(value).success;
}
export function notificationRealtimeRecordId(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value) || !Object.hasOwn(value, "id"))
    return null;
  const id = (value as { id?: unknown }).id;
  return isNotificationRealtimeId(id) ? id : null;
}
type Preferences = { settings: CenterSettings; legacyPrefs: NotificationPrefs };
type Options = {
  isActive: () => boolean;
  invalidate: () => void | Promise<unknown>;
  lookup: (ids: string[]) => Promise<{ items: NotificationCenterItem[]; checkedAt: string }>;
  preferences: () => Promise<Preferences>;
  pathname: () => string;
  interrupt: (flags: NotificationInterruption) => void;
};

/** Realtime provides IDs only. Content and eligibility come from current authenticated RPCs. */
export function createNotificationRealtimeBatcher(options: Options) {
  const pending = new Set<string>();
  const inFlight = new Set<string>();
  const seen = new Set<string>();
  let dirty = false;
  let disposed = false;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const active = () => !disposed && options.isActive();
  const remember = (ids: string[]) => {
    for (const id of ids) seen.add(id);
    while (seen.size > MAX_SEEN_IDS) seen.delete(seen.values().next().value!);
  };
  const schedule = () => {
    if (timer || running || !active()) return;
    timer = setTimeout(() => {
      timer = undefined;
      void flush();
    }, COALESCE_MS);
  };
  async function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    if (running || !active()) return;
    const changed = dirty;
    dirty = false;
    const ids = [...pending];
    pending.clear();
    if (!changed && !ids.length) return;
    running = true;
    ids.forEach((id) => inFlight.add(id));
    try {
      // Refetch errors remain visible in the query that owns the badge/list.
      if (active()) void Promise.resolve(options.invalidate()).catch(() => undefined);
      if (!ids.length || !active()) return;
      const notices: Pick<NotificationCenterItem, "id" | "type" | "entity" | "link">[] = [];
      const started = performance.now();
      let reference: { at: number; received: number } | null = null;
      for (let offset = 0; offset < ids.length; offset += LOOKUP_BATCH_SIZE) {
        if (!active()) return;
        const requested = ids.slice(offset, offset + LOOKUP_BATCH_SIZE);
        const requestedSet = new Set(requested);
        const page = await options.lookup(requested);
        if (!active()) return;
        const checkedAt = Date.parse(page.checkedAt);
        if (!Number.isFinite(checkedAt) || performance.now() - started > 60_000) return;
        reference = { at: checkedAt, received: performance.now() };
        for (const notice of page.items) {
          if (
            !requestedSet.has(notice.id) ||
            notice.read_at ||
            (notice.snoozed_until && Date.parse(notice.snoozed_until) > checkedAt)
          )
            continue;
          // Keep only minimal routing metadata, never titles or bodies from the source.
          notices.push({
            id: notice.id,
            type: notice.type,
            entity: notice.entity,
            link: notice.link,
          });
        }
      }
      const preferences = await options.preferences();
      if (!active() || !reference || performance.now() - started > 60_000) return;
      const serverNow = new Date(
        reference.at + Math.max(0, performance.now() - reference.received),
      );
      if (isQuietNow(preferences.settings.quiet, serverNow)) {
        remember(ids);
        return;
      }
      const flags: NotificationInterruption = { toast: false, sound: false, shake: false };
      for (const notice of notices) {
        const event = resolveLegacyNotificationEvent(notice.type);
        if (!event) continue;
        const channels = effectiveChannels(
          preferences.legacyPrefs,
          preferences.settings,
          notice.type,
        );
        const interruption = notificationInterruption(
          notice,
          { ...preferences.legacyPrefs, [event.category]: channels },
          options.pathname(),
        );
        flags.toast ||= interruption.toast;
        flags.sound ||= interruption.sound;
        flags.shake ||= interruption.shake;
      }
      if (active() && (flags.toast || flags.sound || flags.shake)) options.interrupt(flags);
      remember(ids);
    } catch {
      // Failed reads/preferences never fall back to a provider payload or old cache.
    } finally {
      ids.forEach((id) => inFlight.delete(id));
      running = false;
      if (active() && (dirty || pending.size)) schedule();
    }
  }
  return {
    inserted(id: unknown) {
      if (
        !active() ||
        !isNotificationRealtimeId(id) ||
        seen.has(id) ||
        inFlight.has(id) ||
        pending.has(id)
      )
        return;
      dirty = true;
      if (pending.size < MAX_PENDING_IDS) pending.add(id);
      schedule();
    },
    changed() {
      if (!active()) return;
      dirty = true;
      schedule();
    },
    flush,
    dispose() {
      disposed = true;
      clearTimeout(timer);
      timer = undefined;
      pending.clear();
      inFlight.clear();
      seen.clear();
    },
  };
}
