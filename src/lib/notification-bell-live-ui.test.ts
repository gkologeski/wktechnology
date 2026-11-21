// @vitest-environment jsdom
import { act, createElement, type ReactNode, type MouseEvent as ReactMouseEvent } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  user: "11111111-1111-4111-8111-111111111111" as string | null,
  workspace: "22222222-2222-4222-8222-222222222222" as string | null,
  loading: false,
  error: false,
  viewAs: null as { mode: "user" | "role"; readOnly?: boolean } | null,
  subscriptions: [] as {
    event: string;
    callback: (payload: { new?: unknown; old?: unknown }) => void;
  }[],
  badge: vi.fn<(input: unknown) => Promise<unknown>>(),
  list: vi.fn<(input: unknown) => Promise<unknown>>(),
  lookup: vi.fn<(input: unknown) => Promise<unknown>>(),
  prefs: vi.fn<(input: unknown) => Promise<unknown>>(),
  mark: vi.fn<(input: unknown) => Promise<unknown>>(),
  toast: vi.fn(),
  toastError: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/notification-center.functions", () => ({
  getNotificationCenterBadge: (input: unknown) => state.badge(input),
  getNotificationCenter: (input: unknown) => state.list(input),
  lookupCenterNotifications: (input: unknown) => state.lookup(input),
  getCenterPreferences: (input: unknown) => state.prefs(input),
  markCenterNotifications: (input: unknown) => state.mark(input),
}));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: state.user ? { id: state.user } : null }),
}));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    workspaceId: state.workspace,
    isLoading: state.loading,
    isError: state.error,
  }),
}));
vi.mock("@/lib/view-as-client", () => ({
  readViewAs: () => state.viewAs,
}));
vi.mock("@/lib/crm", () => ({ formatDateTime: (value: string) => value }));
vi.mock("sonner", () => ({ toast: { message: state.toast, error: state.toastError } }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: () => {
      const channel = {
        on: (
          _kind: unknown,
          options: { event: string },
          callback: (payload: { new?: unknown; old?: unknown }) => void,
        ) => {
          state.subscriptions.push({ event: options.event, callback });
          return channel;
        },
        subscribe: () => channel,
      };
      return channel;
    },
    removeChannel: state.remove,
  },
}));
vi.mock("@/components/ui/popover", async () => {
  const React = await import("react");
  const Context = React.createContext<{ open: boolean; onOpenChange: (value: boolean) => void }>({
    open: false,
    onOpenChange: (_value: boolean) => undefined,
  });
  return {
    Popover: ({
      children,
      open,
      onOpenChange,
    }: {
      children: ReactNode;
      open: boolean;
      onOpenChange: (value: boolean) => void;
    }) => createElement(Context.Provider, { value: { open, onOpenChange } }, children),
    PopoverTrigger: ({ children }: { children: React.ReactElement }) => {
      const c = React.useContext(Context);
      return React.cloneElement(children as React.ReactElement<{ onClick: () => void }>, {
        onClick: () => c.onOpenChange(!c.open),
      });
    },
    PopoverContent: ({ children }: { children: ReactNode }) => {
      const c = React.useContext(Context);
      return c.open ? createElement("section", { role: "dialog" }, children) : null;
    },
  };
});
vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => createElement("div", null, children),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    search,
    onClick,
  }: {
    children?: ReactNode;
    to: string;
    search?: unknown;
    onClick?: () => void;
  }) =>
    createElement(
      "a",
      {
        href: to,
        "data-search": JSON.stringify(search),
        onClick: (e: ReactMouseEvent<HTMLAnchorElement>) => {
          e.preventDefault();
          onClick?.();
        },
      },
      children,
    ),
}));
import { NotificationsBell } from "@/components/notifications-bell";
import { DEFAULT_CENTER_SETTINGS } from "./notification-center-preferences";
import { DEFAULT_NOTIFICATION_PREFS } from "./notification-preferences";
const NOW = "2026-11-20T12:00:00Z",
  W = "22222222-2222-4222-8222-222222222222",
  U = "11111111-1111-4111-8111-111111111111";
const id = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const notice = (n: number, patch: Record<string, unknown> = {}) => ({
  id: id(n),
  type: "mention",
  title: `PRIVATE Notice ${n}`,
  body: "PRIVATE body",
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
const page = (n = 1) => ({
  items: [notice(n)],
  unread: 1,
  unreadCapped: false,
  nextCursor: null,
  cutoff: NOW,
});
let host: HTMLDivElement, root: Root, qc: QueryClient;
async function settle(ms = 1) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}
async function render() {
  await act(async () => {
    root.render(
      createElement(QueryClientProvider, { client: qc }, createElement(NotificationsBell)),
    );
  });
  await settle();
}
async function click(text: string) {
  const target = Array.from(host.querySelectorAll("button,a")).find(
    (x) => x.textContent?.trim() === text || x.getAttribute("aria-label") === text,
  );
  expect(target, text).toBeDefined();
  await act(async () => {
    target!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await settle();
}
function event(kind: string, payload: { new?: unknown; old?: unknown }) {
  const subscription = [...state.subscriptions].reverse().find((x) => x.event === kind);
  expect(subscription).toBeDefined();
  subscription!.callback(payload);
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
  state.user = U;
  state.workspace = W;
  state.loading = false;
  state.error = false;
  state.viewAs = null;
  state.subscriptions = [];
  state.badge.mockResolvedValue({ unread: 1, unreadCapped: false, checkedAt: NOW });
  state.list.mockResolvedValue(page());
  state.lookup.mockImplementation(async (input) => ({
    items: (input as { data: { ids: string[] } }).data.ids.map((value) => notice(1, { id: value })),
    checkedAt: new Date().toISOString(),
  }));
  state.prefs.mockResolvedValue({
    settings: structuredClone(DEFAULT_CENTER_SETTINGS),
    legacyPrefs: structuredClone(DEFAULT_NOTIFICATION_PREFS),
  });
  state.mark.mockResolvedValue({ updated: 1 });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: 60_000 },
      mutations: { retry: false },
    },
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  qc.clear();
  host.remove();
  vi.useRealTimers();
});
describe("bell has a bounded separate counter and authorized open-only list", () => {
  it("fetches only the lightweight counter while closed, even after a polling interval", async () => {
    await render();
    expect(state.badge).toHaveBeenCalledTimes(1);
    expect(state.list).not.toHaveBeenCalled();
    expect(state.prefs).not.toHaveBeenCalled();
    await settle(60_000);
    expect(state.badge).toHaveBeenCalledTimes(2);
    expect(state.list).not.toHaveBeenCalled();
  });
  it("loads the list on open and closes the popover when navigating to a real record", async () => {
    await render();
    await click("Notificações");
    await settle();
    expect(state.list).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    await click("PRIVATE Notice 1PRIVATE body2026-11-20T12:00:00Z");
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(state.mark).toHaveBeenCalledTimes(1);
  });
  it("opens a notice without a source link in the personal central with its ID selected", async () => {
    state.list.mockResolvedValue({
      ...page(),
      items: [notice(1, { link: null, entity: null, entity_id: null })],
    });
    await render();
    await click("Notificações");
    await settle();
    const link = Array.from(host.querySelectorAll("a")).find((x) =>
      x.textContent?.includes("PRIVATE Notice"),
    )!;
    expect(link.getAttribute("href")).toBe("/notifications");
    expect(JSON.parse(link.getAttribute("data-search")!)).toEqual({
      area: "central",
      notice: id(1),
    });
  });
  it("uses the workspace preferences area and closes on navigation", async () => {
    await render();
    await click("Notificações");
    const link = Array.from(host.querySelectorAll("a")).find(
      (x) => x.textContent === "Preferências",
    )!;
    expect(link.href).toContain("/notifications");
    expect(JSON.parse(link.getAttribute("data-search")!)).toEqual({ area: "preferences" });
    await click("Preferências");
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });
  it("caps the short bell history at three pages and prunes older pages on close", async () => {
    state.list.mockImplementation(async (input) => {
      const cursor = (input as { data: { cursor?: { id: string } } }).data.cursor;
      const n = cursor ? Number.parseInt(cursor.id.slice(-12), 16) + 1 : 1;
      return { ...page(n), nextCursor: { id: id(n), createdAt: NOW } };
    });
    await render();
    await click("Notificações");
    await click("Carregar anteriores");
    await click("Carregar anteriores");
    expect(state.list).toHaveBeenCalledTimes(3);
    expect(host.textContent).toContain("Consulte a central para continuar no histórico");
    expect(
      Array.from(host.querySelectorAll("button")).some(
        (x) => x.textContent === "Carregar anteriores",
      ),
    ).toBe(false);
    await click("Notificações");
    await settle();
    const cached = qc.getQueryData<{ pages: unknown[] }>(["notification-center", U, W, "bell"]);
    expect(cached?.pages).toHaveLength(1);
    const before = state.list.mock.calls.length;
    await settle(60_000);
    expect(state.list).toHaveBeenCalledTimes(before);
  });
  it("hides a cached badge after a counter failure without pretending zero unread", async () => {
    await render();
    expect(host.querySelector('[aria-label="Notificações não lidas"]')).not.toBeNull();
    state.badge.mockRejectedValueOnce(Error("counter denied"));
    await act(async () => {
      await qc.invalidateQueries({ queryKey: ["notification-center", U, W, "badge"] });
    });
    await settle();
    expect(host.querySelector('[aria-label="Notificações não lidas"]')).toBeNull();
    await click("Notificações");
    expect(host.textContent).toContain("Contador indisponível");
  });
  it("does not offer stale row mutations or more pages after list authorization fails", async () => {
    await render();
    await click("Notificações");
    await settle();
    state.list.mockRejectedValueOnce(Error("source denied"));
    await act(async () => {
      await qc.invalidateQueries({ queryKey: ["notification-center", U, W, "bell"] });
    });
    await settle();
    expect(host.textContent).toContain("Não foi possível carregar");
    expect(host.textContent).not.toContain("PRIVATE Notice");
    expect(host.textContent).not.toContain("Marcar carregadas");
    expect(host.textContent).not.toContain("Carregar anteriores");
  });
  it("keeps read-only navigation available without changing read state", async () => {
    state.viewAs = { mode: "role", readOnly: true };
    await render();
    await click("Notificações");
    expect(host.textContent).not.toContain("Marcar carregadas");
    await click("PRIVATE Notice 1PRIVATE body2026-11-20T12:00:00Z");
    expect(state.mark).not.toHaveBeenCalled();
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });
  it("does not show one workspace's cached contents while permissions are unknown", async () => {
    await render();
    await click("Notificações");
    expect(host.textContent).toContain("PRIVATE Notice");
    state.loading = true;
    await render();
    expect(host.textContent).not.toContain("PRIVATE Notice");
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(host.querySelector('[aria-label="Notificações não lidas"]')).toBeNull();
  });
  it("coalesces inserts into one neutral toast with no raw provider content", async () => {
    await render();
    for (let n = 1; n <= 40; n++)
      event("INSERT", {
        new: { id: id(n), title: "FORGED provider title", body: "FORGED secret" },
      });
    await settle(100);
    expect(
      state.lookup.mock.calls.map(([r]) => (r as { data: { ids: string[] } }).data.ids.length),
    ).toEqual([30, 10]);
    expect(state.prefs).toHaveBeenCalledTimes(1);
    expect(state.toast).toHaveBeenCalledExactlyOnceWith(
      "Novos avisos disponíveis",
      expect.objectContaining({ description: expect.any(String) }),
    );
    expect(JSON.stringify(state.toast.mock.calls)).not.toContain("PRIVATE");
    expect(JSON.stringify(state.toast.mock.calls)).not.toContain("FORGED");
  });
  it("updates read/snooze state silently and invalidates only this identity's prefix", async () => {
    await render();
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    event("UPDATE", { new: { id: id(1), body: "FORGED" } });
    event("UPDATE", { new: { id: id(2) } });
    await settle(100);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["notification-center", U, W] });
    expect(state.lookup).not.toHaveBeenCalled();
    expect(state.toast).not.toHaveBeenCalled();
  });
  it("ignores foreign or uncached DELETE IDs but refreshes a known own closed-head item", async () => {
    await render();
    await click("Notificações");
    await click("Notificações");
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    event("DELETE", { old: { id: id(99), body: "FORGED" } });
    await settle(100);
    expect(invalidate).not.toHaveBeenCalled();
    event("DELETE", { old: { id: id(1) } });
    await settle(100);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(state.toast).not.toHaveBeenCalled();
  });
  it("drops a callback from an old workspace before lookup, cache invalidation or toast", async () => {
    await render();
    const old = state.subscriptions.find((x) => x.event === "INSERT")!.callback;
    state.workspace = "33333333-3333-4333-8333-333333333333";
    await render();
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    old({ new: { id: id(1) } });
    await settle(100);
    expect(state.lookup).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
    expect(state.toast).not.toHaveBeenCalled();
    expect(state.remove).toHaveBeenCalled();
  });
});

it("does not attach central search fields to a real source route", async () => {
  await render();
  await click("Notificações");
  await settle();
  const link = Array.from(host.querySelectorAll("a")).find((x) =>
    x.textContent?.includes("PRIVATE Notice"),
  )!;
  expect(link.getAttribute("href")).toBe(`/deals/${id(900)}`);
  expect(link.getAttribute("data-search")).toBeNull();
  expect(link.querySelector("[title]")?.getAttribute("title")).toBe("PRIVATE Notice 1");
});
it("always reauthorizes on reopening even when the global cache is still fresh for 60 seconds", async () => {
  await render();
  await click("Notificações");
  await click("Notificações");
  let resolve!: (data: unknown) => void;
  state.list.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  await click("Notificações");
  expect(host.textContent).toContain("Carregando notificações");
  expect(host.textContent).not.toContain("PRIVATE Notice");
  expect(host.textContent).not.toContain("Marcar carregadas");
  resolve({ ...page(), items: [] });
  await settle();
  expect(host.textContent).toContain("Nenhuma notificação");
});
it("ignores malformed record payloads instead of trusting provider fields", async () => {
  await render();
  const invalidate = vi.spyOn(qc, "invalidateQueries");
  event("INSERT", { new: null });
  event("INSERT", { new: { id: "bad", title: "PRIVATE forged" } });
  event("UPDATE", { new: undefined });
  event("DELETE", { old: null });
  await settle(100);
  expect(invalidate).not.toHaveBeenCalled();
  expect(state.lookup).not.toHaveBeenCalled();
  expect(state.toast).not.toHaveBeenCalled();
});
it("cancels an older-page request when closing so its late response cannot restore history", async () => {
  state.list.mockResolvedValueOnce({ ...page(), nextCursor: { id: id(1), createdAt: NOW } });
  await render();
  await click("Notificações");
  let resolve!: (data: unknown) => void;
  state.list.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  await click("Carregar anteriores");
  await click("Notificações");
  resolve(page(2));
  await settle();
  expect(
    qc.getQueryData<{ pages: unknown[] }>(["notification-center", U, W, "bell"])?.pages,
  ).toHaveLength(1);
  expect(host.querySelector('[role="dialog"]')).toBeNull();
});

it("allows personal read actions in a real user impersonation that is not read-only", async () => {
  state.viewAs = { mode: "user", readOnly: false };
  await render();
  await click("Notificações");
  expect(host.textContent).toContain("Marcar carregadas");
  await click("PRIVATE Notice 1PRIVATE body2026-11-20T12:00:00Z");
  expect(state.mark).toHaveBeenCalledTimes(1);
});
it("keeps legacy role view read-only even when its explicit flag is absent", async () => {
  state.viewAs = { mode: "role" };
  await render();
  await click("Notificações");
  expect(host.textContent).not.toContain("Marcar carregadas");
  await click("PRIVATE Notice 1PRIVATE body2026-11-20T12:00:00Z");
  expect(state.mark).not.toHaveBeenCalled();
});
