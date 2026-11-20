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
    "getNotificationSlackSettings",
    "saveNotificationSlackSettings",
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
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
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
    getNotificationSlackSettings: {
      policy: {
        enabled: false,
        daily_limit: 0,
        integration_id: null,
        template_version: "neutral-v1",
      },
      revision: 0,
      integrations: [],
      canManage: false,
    },
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
    "getNotificationSlackSettings",
    "saveNotificationSlackSettings",
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
  });
  await act(async () => {
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
  expect(state.calls.getNotificationSlackSettings).not.toHaveBeenCalled();
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

it("does not query Slack metadata without its explicit integration-view capability", async () => {
  await render(
    createElement(NotificationDeliveryConfiguration, {
      workspaceId: WS,
      userId: "user",
      capabilities: caps,
    }),
  );
  expect(state.calls.getNotificationSlackSettings).not.toHaveBeenCalled();
  expect(host.textContent).toContain("exige permissão sobre a integração");
});

it("scopes Slack settings cache to both the user and the confirmed workspace", async () => {
  const capabilities = { ...caps, slackView: true };
  await render(
    createElement(NotificationDeliveryConfiguration, {
      workspaceId: WS,
      userId: "first-user",
      capabilities,
    }),
  );
  expect(state.calls.getNotificationSlackSettings).toHaveBeenCalledWith({
    data: { workspaceId: WS },
  });
  expect(client.getQueryData(["notification-slack-settings", "first-user", WS])).toBeTruthy();
  await render(
    createElement(NotificationDeliveryConfiguration, {
      workspaceId: WS,
      userId: "second-user",
      capabilities,
    }),
  );
  expect(state.calls.getNotificationSlackSettings).toHaveBeenCalledTimes(2);
  expect(client.getQueryData(["notification-slack-settings", "second-user", WS])).toBeTruthy();
  expect(client.getQueryData(["notification-slack-settings"])).toBeUndefined();
});

it("shows Slack query failure as a failure without offering a disconnected-channel setup", async () => {
  state.calls.getNotificationSlackSettings.mockRejectedValue(new Error("Consulta indisponível"));
  await render(
    createElement(NotificationDeliveryConfiguration, {
      workspaceId: WS,
      userId: "user",
      capabilities: { ...caps, slackView: true },
    }),
  );
  await vi.waitFor(() =>
    expect(host.textContent).toContain("Não foi possível carregar a política do Slack"),
  );
  expect(host.querySelector('[aria-label="Conexão do Slack"]')).toBeNull();
  expect(host.textContent).not.toContain("Nenhuma conexão autorizada");
});

it("removes cached Slack metadata immediately when integration view is revoked", async () => {
  state.calls.getNotificationSlackSettings.mockResolvedValue({
    policy: {
      enabled: false,
      daily_limit: 0,
      integration_id: null,
      template_version: "neutral-v1",
    },
    revision: 0,
    integrations: [
      {
        id: WS,
        team_name: "PRIVATE_SLACK_TEAM",
        default_channel_name: "avisos",
        endpoint_revision: 1,
      },
    ],
    canManage: true,
  });
  await render(
    createElement(NotificationDeliveryConfiguration, {
      workspaceId: WS,
      userId: "user",
      capabilities: { ...caps, slackView: true },
    }),
  );
  expect(host.textContent).toContain("PRIVATE_SLACK_TEAM");
  await render(
    createElement(NotificationDeliveryConfiguration, {
      workspaceId: WS,
      userId: "user",
      capabilities: { ...caps, slackView: false },
    }),
  );
  expect(host.textContent).not.toContain("PRIVATE_SLACK_TEAM");
  expect(host.querySelector('[aria-label="Conexão do Slack"]')).toBeNull();
});

it("does not put a pending Slack save into the next user's cache after an identity change", async () => {
  const initial = {
    policy: {
      enabled: false,
      daily_limit: 0,
      integration_id: null,
      template_version: "neutral-v1",
    },
    revision: 0,
    integrations: [
      { id: WS, team_name: "WK", default_channel_name: "avisos", endpoint_revision: 1 },
    ],
    canManage: true,
  };
  state.calls.getNotificationSlackSettings.mockResolvedValue(initial);
  let resolveSave!: (value: unknown) => void;
  state.calls.saveNotificationSlackSettings.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
  );
  const capabilities = { ...caps, settingsManage: true, slackView: true, slackConfigure: true };
  await render(
    createElement(NotificationDeliveryConfiguration, {
      workspaceId: WS,
      userId: "first-user",
      capabilities,
    }),
  );
  await act(async () => {
    host.querySelector<HTMLElement>("#notification-policy-slack")!.click();
  });
  await act(async () => {
    const limit = host.querySelector<HTMLInputElement>("#notification-slack-limit")!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(limit, "15");
    limit.dispatchEvent(new Event("input", { bubbles: true }));
    const connection = host.querySelector<HTMLSelectElement>('[aria-label="Conexão do Slack"]')!;
    connection.value = WS;
    connection.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () => {
    host
      .querySelector<HTMLElement>('[aria-label="Confirmar público compartilhado do Slack"]')!
      .click();
  });
  await act(async () => {
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(state.calls.saveNotificationSlackSettings).toHaveBeenCalledTimes(1);
  await render(
    createElement(NotificationDeliveryConfiguration, {
      workspaceId: WS,
      userId: "second-user",
      capabilities,
    }),
  );
  await act(async () =>
    resolveSave({
      ...initial,
      policy: {
        enabled: true,
        daily_limit: 15,
        integration_id: WS,
        template_version: "neutral-v1",
      },
      revision: 1,
    }),
  );
  expect(
    client.getQueryData<{ revision: number }>(["notification-slack-settings", "first-user", WS])
      ?.revision,
  ).toBe(1);
  expect(
    client.getQueryData<{ revision: number }>(["notification-slack-settings", "second-user", WS])
      ?.revision,
  ).toBe(0);
  expect(host.querySelector("#notification-policy-slack")?.getAttribute("aria-checked")).toBe(
    "false",
  );
});
