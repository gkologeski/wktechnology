import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler: (f: unknown) => f,
    };
    return builder;
  },
}));
vi.mock("./access-control/active-workspace.middleware", () => ({
  requireWorkspaceContext: () => ({}),
}));
vi.mock("./access-control/work-core.server", () => ({ workRpc: state.rpc }));
import {
  getNotificationCenter,
  markCenterNotifications,
  snoozeCenterNotification,
  getCenterPreferences,
  saveCenterPreferences,
} from "./notification-center.functions";
import { notificationCenterQuerySchema } from "./notification-center";

const W = "aaaaaaaa-1111-4111-8111-111111111111",
  U = "bbbbbbbb-1111-4111-8111-111111111111",
  N = "cccccccc-1111-4111-8111-111111111111";
const cutoff = "2026-11-20T12:00:00Z";
const context = { userId: U, activeWorkspaceId: W, supabase: {} };
type Invoke = (arg: { context: typeof context; data: unknown }) => Promise<unknown>;
const invoke = (fn: unknown, data: unknown, ctx = context) =>
  (fn as Invoke)({ context: ctx, data });
beforeEach(() => {
  state.rpc.mockReset();
});

it("center API binds source workspace and catalog metadata without accepting user identity", async () => {
  state.rpc.mockResolvedValue({
    items: [
      {
        id: N,
        type: "workflow",
        title: "Atualização",
        body: null,
        link: null,
        entity: "deals",
        entity_id: N,
        created_at: cutoff,
        read_at: null,
        snoozed_until: null,
      },
    ],
    unread: 1,
    unreadCapped: false,
    nextCursor: null,
    cutoff,
  });
  const data = notificationCenterQuerySchema.parse({ workspaceId: W });
  const result = (await invoke(getNotificationCenter, data)) as {
    items: { event: { eventKey: string } }[];
  };
  expect(state.rpc).toHaveBeenCalledWith(
    context.supabase,
    "notification_center_list",
    expect.objectContaining({ p_workspace: W, p_cursor: null, p_scope: "workspace" }),
  );
  expect(result.items[0].event.eventKey).toBe("legacy.workflow");
  expect(() => notificationCenterQuerySchema.parse({ workspaceId: W, userId: U })).toThrow();
});

it.each([
  getNotificationCenter,
  markCenterNotifications,
  snoozeCenterNotification,
  getCenterPreferences,
  saveCenterPreferences,
])("center API refuses a workspace race before executing %s", async (fn) => {
  await expect(invoke(fn, { workspaceId: N })).rejects.toThrow("workspace mudou");
  expect(state.rpc).not.toHaveBeenCalled();
});

it("center API refuses an absent actor even with a selected workspace", async () => {
  await expect(
    invoke(getCenterPreferences, { workspaceId: W }, { ...context, userId: "" }),
  ).rejects.toThrow();
  expect(state.rpc).not.toHaveBeenCalled();
});

it("center read uses bounded IDs and the displayed snapshot and propagates database failures", async () => {
  state.rpc.mockResolvedValue({ updated: 1 });
  await expect(
    invoke(markCenterNotifications, { workspaceId: W, ids: [N, N], cutoff, read: false }),
  ).resolves.toEqual({ updated: 1 });
  expect(state.rpc).toHaveBeenLastCalledWith(context.supabase, "notification_center_mark", {
    p_workspace: W,
    p_ids: [N],
    p_cutoff: cutoff,
    p_read: false,
  });
  state.rpc.mockRejectedValue(new Error("read denied"));
  await expect(
    invoke(markCenterNotifications, { workspaceId: W, ids: [N], cutoff, read: true }),
  ).rejects.toThrow("read denied");
});

it("center snooze passes only the allowed duration and never a task mutation", async () => {
  state.rpc.mockResolvedValue({ updated: 1 });
  await invoke(snoozeCenterNotification, { workspaceId: W, id: N, minutes: 60 });
  expect(state.rpc).toHaveBeenCalledExactlyOnceWith(
    context.supabase,
    "notification_center_snooze",
    { p_workspace: W, p_id: N, p_minutes: 60 },
  );
});

it("center preferences retain the global false and isolate the personal workspace overlay", async () => {
  state.rpc.mockResolvedValue({
    settings: { categories: { workflow: { inapp: false } } },
    revision: 2,
    legacyPrefs: { mention: { sound: false } },
  });
  const r = (await invoke(getCenterPreferences, { workspaceId: W })) as {
    settings: { categories: unknown };
    legacyPrefs: { mention: { sound: boolean } };
  };
  expect(r.legacyPrefs.mention.sound).toBe(false);
  expect(r.settings.categories).toEqual({ workflow: { inapp: false } });
  expect(state.rpc).toHaveBeenCalledExactlyOnceWith(
    context.supabase,
    "notification_center_preferences",
    { p_workspace: W },
  );
});

it("center preference conflicts are visible and are not retried over another draft", async () => {
  state.rpc.mockRejectedValue(new Error("As preferências foram alteradas em outra sessão"));
  await expect(
    invoke(saveCenterPreferences, { workspaceId: W, revision: 3, patch: { summary: "daily" } }),
  ).rejects.toThrow("outra sessão");
  expect(state.rpc).toHaveBeenCalledTimes(1);
});

it("center API refuses malformed result instead of claiming an empty inbox", async () => {
  state.rpc.mockResolvedValue({ items: [], unread: -1, nextCursor: null, cutoff });
  await expect(
    invoke(getNotificationCenter, notificationCenterQuerySchema.parse({ workspaceId: W })),
  ).rejects.toThrow();
});

it.each([
  { workspaceId: W, q: "x".repeat(201) },
  { workspaceId: W, category: "unregistered" },
  { workspaceId: W, cursor: { createdAt: "invalid", id: N } },
  { workspaceId: W, scope: "all-tenants" },
])("center rejects invalid selectors before the gateway: %j", (input) => {
  expect(() => notificationCenterQuerySchema.parse(input)).toThrow();
});
