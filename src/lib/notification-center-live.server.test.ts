import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const b = { middleware: () => b, inputValidator: () => b, handler: (f: unknown) => f };
    return b;
  },
}));
vi.mock("./access-control/active-workspace.middleware", () => ({
  requireWorkspaceContext: () => ({}),
}));
vi.mock("./access-control/work-core.server", () => ({ workRpc: state.rpc }));
import {
  getNotificationCenterBadge,
  lookupCenterNotifications,
} from "./notification-center.functions";
import {
  notificationCenterBadgeSchema,
  notificationCenterLookupInputSchema,
  parseNotificationCenterLookup,
} from "./notification-center";
const W = "aaaaaaaa-1111-4111-8111-111111111111",
  U = "bbbbbbbb-1111-4111-8111-111111111111",
  N = "cccccccc-1111-4111-8111-111111111111";
const context = { userId: U, activeWorkspaceId: W, supabase: {} };
const invoke = (fn: unknown, data: unknown, ctx = context) =>
  (fn as (input: { context: typeof context; data: unknown }) => Promise<unknown>)({
    context: ctx,
    data,
  });
beforeEach(() => {
  state.rpc.mockReset();
});
it.each([getNotificationCenterBadge, lookupCenterNotifications])(
  "rejects changed workspace before live center IO %s",
  async (fn) => {
    await expect(invoke(fn, { workspaceId: N, ids: [N] })).rejects.toThrow("workspace mudou");
    expect(state.rpc).not.toHaveBeenCalled();
  },
);
it.each([getNotificationCenterBadge, lookupCenterNotifications])(
  "requires a session actor before live center IO %s",
  async (fn) => {
    await expect(
      invoke(fn, { workspaceId: W, ids: [N] }, { ...context, userId: "" }),
    ).rejects.toThrow();
    expect(state.rpc).not.toHaveBeenCalled();
  },
);
it("live badge returns only bounded count and database timestamp without fetching page history", async () => {
  const result = { unread: 100, unreadCapped: true, checkedAt: "2026-11-20T12:00:00Z" };
  state.rpc.mockResolvedValue(result);
  await expect(invoke(getNotificationCenterBadge, { workspaceId: W })).resolves.toEqual(result);
  expect(state.rpc).toHaveBeenCalledExactlyOnceWith(context.supabase, "notification_center_badge", {
    p_workspace: W,
  });
});
it("live lookup binds explicit IDs to own selected workspace and preserves source metadata", async () => {
  state.rpc.mockResolvedValue({
    items: [
      {
        id: N,
        type: "workflow",
        title: "Notice",
        body: null,
        link: null,
        entity: "deals",
        entity_id: N,
        created_at: "2026-11-20T12:00:00Z",
        read_at: null,
        snoozed_until: null,
        moduleKey: "crm",
      },
    ],
    checkedAt: "2026-11-20T12:01:00Z",
  });
  const result = (await invoke(lookupCenterNotifications, {
    workspaceId: W,
    ids: [N, N],
  })) as ReturnType<typeof parseNotificationCenterLookup>;
  expect(result.items[0].event?.eventKey).toBe("legacy.workflow");
  expect(result.items[0].moduleKey).toBe("crm");
  expect(state.rpc).toHaveBeenCalledExactlyOnceWith(
    context.supabase,
    "notification_center_lookup",
    { p_workspace: W, p_ids: [N] },
  );
});
it.each([getNotificationCenterBadge, lookupCenterNotifications])(
  "does not fabricate empty success on denied live request %s",
  async (fn) => {
    state.rpc.mockRejectedValue(Error("source denied"));
    await expect(invoke(fn, { workspaceId: W, ids: [N] })).rejects.toThrow("source denied");
  },
);
it.each([
  { workspaceId: W, ids: [] },
  { workspaceId: W, ids: Array(31).fill(N) },
  { workspaceId: W, ids: ["bad"] },
  { workspaceId: W, ids: [N], userId: U },
])("bounds protected ID lookup %j", (input) => {
  expect(notificationCenterLookupInputSchema.safeParse(input).success).toBe(false);
});
it("rejects malformed or unbounded badge result instead of displaying a fake zero", () => {
  expect(
    notificationCenterBadgeSchema.safeParse({
      unread: -1,
      unreadCapped: false,
      checkedAt: "2026-11-20T12:00:00Z",
    }).success,
  ).toBe(false);
  expect(
    notificationCenterBadgeSchema.safeParse({
      unread: 101,
      unreadCapped: true,
      checkedAt: "2026-11-20T12:00:00Z",
    }).success,
  ).toBe(false);
  expect(() => parseNotificationCenterLookup({ items: [], checkedAt: "invalid" })).toThrow();
});
