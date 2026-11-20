// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const WS = "aaaaaaaa-1111-4111-8111-111111111111";
const state = vi.hoisted(() => ({
  workspace: "aaaaaaaa-1111-4111-8111-111111111111" as string | null,
  loading: false,
  error: false,
  channelView: false,
  calls: {} as Record<
    string,
    ReturnType<typeof vi.fn<(input: { data: Record<string, unknown> }) => Promise<unknown>>>
  >,
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    workspaceId: state.workspace,
    isLoading: state.loading,
    isError: state.error,
    can: () => state.channelView,
    canAny: () => state.channelView,
  }),
}));
vi.mock("@/lib/notification-delivery.functions", () => {
  const names = [
    "getNotificationDeliverySettings",
    "saveNotificationDeliverySettings",
    "listNotificationWhatsAppSenders",
    "listNotificationWhatsAppTemplates",
    "listNotificationDeliveryHistory",
    "getNotificationDeliveryConsent",
    "saveNotificationDeliveryConsent",
    "updateNotificationProfilePhone",
  ];
  return Object.fromEntries(
    names.map((name) => [
      name,
      (input: { data: Record<string, unknown> }) => state.calls[name](input),
    ]),
  );
});
vi.mock("@/components/notifications/delivery-settings-panel", () => ({
  DeliverySettingsPanel: ({ canEdit }: { canEdit: boolean }) =>
    createElement("p", null, canEdit ? "Policy editable" : "Policy readonly"),
}));
vi.mock("@/components/notifications/delivery-models-panel", () => ({
  DeliveryModelsPanel: () => createElement("p", null, "Model preview"),
}));
vi.mock("@/components/notifications/delivery-history-panel", () => ({
  DeliveryHistoryPanel: ({
    items,
    canWorkspace,
    filters,
    onFilters,
  }: {
    items: { id: string }[];
    canWorkspace: boolean;
    filters: { scope: string };
    onFilters: (value: unknown) => void;
  }) =>
    createElement(
      "div",
      null,
      createElement("span", null, items.map((x) => x.id).join(",")),
      createElement("p", null, filters.scope),
      canWorkspace &&
        createElement(
          "button",
          { onClick: () => onFilters({ ...filters, scope: "workspace" }) },
          "Workspace scope",
        ),
    ),
}));
vi.mock("@/components/notifications/notification-consent-panel", () => ({
  NotificationConsentPanel: ({ canEdit }: { canEdit: boolean }) =>
    createElement("p", null, canEdit ? "Own consent editable" : "Own consent readonly"),
}));
import {
  NotificationConsentSection,
  NotificationDeliveryConfiguration,
  NotificationDeliveryHistorySection,
} from "@/components/notifications/delivery-operations";
import { DEFAULT_NOTIFICATION_DELIVERY_POLICY } from "./notifications/delivery-types";

let root: Root, host: HTMLDivElement, client: QueryClient;
beforeEach(() => {
  state.workspace = WS;
  state.loading = false;
  state.error = false;
  state.channelView = false;
  const values: Record<string, unknown> = {
    getNotificationDeliverySettings: { policy: DEFAULT_NOTIFICATION_DELIVERY_POLICY, revision: 0 },
    listNotificationWhatsAppSenders: { items: [] },
    listNotificationWhatsAppTemplates: { items: [], senderId: "12345" },
    listNotificationDeliveryHistory: { items: [], nextCursor: null },
    getNotificationDeliveryConsent: { phone: null, consent: null },
  };
  for (const name of [
    "getNotificationDeliverySettings",
    "saveNotificationDeliverySettings",
    "listNotificationWhatsAppSenders",
    "listNotificationWhatsAppTemplates",
    "listNotificationDeliveryHistory",
    "getNotificationDeliveryConsent",
    "saveNotificationDeliveryConsent",
    "updateNotificationProfilePhone",
  ])
    state.calls[name] = vi
      .fn<(input: { data: Record<string, unknown> }) => Promise<unknown>>()
      .mockResolvedValue(values[name] ?? {});
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  host.remove();
  vi.clearAllMocks();
});
async function render(node: ReactNode) {
  await act(async () => {
    root.render(createElement(QueryClientProvider, { client }, node));
    await new Promise((resolve) => setTimeout(resolve, 15));
  });
}
const caps = {
  settingsView: true,
  settingsManage: false,
  deliveriesView: true,
  deliveriesWorkspaceView: false,
  whatsappConfigure: false,
};
it("does not query configuration before the active workspace is confirmed", async () => {
  state.workspace = null;
  await render(
    createElement(NotificationDeliveryConfiguration, {
      workspaceId: WS,
      userId: "user",
      capabilities: caps,
    }),
  );
  expect(host.textContent).toContain("Aguardando confirmação");
  expect(state.calls.getNotificationDeliverySettings).not.toHaveBeenCalled();
  expect(state.calls.listNotificationWhatsAppSenders).not.toHaveBeenCalled();
});
it("does not query or reveal configuration using another workspace context", async () => {
  state.workspace = "bbbbbbbb-1111-4111-8111-111111111111";
  await render(
    createElement(NotificationDeliveryConfiguration, {
      workspaceId: WS,
      userId: "user",
      capabilities: caps,
    }),
  );
  expect(state.calls.getNotificationDeliverySettings).not.toHaveBeenCalled();
  expect(host.textContent).not.toContain("Model preview");
});
it("does not request the workspace policy without its explicit view capability", async () => {
  await render(
    createElement(NotificationDeliveryConfiguration, {
      workspaceId: WS,
      userId: "user",
      capabilities: { ...caps, settingsView: false },
    }),
  );
  expect(state.calls.getNotificationDeliverySettings).not.toHaveBeenCalled();
  expect(host.textContent).toContain("Sem permissão");
});
it("reads email policy without querying WhatsApp metadata for a restricted user", async () => {
  await render(
    createElement(NotificationDeliveryConfiguration, {
      workspaceId: WS,
      userId: "user",
      capabilities: caps,
    }),
  );
  await vi.waitFor(() => expect(host.textContent).toContain("Policy readonly"));
  expect(state.calls.getNotificationDeliverySettings).toHaveBeenCalledExactlyOnceWith({
    data: { workspaceId: WS },
  });
  expect(state.calls.listNotificationWhatsAppSenders).not.toHaveBeenCalled();
  expect(state.calls.listNotificationWhatsAppTemplates).not.toHaveBeenCalled();
});
it("keeps personal consent available without granting any channel-management permission", async () => {
  await render(createElement(NotificationConsentSection, { workspaceId: WS, userId: "user" }));
  await vi.waitFor(() => expect(host.textContent).toContain("Own consent editable"));
  expect(state.calls.getNotificationDeliveryConsent).toHaveBeenCalledExactlyOnceWith({
    data: { workspaceId: WS },
  });
  expect(state.calls.listNotificationWhatsAppSenders).not.toHaveBeenCalled();
  expect(state.calls.saveNotificationDeliveryConsent).not.toHaveBeenCalled();
});
it("does not query personal consent when permission loading fails", async () => {
  state.error = true;
  await render(createElement(NotificationConsentSection, { workspaceId: WS, userId: "user" }));
  expect(state.calls.getNotificationDeliveryConsent).not.toHaveBeenCalled();
  expect(host.textContent).toContain("Aguardando confirmação");
});
it("history defaults to own and does not expose workspace scope without capability", async () => {
  await render(
    createElement(NotificationDeliveryHistorySection, {
      workspaceId: WS,
      userId: "user",
      canWorkspace: false,
    }),
  );
  await vi.waitFor(() => expect(state.calls.listNotificationDeliveryHistory).toHaveBeenCalled());
  expect(state.calls.listNotificationDeliveryHistory.mock.calls[0][0].data).toMatchObject({
    workspaceId: WS,
    scope: "own",
  });
  expect(host.querySelector("button")).toBeNull();
});
it("history does not execute a query before confirming the current workspace", async () => {
  state.loading = true;
  await render(
    createElement(NotificationDeliveryHistorySection, {
      workspaceId: WS,
      userId: "user",
      canWorkspace: true,
    }),
  );
  expect(state.calls.listNotificationDeliveryHistory).not.toHaveBeenCalled();
});
it("removes cached workspace history immediately when its capability is revoked", async () => {
  state.calls.listNotificationDeliveryHistory.mockImplementation(async ({ data }) => ({
    items: [{ id: data.scope === "workspace" ? "WORKSPACE_PRIVATE" : "OWN_ONLY" }],
    nextCursor: null,
  }));
  await render(
    createElement(NotificationDeliveryHistorySection, {
      workspaceId: WS,
      userId: "user",
      canWorkspace: true,
    }),
  );
  await act(async () => {
    host.querySelector("button")!.click();
    await new Promise((resolve) => setTimeout(resolve, 15));
  });
  await vi.waitFor(() => expect(host.textContent).toContain("WORKSPACE_PRIVATE"));
  await render(
    createElement(NotificationDeliveryHistorySection, {
      workspaceId: WS,
      userId: "user",
      canWorkspace: false,
    }),
  );
  expect(host.textContent).not.toContain("WORKSPACE_PRIVATE");
  expect(host.querySelector("button")).toBeNull();
});
