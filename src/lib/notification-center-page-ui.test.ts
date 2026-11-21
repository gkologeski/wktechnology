// @vitest-environment jsdom
import { act, createElement, type ComponentType, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  search: { area: "central", notice: undefined, invalidNotice: undefined } as {
    area: string;
    notice?: string;
    invalidNotice?: boolean;
  },
  ws: "aaaaaaaa-1111-4111-8111-111111111111",
  user: "bbbbbbbb-1111-4111-8111-111111111111",
  readOnly: false,
  viewAs: null as { mode: "user" | "role"; readOnly: boolean } | null,
  preferenceSave: null as ((patch: unknown, revision: number) => Promise<void>) | null,
  success: vi.fn(),
  list: vi.fn(),
  lookup: vi.fn(),
  mark: vi.fn(),
  snooze: vi.fn(),
  prefs: vi.fn(),
  save: vi.fn(),
  caps: vi.fn(),
  navigate: vi.fn(),
  props: null as Record<string, unknown> | null,
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useSearch: () => state.search,
    useNavigate: () => state.navigate,
  }),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: state.user } }) }));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    workspaceId: state.ws,
    isLoading: false,
    isError: false,
    canAny: () => true,
  }),
}));
vi.mock("@/lib/view-as-client", () => ({
  readViewAs: () => state.viewAs ?? (state.readOnly ? { mode: "role", readOnly: true } : null),
}));
vi.mock("@/lib/workspaces.functions", () => ({
  listMyWorkspaces: async () => ({ workspaces: [{ id: state.ws, name: "Workspace fictício" }] }),
}));
vi.mock("@/lib/notification-delivery.functions", () => ({
  getNotificationDeliveryCapabilities: state.caps,
}));
vi.mock("@/lib/notification-center.functions", () => ({
  getNotificationCenter: state.list,
  lookupCenterNotifications: state.lookup,
  markCenterNotifications: state.mark,
  snoozeCenterNotification: state.snooze,
  getCenterPreferences: state.prefs,
  saveCenterPreferences: state.save,
}));
vi.mock("@/components/page-header", () => ({
  PageHeader: ({ title }: { title: string }) => createElement("h1", null, title),
}));
vi.mock("@/components/notifications/notification-rules-panel", () => ({
  NotificationRulesPanel: () => createElement("p", null, "Rules panel"),
}));
vi.mock("@/components/notifications/delivery-operations", () => ({
  NotificationDeliveryConfiguration: () => createElement("p", null, "Models panel"),
  NotificationDeliveryHistorySection: () => createElement("p", null, "History panel"),
  NotificationConsentSection: () => createElement("p", null, "Consent panel"),
  NotificationDigestSection: () => createElement("p", null, "Digest panel"),
}));
vi.mock("@/components/notifications/notification-preferences-panel", () => ({
  NotificationPreferencesPanel: ({
    onSave,
  }: {
    onSave: (patch: unknown, revision: number) => Promise<void>;
  }) => {
    state.preferenceSave = onSave;
    return createElement("p", null, "Preferences panel");
  },
}));
vi.mock("@/components/notifications/notification-center", () => ({
  NotificationCenter: (props: Record<string, unknown>) => {
    state.props = props;
    return createElement("p", null, "Center panel");
  },
}));
vi.mock("sonner", () => ({ toast: { success: state.success } }));
import { Route } from "@/routes/_authenticated/notifications";
import { normalizeCenterSettings } from "./notification-center-preferences";
import { normalizeNotificationPrefs } from "./notification-preferences";
const options = Route.options as unknown as {
  component: ComponentType;
  validateSearch: (data: Record<string, unknown>) => typeof state.search;
};
const Page = options.component;
const id = "cccccccc-1111-4111-8111-111111111111",
  cutoff = "2026-11-20T11:00:00Z",
  checkedAt = "2026-11-20T12:00:00Z";
const row = {
  id,
  type: "workflow",
  title: "Authorized row",
  body: null,
  entity: "deals",
  entity_id: id,
  link: null,
  created_at: "2026-11-20T10:00:00Z",
  read_at: null,
  snoozed_until: null,
  moduleKey: "crm",
  event: { eventKey: "legacy.workflow", category: "workflow", moduleKey: null },
};
let root: Root, host: HTMLDivElement, client: QueryClient;
async function settle() {
  await act(async () => {
    await new Promise((done) => setTimeout(done, 25));
  });
}
async function render() {
  await act(async () =>
    root.render(createElement(QueryClientProvider, { client }, createElement(Page))),
  );
  await settle();
}
function deferred<T>() {
  let resolve!: (data: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function props() {
  expect(state.props).not.toBeNull();
  return state.props!;
}
async function invoke(name: string, ...args: unknown[]) {
  await act(async () => {
    (props()[name] as (...input: unknown[]) => void)(...args);
  });
  await settle();
}
beforeEach(() => {
  vi.clearAllMocks();
  state.search = { area: "central" };
  state.ws = "aaaaaaaa-1111-4111-8111-111111111111";
  state.user = "bbbbbbbb-1111-4111-8111-111111111111";
  state.readOnly = false;
  state.viewAs = null;
  state.preferenceSave = null;
  state.props = null;
  state.list.mockResolvedValue({
    items: [row],
    unread: 1,
    unreadCapped: false,
    nextCursor: null,
    cutoff,
  });
  state.lookup.mockResolvedValue({ items: [row], checkedAt });
  state.mark.mockResolvedValue({ updated: 1 });
  state.snooze.mockResolvedValue({ updated: 1 });
  state.prefs.mockResolvedValue({
    settings: normalizeCenterSettings({}),
    legacyPrefs: normalizeNotificationPrefs({}),
    revision: 0,
  });
  state.save.mockResolvedValue({});
  state.caps.mockResolvedValue({
    settingsView: true,
    settingsManage: true,
    deliveriesView: true,
    deliveriesWorkspaceView: true,
    whatsappConfigure: false,
  });
  state.navigate.mockImplementation(async ({ search }: { search: typeof state.search }) => {
    state.search = search;
  });
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 60_000 },
      mutations: { retry: false },
    },
  });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  host.remove();
});
it("route search validates notice identity and restricts areas without turning invalid input into a data failure", () => {
  expect(options.validateSearch({ area: "preferences", notice: id })).toEqual({
    area: "preferences",
    notice: undefined,
    invalidNotice: undefined,
  });
  expect(options.validateSearch({ area: "other", notice: "bad" })).toEqual({
    area: "central",
    notice: undefined,
    invalidNotice: true,
  });
  expect(options.validateSearch({ notice: id })).toEqual({
    area: "central",
    notice: id,
    invalidNotice: undefined,
  });
});
it("opens workspace preferences directly without fetching or polling central list", async () => {
  state.search = { area: "preferences" };
  await render();
  expect(host.textContent).toContain("Preferences panel");
  expect(state.list).not.toHaveBeenCalled();
  expect(state.lookup).not.toHaveBeenCalled();
});
it("central actions are suspended during the search debounce and while the new result is loading", async () => {
  await render();
  const filtered = deferred<unknown>();
  state.list.mockImplementation(({ data }: { data: { q: string } }) =>
    data.q
      ? filtered.promise
      : Promise.resolve({ items: [row], unread: 1, unreadCapped: false, nextCursor: null, cutoff }),
  );
  await invoke("onFilters", {
    scope: "workspace",
    status: "all",
    category: "",
    module: "",
    q: "new term",
  });
  expect(props().searchPending).toBe(true);
  expect(props().items).toEqual([]);
  expect(props().unread).toBeNull();
  await invoke("onRead", [id], true);
  expect(state.mark).not.toHaveBeenCalled();
  await act(async () => {
    await new Promise((done) => setTimeout(done, 280));
  });
  expect(props().loading).toBe(true);
  expect(props().items).toEqual([]);
  filtered.resolve({ items: [], unread: 0, unreadCapped: false, nextCursor: null, cutoff });
  await settle();
  expect(props().items).toEqual([]);
  expect(props().unread).toBe(0);
});
it("revalidation error hides cached content and blocks stale batch writes", async () => {
  await render();
  state.list.mockRejectedValue(Error("permission changed"));
  await invoke("onRetry");
  expect(props().error).toBe("permission changed");
  expect(props().items).toEqual([]);
  expect(props().unread).toBeNull();
  await invoke("onRead", [id], true);
  expect(state.mark).not.toHaveBeenCalled();
});
it("focused item outside first page is revalidated by ID and uses database checkedAt on explicit read", async () => {
  state.search = { area: "central", notice: id };
  state.list.mockResolvedValue({
    items: [],
    unread: 0,
    unreadCapped: false,
    nextCursor: null,
    cutoff,
  });
  await render();
  await settle();
  expect(state.lookup).toHaveBeenCalledWith({ data: { workspaceId: state.ws, ids: [id] } });
  expect((props().focusedItem as { id: string }).id).toBe(id);
  expect(state.mark).not.toHaveBeenCalled();
  await invoke("onRead", [id], true);
  expect(state.mark).toHaveBeenCalledWith({
    data: { workspaceId: state.ws, ids: [id], read: true, cutoff: checkedAt },
  });
});
it("unavailable focused item is a detail failure, preserving the central list and blocking snooze", async () => {
  state.search = { area: "central", notice: id };
  state.list.mockResolvedValue({
    items: [{ ...row, id: "dddddddd-1111-4111-8111-111111111111" }],
    unread: 1,
    unreadCapped: false,
    nextCursor: null,
    cutoff,
  });
  state.lookup.mockResolvedValue({ items: [], checkedAt });
  await render();
  await settle();
  expect(props().detailError).toContain("indisponível");
  expect(props().items as unknown[]).toHaveLength(1);
  await invoke("onSnooze", id, 60);
  expect(state.snooze).not.toHaveBeenCalled();
});
it("legacy view clears text and module filters before querying masked history", async () => {
  await render();
  await invoke("onFilters", {
    scope: "legacy",
    status: "all",
    category: "",
    module: "crm",
    q: "PRIVATE",
  });
  expect(state.list).toHaveBeenLastCalledWith({
    data: expect.objectContaining({ scope: "legacy", q: "", module: null }),
  });
  expect(props().filters).toEqual({
    scope: "legacy",
    status: "all",
    category: "",
    module: "",
    q: "",
  });
});
it("read-only view displays readable notices with mutations disabled at UI and wrapper", async () => {
  state.readOnly = true;
  await render();
  expect(props().pending).toBe(true);
  expect(props().items as unknown[]).toHaveLength(1);
  await invoke("onRead", [id], true);
  await invoke("onSnooze", id, 60);
  expect(state.mark).not.toHaveBeenCalled();
  expect(state.snooze).not.toHaveBeenCalled();
  expect(host.textContent).toContain("somente leitura");
});
it("changing workspace remounts context and does not render or mutate an old response", async () => {
  const old = deferred<unknown>();
  state.list.mockReturnValue(old.promise);
  await render();
  state.ws = "eeeeeeee-1111-4111-8111-111111111111";
  state.list.mockResolvedValue({
    items: [],
    unread: 0,
    unreadCapped: false,
    nextCursor: null,
    cutoff,
  });
  await render();
  old.resolve({ items: [row], unread: 1, unreadCapped: false, nextCursor: null, cutoff });
  await settle();
  expect(props().items).toEqual([]);
  expect(state.mark).not.toHaveBeenCalled();
});

it("reentering central revalidates a fresh global cache before revealing an old notice", async () => {
  await render();
  expect(state.list).toHaveBeenCalledTimes(1);
  expect(props().items as unknown[]).toHaveLength(1);
  state.search = { area: "preferences" };
  await render();
  const refreshed = deferred<unknown>();
  state.list.mockReturnValue(refreshed.promise);
  state.search = { area: "central" };
  await render();
  expect(state.list).toHaveBeenCalledTimes(2);
  expect(props().items).toEqual([]);
  expect(props().unread).toBeNull();
  refreshed.resolve({ items: [], unread: 0, unreadCapped: false, nextCursor: null, cutoff });
  await settle();
  expect(props().items).toEqual([]);
});
it("reentering focused notice revalidates its cached detail before revealing it", async () => {
  state.search = { area: "central", notice: id };
  state.list.mockResolvedValue({
    items: [],
    unread: 0,
    unreadCapped: false,
    nextCursor: null,
    cutoff,
  });
  await render();
  await settle();
  expect((props().focusedItem as { id: string }).id).toBe(id);
  state.search = { area: "preferences" };
  await render();
  const refreshed = deferred<unknown>();
  state.lookup.mockReturnValue(refreshed.promise);
  state.search = { area: "central", notice: id };
  await render();
  await settle();
  expect(state.lookup).toHaveBeenCalledTimes(2);
  expect(props().focusedItem).toBeNull();
  refreshed.resolve({ items: [], checkedAt });
  await settle();
  expect(props().focusedItem).toBeNull();
  expect(props().detailError).toContain("indisponível");
});
it("view-as user mode preserves allowed personal mutations when readOnly is false", async () => {
  state.viewAs = { mode: "user", readOnly: false };
  await render();
  expect(props().pending).toBe(false);
  await invoke("onRead", [id], true);
  expect(state.mark).toHaveBeenCalledOnce();
});
it("route normalizes uppercase UUID deep links to the SQL UUID representation", () => {
  expect(options.validateSearch({ notice: id.toUpperCase() }).notice).toBe(id);
});
it("a preferences save completed after workspace change does not confirm in the new context", async () => {
  state.search = { area: "preferences" };
  await render();
  const saved = deferred<unknown>();
  state.save.mockReturnValue(saved.promise);
  const oldSave = state.preferenceSave!;
  let pending!: Promise<void>;
  await act(async () => {
    pending = oldSave({ summary: "daily" }, 0);
  });
  state.ws = "eeeeeeee-1111-4111-8111-111111111111";
  await render();
  saved.resolve({});
  await act(async () => {
    await pending;
  });
  expect(state.success).not.toHaveBeenCalled();
});
it("preferences mutation wrapper also refuses a read-only session", async () => {
  state.search = { area: "preferences" };
  state.readOnly = true;
  await render();
  await expect(state.preferenceSave!({ summary: "daily" }, 0)).rejects.toThrow("indisponíveis");
  expect(state.save).not.toHaveBeenCalled();
  expect(host.querySelector("fieldset")?.disabled).toBe(true);
});
