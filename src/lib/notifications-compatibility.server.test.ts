import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { NotificationPrefs } from "./notification-preferences";

const state = vi.hoisted(() => ({ admin: null as unknown }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler: (fn: unknown) => fn,
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    return state.admin;
  },
}));
vi.mock("@/lib/access-control/work-core.server", () => ({ workRpc: vi.fn() }));
vi.mock("@/lib/access-control/sales-core.server", () => ({ assertSalesRecord: vi.fn() }));

import {
  getMyNotificationPrefs,
  listMyNotifications,
  updateMyNotificationPrefs,
} from "./notifications.functions";

const ME = "11111111-1111-4111-8111-111111111111";
const initial = {
  message: { sound: false },
  approval: { inapp: false, futureChannel: { enabled: false } },
  future: { setting: "retain" },
};
let stored: unknown;
let reads: number;
let writes: number;
let conflicts: number;
let missing: boolean;
let readError: boolean;
let writeError: boolean;
let requests: { method: string; url: URL; body: unknown }[];
const rows = [
  {
    id: "22222222-2222-4222-8222-222222222222",
    type: "hiring_approval",
    title: "Revisão",
    body: null,
    link: "/people",
    entity: "people",
    entity_id: ME,
    read_at: null,
    created_at: "2026-11-19T10:00:00Z",
  },
];

type Handler<T> = (input: {
  context: { userId: string; supabase?: unknown };
  data?: unknown;
}) => Promise<T>;
const save = (prefs: unknown, userId = ME) =>
  (updateMyNotificationPrefs as unknown as Handler<{ ok: boolean }>)({
    context: { userId },
    data: { prefs },
  });
const get = () =>
  (getMyNotificationPrefs as unknown as Handler<{ prefs: NotificationPrefs }>)({
    context: { userId: ME },
  });

beforeEach(() => {
  stored = structuredClone(initial);
  reads = writes = conflicts = 0;
  readError = writeError = missing = false;
  requests = [];
  state.admin = createClient("https://notifications.invalid", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: {
      transport: class {
        constructor() {
          throw new Error("Realtime is not used by this REST test");
        }
      } as never,
    },
    global: {
      fetch: async (input, init) => {
        const url = new URL(String(input));
        const method = init?.method ?? "GET";
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        requests.push({ method, url, body });
        const response = (data: unknown, status = 200, extra = {}) =>
          new Response(JSON.stringify(data), {
            status,
            headers: { "Content-Type": "application/json", ...extra },
          });
        if (url.pathname.endsWith("/notifications")) {
          if (method === "HEAD")
            return new Response(null, { headers: { "content-range": "0-0/1" } });
          return response(rows);
        }
        expect(url.pathname).toBe("/rest/v1/profiles");
        expect(url.searchParams.get("id")).toBe(`eq.${ME}`);
        if (method === "GET") {
          reads++;
          if (readError) return response({ message: "read unavailable" }, 500);
          return response(missing ? null : { notification_preferences: structuredClone(stored) });
        }
        expect(method).toBe("PATCH");
        writes++;
        if (writeError) return response({ message: "write unavailable" }, 403);
        const compare = url.searchParams.get("notification_preferences");
        expect(compare).toBe(`eq.${JSON.stringify(stored)}`);
        if (conflicts > 0) {
          conflicts--;
          stored = { ...(stored as object), concurrent: { saved: reads } };
          return response(null);
        }
        stored = body.notification_preferences;
        return response({ id: ME });
      },
    },
  });
});

describe("notification compatibility server boundary", () => {
  it("keeps future stored JSON and new categories when an old client updates seven-category preferences", async () => {
    expect(await save({ message: { sound: true } })).toEqual({ ok: true });
    expect(stored).toEqual({ ...initial, message: { sound: true } });
    expect(reads).toBe(1);
    expect(writes).toBe(1);
  });
  it("returns only normalized known preferences to the current owner", async () => {
    const result = await get();
    expect(result.prefs.approval.inapp).toBe(false);
    expect(result.prefs.message.sound).toBe(false);
    expect(result.prefs.workflow.sound).toBe(false);
    expect(result.prefs).not.toHaveProperty("future");
    expect(result.prefs.approval).not.toHaveProperty("futureChannel");
  });
  it("retries a conflicting compare-and-swap over the latest JSON without losing the concurrent field", async () => {
    conflicts = 1;
    await save({ approval: { sound: true } });
    expect(reads).toBe(2);
    expect(writes).toBe(2);
    expect(stored).toMatchObject({
      concurrent: { saved: 1 },
      approval: { inapp: false, sound: true, futureChannel: { enabled: false } },
    });
  });
  it("reports persistent conflicts instead of claiming a save succeeded", async () => {
    conflicts = 3;
    await expect(save({ task: { email: false } })).rejects.toThrow("outra sessão");
    expect(reads).toBe(3);
    expect(writes).toBe(3);
    expect(stored).not.toHaveProperty("task");
  });
  it("handles JSON null in the non-nullable jsonb column with an equality condition", async () => {
    stored = null;
    await save({ workflow: { inapp: false } });
    expect(stored).toEqual({ workflow: { inapp: false } });
  });
  it("does not update anything after a preference read failure", async () => {
    readError = true;
    await expect(save({ task: { sound: false } })).rejects.toThrow("read unavailable");
    expect(writes).toBe(0);
  });
  it("does not return success when the preference write fails", async () => {
    writeError = true;
    await expect(save({ task: { sound: false } })).rejects.toThrow("write unavailable");
    expect(stored).toEqual(initial);
  });
  it("does not return success for a missing profile", async () => {
    missing = true;
    await expect(save({ task: { sound: false } })).rejects.toThrow("Perfil não encontrado");
    expect(writes).toBe(0);
  });
  it("rejects unknown client fields before writing stored future preferences", async () => {
    await expect(save({ future: { setting: "overwrite" } })).rejects.toThrow();
    expect(writes).toBe(0);
    expect(stored).toEqual(initial);
  });
  it("rejects an absent or forged caller before a profile request", async () => {
    await expect(save({}, "")).rejects.toThrow("Sessão inválida");
    await expect(save({}, "' or 1=1 --")).rejects.toThrow("Sessão inválida");
    expect(requests).toEqual([]);
  });
  it("adds event metadata to the personal history without rewriting legacy records or widening query scope", async () => {
    const result = await (
      listMyNotifications as unknown as Handler<{
        items: unknown[];
        unread: number;
        nextCursor: unknown;
      }>
    )({
      context: { userId: ME, supabase: state.admin },
    });
    expect(result.items).toEqual([
      {
        ...rows[0],
        event: { eventKey: "legacy.hiring_approval", category: "approval", moduleKey: null },
      },
    ]);
    expect(result.unread).toBe(1);
    expect(result.nextCursor).toBeNull();
    expect(requests.every((r) => r.url.searchParams.get("user_id") === `eq.${ME}`)).toBe(true);
    expect(requests.every((r) => r.method === "GET" || r.method === "HEAD")).toBe(true);
    expect(rows[0]).not.toHaveProperty("event");
  });
});
