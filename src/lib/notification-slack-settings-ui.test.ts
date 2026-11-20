// @vitest-environment jsdom
import { act, createElement, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const WS = "aaaaaaaa-1111-4111-8111-111111111111";
const state = vi.hoisted(() => ({
  userId: "user-a",
  workspaceId: "aaaaaaaa-1111-4111-8111-111111111111" as string | null,
  loading: false,
  authLoading: false,
  error: false,
  view: true,
  create: false,
  manage: false,
  remove: false,
  viewAs: null as { mode: "user" | "role"; readOnly: boolean } | null,
  calls: {} as Record<string, ReturnType<typeof vi.fn<(input?: unknown) => Promise<unknown>>>>,
  success: vi.fn(),
  failure: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { id: state.userId }, loading: state.authLoading }),
}));
vi.mock("@/lib/view-as-client", () => ({ readViewAs: () => state.viewAs }));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    workspaceId: state.workspaceId,
    isLoading: state.loading,
    isError: state.error,
    canAny: (keys: string[]) =>
      keys.some((key) =>
        key.includes(".view.")
          ? state.view
          : key.includes(".create.") || key.includes(".update.")
            ? state.create
            : false,
      ),
  }),
}));
vi.mock("@/lib/access-control/use-sales-capabilities", () => ({
  useSalesCapabilities: () => ({
    for: () => ({ can_manage: state.manage, can_delete: state.remove }),
  }),
}));
vi.mock("@/components/page-header", () => ({
  PageHeader: ({ title, description }: { title: string; description: string }) =>
    createElement("div", null, title, description),
}));
vi.mock("@/components/ui/confirm-dialog", () => ({
  confirmDialog: vi.fn().mockResolvedValue(true),
}));
vi.mock("sonner", () => ({ toast: { success: state.success, error: state.failure } }));
vi.mock("@/lib/slack.functions", () =>
  Object.fromEntries(
    ["getSlackIntegration", "saveSlackIntegration", "deleteSlackIntegration", "sendSlackTest"].map(
      (name) => [name, (input: unknown) => state.calls[name](input)],
    ),
  ),
);
import { Route } from "@/routes/_authenticated/settings.notifications.slack";
const Page = Route.options.component as unknown as ComponentType;
let host: HTMLDivElement, root: Root, client: QueryClient;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.userId = "user-a";
  state.workspaceId = WS;
  state.loading = false;
  state.authLoading = false;
  state.error = false;
  state.view = true;
  state.create = false;
  state.manage = false;
  state.remove = false;
  state.viewAs = null;
  for (const name of [
    "getSlackIntegration",
    "saveSlackIntegration",
    "deleteSlackIntegration",
    "sendSlackTest",
  ])
    state.calls[name] = vi
      .fn<(input?: unknown) => Promise<unknown>>()
      .mockResolvedValue(
        name === "getSlackIntegration"
          ? { integration: null, routes: [] }
          : { ok: true, configurationOnly: true },
      );
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
async function render() {
  await act(async () => {
    root.render(createElement(QueryClientProvider, { client }, createElement(Page)));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 15));
  });
}
function button(text: string) {
  return [...host.querySelectorAll("button")].find((node) => node.textContent === text);
}
const connected = () =>
  state.calls.getSlackIntegration.mockResolvedValue({
    integration: { id: WS, team_name: "WK", default_channel_name: "avisos" },
    routes: [{ id: "route-old", event_type: "deal.won", channel_id: "old-channel", enabled: true }],
  });

it("does not load or expose integration data before identity, workspace and permission are confirmed", async () => {
  state.authLoading = true;
  await render();
  expect(state.calls.getSlackIntegration).not.toHaveBeenCalled();
  state.authLoading = false;
  state.workspaceId = null;
  await render();
  expect(state.calls.getSlackIntegration).not.toHaveBeenCalled();
  state.workspaceId = WS;
  state.view = false;
  await render();
  expect(state.calls.getSlackIntegration).not.toHaveBeenCalled();
  expect(host.textContent).toContain("Sem permissão");
});
it("uses separate query caches when the user or workspace changes", async () => {
  await render();
  expect(client.getQueryData(["slack-integration", "user-a", WS])).toBeTruthy();
  state.userId = "user-b";
  await render();
  expect(client.getQueryData(["slack-integration", "user-b", WS])).toBeTruthy();
  state.workspaceId = "bbbbbbbb-1111-4111-8111-111111111111";
  await render();
  expect(state.calls.getSlackIntegration).toHaveBeenCalledTimes(3);
  expect(client.getQueryData(["slack-integration"])).toBeUndefined();
});

it("revalidates cached connection metadata before showing it on a new visit", async () => {
  client.setQueryData(["slack-integration", "user-a", WS], {
    integration: { id: WS, team_name: "OLD_CACHED_TEAM", default_channel_name: "avisos" },
    routes: [],
  });
  let finish!: (value: unknown) => void;
  state.calls.getSlackIntegration.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  state.create = true;
  await render();
  expect(host.textContent).toContain("Carregando configuração Slack");
  expect(host.textContent).not.toContain("OLD_CACHED_TEAM");
  expect(host.querySelector("#hook")).toBeNull();
  await act(async () => {
    finish({ integration: null, routes: [] });
    // QueryClient batches observer notifications after the fulfilled query promise.
    await new Promise((resolve) => setTimeout(resolve, 15));
  });
  expect(host.querySelector("#hook")).toBeTruthy();
});
it("shows a failed read instead of a disconnected setup form and does not echo raw errors", async () => {
  state.calls.getSlackIntegration.mockRejectedValue(new Error("PRIVATE_PROVIDER_REPLY"));
  await render();
  await vi.waitFor(() =>
    expect(host.textContent).toContain("Não foi possível carregar a integração Slack"),
  );
  expect(host.querySelector("#hook")).toBeNull();
  expect(host.textContent).not.toContain("PRIVATE_PROVIDER_REPLY");
});
it("protects a newly typed webhook and clears it when the active workspace changes", async () => {
  state.create = true;
  await render();
  expect(host.querySelector<HTMLInputElement>("#hook")?.type).toBe("password");
  expect(host.querySelector<HTMLInputElement>("#hook")?.autocomplete).toBe("new-password");
  const input = host.querySelector<HTMLInputElement>("#hook")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
      input,
      "test-only-value",
    );
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(input.value).toBe("test-only-value");
  state.workspaceId = "bbbbbbbb-1111-4111-8111-111111111111";
  await render();
  expect(host.querySelector<HTMLInputElement>("#hook")?.value).toBe("");
  expect(state.calls.saveSlackIntegration).not.toHaveBeenCalled();
});
it("preserves old routes as read-only information and does not promise webhook channel overrides", async () => {
  connected();
  await render();
  expect(host.textContent).toContain("old-channel");
  expect(host.textContent).toContain("somente leitura");
  expect(host.textContent).toContain("não permite sobrescrevê-lo por evento");
  expect(host.querySelector('[role="switch"]')).toBeNull();
  expect(button("Adicionar")).toBeUndefined();
  expect(state.calls.sendSlackTest).not.toHaveBeenCalled();
});
it("disables integration actions when record capabilities are absent", async () => {
  connected();
  await render();
  expect(button("Conferir configuração")?.disabled).toBe(true);
  expect(button("Desconectar")?.disabled).toBe(true);
  expect(state.calls.sendSlackTest).not.toHaveBeenCalled();
});
it("performs only an explicit configuration check without claiming a delivery or read receipt", async () => {
  connected();
  state.manage = true;
  await render();
  expect(state.calls.sendSlackTest).not.toHaveBeenCalled();
  await act(async () => button("Conferir configuração")!.click());
  expect(state.calls.sendSlackTest).toHaveBeenCalledTimes(1);
  expect(state.success).toHaveBeenCalledWith("Configuração conferida; nenhum aviso enviado.");
  expect(host.textContent).not.toContain("Enviar teste");
});

it("blocks configuration actions in a role preview even when record capabilities are present", async () => {
  connected();
  state.manage = true;
  state.remove = true;
  state.viewAs = { mode: "role", readOnly: false };
  await render();
  expect(button("Conferir configuração")?.disabled).toBe(true);
  expect(button("Desconectar")?.disabled).toBe(true);
  expect(state.calls.sendSlackTest).not.toHaveBeenCalled();
});

it("blocks a read-only user preview while preserving authorized real-user checks", async () => {
  connected();
  state.manage = true;
  state.viewAs = { mode: "user", readOnly: true };
  await render();
  expect(button("Conferir configuração")?.disabled).toBe(true);
  state.viewAs = { mode: "user", readOnly: false };
  await render();
  expect(button("Conferir configuração")?.disabled).toBe(false);
  await act(async () => button("Conferir configuração")!.click());
  expect(state.calls.sendSlackTest).toHaveBeenCalledTimes(1);
  expect(state.success).toHaveBeenCalledWith("Configuração conferida; nenhum aviso enviado.");
});
