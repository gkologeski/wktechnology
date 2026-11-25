// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  next: vi.fn(),
  create: vi.fn(),
  refresh: null as null | (() => void),
  error: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: m.error } }));
vi.mock("@/lib/timeline/activity-fetch", () => ({
  TIMELINE_PAGE_SIZE: 40,
  createTimelineFeed: m.create,
  nextTimelinePage: m.next,
}));
vi.mock("@/hooks/use-refresh-callback", () => ({
  useRefreshCallback: (f: () => void) => {
    m.refresh = f;
  },
}));
vi.mock("@/components/activity/use-history-labels", () => ({ useHistoryLabels: () => ({}) }));
vi.mock("@/lib/surveys/survey-activity.functions", () => ({
  getActivitySurveyResponses: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: () => {
      const c = { on: () => c, subscribe: () => c };
      return c;
    },
    removeChannel: vi.fn(),
  },
}));
import { useTimelineFeed } from "./use-timeline-feed";
let root: Root, host: HTMLDivElement, current: ReturnType<typeof useTimelineFeed>;
const page = () => ({
  activities: [],
  historyGroups: [],
  emailMeta: new Map(),
  hasMore: false,
  totalCount: 175,
  categoryCounts: new Map(),
});
function Harness({ id }: { id: string }) {
  current = useTimelineFeed("related_deal_id", id);
  return null;
}
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  m.create.mockImplementation((x) => x);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
it("coalesces focus and visibility reloads without overlapping timeline reads", async () => {
  let finish!: (x: unknown) => void;
  m.next.mockImplementationOnce(
    () =>
      new Promise((r) => {
        finish = r;
      }),
  );
  await act(async () => root.render(createElement(Harness, { id: "a" })));
  await act(async () => {
    m.refresh!();
    m.refresh!();
    window.dispatchEvent(new Event("online"));
  });
  expect(m.next).toHaveBeenCalledTimes(1);
  await act(async () => finish(page()));
  expect(current.totalCount).toBe(175);
  expect(m.next).toHaveBeenCalledTimes(1);
});
it("reconciles a mutation during an in-flight read exactly once", async () => {
  let finish!: (x: unknown) => void;
  m.next
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          finish = r;
        }),
    )
    .mockResolvedValue(page());
  await act(async () => root.render(createElement(Harness, { id: "a" })));
  await act(async () => {
    void current.load({ silent: true, changed: true });
    void current.load({ silent: true, changed: true });
    finish(page());
  });
  expect(m.next).toHaveBeenCalledTimes(2);
});
it("aborts the previous record and does not toast stale failures", async () => {
  let fail!: (e: Error) => void;
  m.next
    .mockImplementationOnce(
      () =>
        new Promise((_, r) => {
          fail = r;
        }),
    )
    .mockResolvedValue(page());
  await act(async () => root.render(createElement(Harness, { id: "a" })));
  const signal = m.create.mock.calls[0][0].signal as AbortSignal;
  await act(async () => root.render(createElement(Harness, { id: "b" })));
  expect(signal.aborted).toBe(true);
  await act(async () => fail(new Error("canceling statement due to statement timeout")));
  expect(m.error).not.toHaveBeenCalled();
  expect(current.totalCount).toBe(175);
});
it("preserves visible history and reports a current real failure", async () => {
  m.next.mockResolvedValueOnce(page()).mockRejectedValueOnce(new Error("database unavailable"));
  await act(async () => root.render(createElement(Harness, { id: "a" })));
  await act(async () => {
    await current.load({ silent: true });
  });
  expect(current.totalCount).toBe(175);
  expect(m.error).toHaveBeenCalledWith("database unavailable");
  expect(current.loadError).toBe("database unavailable");
});
it("exposes partialErrors without clearing loaded activities when calendar fails", async () => {
  m.next.mockResolvedValueOnce({
    ...page(),
    sourceErrors: [{ source: "calendar", message: "canceling statement due to statement timeout" }],
  });
  await act(async () => root.render(createElement(Harness, { id: "a" })));
  expect(current.totalCount).toBe(175);
  expect(current.loadError).toBeNull();
  expect(current.partialErrors).toEqual([
    { source: "calendar", message: "canceling statement due to statement timeout" },
  ]);
});
