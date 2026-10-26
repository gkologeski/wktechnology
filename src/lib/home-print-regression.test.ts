// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ keys: [] as unknown[], search: {} as Record<string, unknown> }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: Record<string, unknown>) => ({
    ...config,
    useSearch: () => state.search,
  }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: { queryKey: unknown }) => {
    state.keys.push(options.queryKey);
    return { isLoading: true };
  },
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => vi.fn() }));
vi.mock("@/lib/home/dashboard.functions", () => ({ exportHomeDashboard: vi.fn() }));
vi.mock("@/lib/access-control/use-shared-action", () => ({ useSharedAction: () => true }));
import { Route } from "@/routes/_authenticated/home.print";
const route = Route as unknown as {
  validateSearch: (v: unknown) => { autoprint?: string };
  component: () => React.ReactNode;
};
it("accepts numeric router query parameters produced by the print button", () => {
  for (const value of [0, 1, "0", "1"])
    expect(route.validateSearch({ autoprint: value }).autoprint).toBe(String(value));
  expect(() => route.validateSearch({ autoprint: 2 })).toThrow();
});
it("keeps the default period stable across rerenders", async () => {
  const node = document.createElement("div");
  const root = createRoot(node);
  state.keys = [];
  state.search = {};
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-26T10:00:00Z"));
  try {
    await act(async () => root.render(createElement(route.component)));
    vi.setSystemTime(new Date("2026-10-26T10:01:00Z"));
    await act(async () => root.render(createElement(route.component)));
    expect(state.keys.length).toBeGreaterThanOrEqual(2);
    expect(state.keys.at(-1)).toEqual(state.keys[0]);
  } finally {
    await act(async () => root.unmount());
    vi.useRealTimers();
  }
});
