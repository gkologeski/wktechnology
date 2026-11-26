// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { importPermissionFingerprint } from "./import-access";
const m = vi.hoisted(() => ({
  state: vi.fn(),
  key: vi.fn(),
  sources: vi.fn(),
  saveSources: vi.fn(),
  allowed: true,
  workspace: "workspace",
  connection: {
    configured: false,
    status: "not_configured",
    error: null as string | null,
    encryptionReady: true,
  },
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/integrations/clickup/clickup-import.functions", () => ({
  getClickUpImportConnectionState: m.state,
  saveClickUpImportConnection: m.key,
  getClickUpImportSources: m.sources,
  saveClickUpImportSources: m.saveSources,
}));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    workspaceId: m.workspace,
    permissions: new Set(
      m.allowed
        ? [
            "techprojects.clickup_import.view.workspace",
            "techprojects.clickup_import.manage.workspace",
          ]
        : [],
    ),
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: "actor" }, loading: false }) }));
vi.mock("@/lib/view-as-client", () => ({ readViewAs: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { ClickUpSource } from "./clickup-source-setup";
const keys = new Set([
  "techprojects.clickup_import.view.workspace",
  "techprojects.clickup_import.manage.workspace",
]);
let host: HTMLDivElement,
  root: Root,
  client: QueryClient,
  done: ReturnType<typeof vi.fn<() => Promise<void>>>;
beforeEach(() => {
  vi.clearAllMocks();
  m.allowed = true;
  m.workspace = "workspace";
  m.connection = {
    configured: false,
    status: "not_configured",
    error: null,
    encryptionReady: true,
  };
  m.state.mockImplementation(async () => m.connection);
  m.sources.mockResolvedValue({
    available: [
      { id: "team1", name: "Organização autorizada" },
      { id: "team2", name: "Outra organização da credencial" },
    ],
    selectedIds: ["team1"],
  });
  m.key.mockImplementation(async () => {
    m.connection = { ...m.connection, configured: true, status: "configured" };
    return { configured: true, status: "configured" };
  });
  m.saveSources.mockResolvedValue({ selectedIds: ["team1"] });
  done = vi.fn().mockResolvedValue(undefined);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  host.remove();
});
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 45));
  });
}
async function render() {
  await act(async () =>
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(ClickUpSource, {
          scope: ["actor", "workspace", importPermissionFingerprint(keys)],
          onConfigured: done,
        }),
      ),
    ),
  );
  await flush();
}
async function click(text: string) {
  const button = [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === text)!;
  expect(button, text).toBeTruthy();
  await act(async () => button.click());
  await flush();
}

it("new workspace asks for its scoped key before reading provider organizations", async () => {
  await render();
  expect(m.state).toHaveBeenCalledTimes(1);
  expect(m.sources).not.toHaveBeenCalled();
  const input = host.querySelector<HTMLInputElement>("#journey-clickup-key")!;
  expect(input.type).toBe("password");
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
      input,
      "TEST-KEY-FOR-WORKSPACE-ONLY-12345",
    );
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click("Salvar e testar chave");
  expect(m.key).toHaveBeenCalledWith({ data: { apiKey: "TEST-KEY-FOR-WORKSPACE-ONLY-12345" } });
  expect(input.value).toBe("");
  expect(host.textContent).toContain("Organizações autorizadas do ClickUp");
});
it("does not select every organization visible to the credential", async () => {
  m.connection.configured = true;
  await render();
  await flush();
  await click("Confirmar organizações");
  expect(m.saveSources).toHaveBeenCalledWith({ data: { sourceTeamIds: ["team1"] } });
  expect(done).toHaveBeenCalledTimes(1);
});
it("effective deny and foreign workspace never load connection or sources", async () => {
  m.allowed = false;
  await render();
  expect(m.state).not.toHaveBeenCalled();
  expect(m.sources).not.toHaveBeenCalled();
  m.allowed = true;
  m.workspace = "foreign";
  await render();
  expect(m.state).not.toHaveBeenCalled();
  expect(m.key).not.toHaveBeenCalled();
});
it("missing server encryption disables credential entry and save", async () => {
  m.connection.encryptionReady = false;
  await render();
  expect(host.querySelector<HTMLInputElement>("#journey-clickup-key")?.disabled).toBe(true);
  const button = [...host.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("Salvar e testar chave"),
  );
  expect(button?.disabled).toBe(true);
  expect(m.key).not.toHaveBeenCalled();
  expect(m.sources).not.toHaveBeenCalled();
});
