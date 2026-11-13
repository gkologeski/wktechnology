// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  view: true,
  write: true,
  list: vi.fn(),
  get: vi.fn(),
  send: vi.fn(),
  edit: vi.fn(),
}));
const cid = "10000000-0000-4000-8000-000000000001";
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useNavigate: () => vi.fn(),
    useSearch: () => ({ conversation: "10000000-0000-4000-8000-000000000001" }),
  }),
  Link: ({ children, to, ...props }: any) => createElement("a", { ...props, href: to }, children),
  useRouterState: () => "/inbox/linkedin",
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: "owner" } }) }));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    workspaceId: "workspace",
    isLoading: false,
    isError: false,
    can: (key: string) => state.view && (state.write || key.includes(".view.")),
  }),
}));
vi.mock("@/lib/view-as-client", () => ({ readViewAs: () => null }));
vi.mock("@/lib/unipile/inbox.functions", () => ({
  listLinkedinConversations: state.list,
  getLinkedinConversation: state.get,
  sendLinkedinInboxMessage: state.send,
  editLinkedinConversation: state.edit,
}));
vi.mock("@/lib/inbox/message-history.functions", () => ({ listConversationMessages: vi.fn() }));
vi.mock("@/hooks/use-message-history", () => ({
  useMessageHistory: () => ({
    key: "conversation",
    items: [],
    initial: "loaded",
    hasOlder: false,
    health: "live",
    reconcile: vi.fn(),
  }),
}));
vi.mock("@/components/inbox/service-agent-panel", () => ({ ServiceAgentPanel: () => null }));
vi.mock("@/components/ui/entity-combobox", () => ({ EntityCombobox: () => null }));
import { Route } from "@/routes/_authenticated/inbox.linkedin";
let host: HTMLDivElement, root: Root, client: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  state.view = true;
  state.write = true;
  state.list.mockResolvedValue({
    items: [{ id: cid, title: "Pessoa de teste", snippet: "Mensagem", status: "open" }],
    hasMore: false,
  });
  state.get.mockResolvedValue({ id: cid, title: "Pessoa de teste", status: "open" });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});
async function render() {
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement((Route.options as any).component),
      ),
    );
    await new Promise((r) => setTimeout(r, 20));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
}
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  host.remove();
});
it("keeps the shared Inbox composer present below the message viewport", async () => {
  await render();
  expect(host.textContent).toContain("Inbox LinkedIn");
  expect(host.textContent).toContain("Pessoa de teste");
  const composer = host.querySelector("form");
  expect(composer).not.toBeNull();
  expect(composer?.querySelector("textarea")).not.toBeNull();
  expect(composer?.className).toContain("shrink-0");
  expect(state.get).toHaveBeenCalledWith({ data: { id: cid } });
});
it("does not query personal conversations when Inbox access is denied", async () => {
  state.view = false;
  await render();
  expect(host.textContent).toContain("Sem permissão");
  expect(state.list).not.toHaveBeenCalled();
  expect(state.get).not.toHaveBeenCalled();
  expect(host.querySelector("textarea")).toBeNull();
});
it("keeps history visible but disables composing without management access", async () => {
  state.write = false;
  await render();
  expect(host.textContent).toContain("Pessoa de teste");
  expect(host.querySelector("textarea")?.disabled).toBe(true);
  expect(state.send).not.toHaveBeenCalled();
});
