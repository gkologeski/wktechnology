// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ search: vi.fn(), empty: vi.fn(), actor: "u", workspace: "w" }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (f: unknown) => f }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: m.actor } }) }));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({ workspaceId: m.workspace, isLoading: false, isError: false }),
}));
vi.mock("@/lib/search/global-search.functions", () => ({ globalSearch: m.search }));
vi.mock("@/lib/search/recent-pinned.functions", () => ({
  listRecent: m.empty,
  listPinned: m.empty,
  recordRecent: m.empty,
  togglePin: m.empty,
}));
vi.mock("@/lib/copilot.functions", () => ({ askCopilot: vi.fn() }));
import { GlobalSearch } from "./global-search";
let root: Root, host: HTMLDivElement, query: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  m.actor = "u";
  m.workspace = "w";
  m.empty.mockResolvedValue([]);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  query = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(async () => {
  await act(async () => root.unmount());
  query.clear();
  host.remove();
  vi.unstubAllGlobals();
});
async function open() {
  await act(async () =>
    root.render(createElement(QueryClientProvider, { client: query }, createElement(GlobalSearch))),
  );
  await act(async () => {
    window.dispatchEvent(new Event("global-search:open"));
  });
}
async function type(text: string) {
  const input = document.querySelector("[cmdk-input]") as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 300));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
}
it("shows email-only and body-only server matches despite cmdk title filtering", async () => {
  m.search.mockImplementation(async ({ data }: { data: { types: string[] } }) => ({
    groups:
      data.types[0] === "contact"
        ? [
            {
              type: "contact",
              label: "Contatos",
              items: [
                {
                  entity_type: "contact",
                  entity_id: "c",
                  title: "Ana Silva",
                  subtitle: "financeiro@exemplo.com",
                  url: "/contacts/c",
                },
              ],
            },
          ]
        : data.types[0] === "activity"
          ? [
              {
                type: "activity",
                label: "Atividades",
                items: [
                  {
                    entity_type: "activity",
                    entity_id: "a",
                    title: "Reunião comercial",
                    subtitle: "Discussão financeiro",
                    url: "/activities/a",
                  },
                ],
              },
            ]
          : [],
    partial: false,
  }));
  await open();
  await type("financeiro");
  const items = [...document.querySelectorAll("[cmdk-item]")];
  expect(
    items.some((x) => x.textContent?.includes("Ana Silva") && !(x as HTMLElement).hidden),
  ).toBe(true);
  expect(
    items.some((x) => x.textContent?.includes("Reunião comercial") && !(x as HTMLElement).hidden),
  ).toBe(true);
  expect(
    query
      .getQueryCache()
      .getAll()
      .filter((x) => x.queryKey[0] === "global-search")
      .every((x) => x.queryKey[1] === "u" && x.queryKey[2] === "w"),
  ).toBe(true);
});
it("waits for three characters and cancels obsolete search transports", async () => {
  const signals: AbortSignal[] = [];
  m.search.mockImplementation(({ signal }: { signal: AbortSignal }) => {
    signals.push(signal);
    return new Promise(() => {});
  });
  await open();
  await type("ab");
  expect(m.search).not.toHaveBeenCalled();
  await type("abc");
  expect(signals.length).toBe(7);
  const old = [...signals];
  await type("abcd");
  expect(old.every((s) => s.aborted)).toBe(true);
});
