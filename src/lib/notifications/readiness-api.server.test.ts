import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  load: vi.fn(),
  list: vi.fn(),
  parsers: new Map<unknown, (value: unknown) => unknown>(),
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validator = (value: unknown) => value;
    const builder = {
      middleware: () => builder,
      inputValidator: (parse: (value: unknown) => unknown) => {
        validator = parse;
        return builder;
      },
      handler: (fn: unknown) => {
        state.parsers.set(fn, validator);
        return fn;
      },
    };
    return builder;
  },
}));
vi.mock("@/lib/access-control/active-workspace.middleware", () => ({
  requireWorkspaceContext: () => ({}),
}));
vi.mock("./readiness.server", () => ({
  loadNotificationReadiness: state.load,
  loadNotificationReadinessWorkflows: state.list,
}));
import {
  getNotificationReadiness,
  listNotificationReadinessWorkflows,
} from "./readiness.functions";

const W = "11111111-1111-4111-8111-111111111111";
const WF = "22222222-2222-4222-8222-222222222222";
const context = {
  userId: WF,
  activeWorkspaceId: W,
  supabase: { kind: "authenticated test client" },
};
const call = (data: unknown, ctx = context) =>
  (
    getNotificationReadiness as unknown as (value: {
      context: typeof context;
      data: unknown;
    }) => Promise<unknown>
  )({ context: ctx, data });
beforeEach(() => {
  state.load.mockReset();
  state.list.mockReset();
});

it("passes only the selected workspace/workflow and authenticated client to the loader", async () => {
  state.load.mockResolvedValue({ checkedAt: "controlled-result" });
  expect(
    await call(state.parsers.get(getNotificationReadiness)!({ workspaceId: W, workflowId: WF })),
  ).toEqual({
    checkedAt: "controlled-result",
  });
  expect(state.load).toHaveBeenCalledExactlyOnceWith(context.supabase, W, WF);
});
it.each([
  { ...context, activeWorkspaceId: WF },
  { ...context, userId: "" },
])("rejects a changed workspace or absent authenticated actor before the loader", async (ctx) => {
  await expect(call({ workspaceId: W, workflowId: WF }, ctx)).rejects.toThrow();
  expect(state.load).not.toHaveBeenCalled();
});
it.each([
  { workspaceId: W },
  { workspaceId: W, workflowId: WF, userId: WF },
  { workspaceId: W, workflowId: WF, execute: true },
])("rejects unselected or effect-capable API inputs: %j", (data) => {
  expect(() => state.parsers.get(getNotificationReadiness)!(data)).toThrow();
  expect(state.load).not.toHaveBeenCalled();
});

const list = (data: unknown, ctx = context) =>
  (
    listNotificationReadinessWorkflows as unknown as (value: {
      context: typeof context;
      data: unknown;
    }) => Promise<unknown>
  )({ context: ctx, data });
it("delegates the minimal selector only to the authenticated workspace loader", async () => {
  state.list.mockResolvedValue({ items: [], truncated: false });
  expect(
    await list(state.parsers.get(listNotificationReadinessWorkflows)!({ workspaceId: W })),
  ).toEqual({ items: [], truncated: false });
  expect(state.list).toHaveBeenCalledExactlyOnceWith(context.supabase, W);
  expect(() =>
    state.parsers.get(listNotificationReadinessWorkflows)!({ workspaceId: W, workflowId: WF }),
  ).toThrow();
  expect(() =>
    state.parsers.get(listNotificationReadinessWorkflows)!({ workspaceId: W, userId: WF }),
  ).toThrow();
});
it.each([
  { ...context, activeWorkspaceId: WF },
  { ...context, userId: "" },
])("refuses a selector workspace race or absent actor before its loader", async (ctx) => {
  await expect(list({ workspaceId: W }, ctx)).rejects.toThrow();
  expect(state.list).not.toHaveBeenCalled();
});
