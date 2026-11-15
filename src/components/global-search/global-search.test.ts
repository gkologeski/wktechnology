// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  search: vi.fn(),
  empty: vi.fn(),
  actor: "u",
  workspace: "w",
  permissions: new Set<string>(),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (f: unknown) => f }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: m.actor } }) }));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    workspaceId: m.workspace,
    isLoading: false,
    isError: false,
    permissions: m.permissions,
  }),
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
  m.permissions = new Set(["techsales.contacts.view.own"]);
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
  expect(signals.length).toBe(8);
  const old = [...signals];
  await type("abcd");
  expect(old.every((s) => s.aborted)).toBe(true);
});

const hit = (id: string, title: string, subtitle?: string) => ({
  entity_type: "activity",
  entity_id: id,
  title,
  subtitle,
  url: `/activities?highlight=${id}`,
});
const found = (items: ReturnType<typeof hit>[]) => ({
  groups: [{ type: "activity", label: "Atividades", items }],
  partial: false,
});
it("shows subject hits before content finishes and merges duplicate hits", async () => {
  let finish!: (x: unknown) => void;
  m.search.mockImplementation(({ data }: { data: { types: string[]; activityPart?: string } }) =>
    data.types[0] !== "activity"
      ? Promise.resolve({ groups: [] })
      : data.activityPart === "subject"
        ? Promise.resolve(found([hit("a", "Reunião Helix")]))
        : new Promise((r) => {
            finish = r;
          }),
  );
  await open();
  await type("Helix");
  expect(document.body.textContent).toContain("Reunião Helix");
  expect(document.body.textContent).toContain("Buscando no conteúdo");
  await act(async () =>
    finish(
      found([
        hit("a", "Reunião Helix", "Resumo Helix"),
        hit("b", "Outro assunto", "Conteúdo Helix"),
      ]),
    ),
  );
  expect(document.querySelectorAll('[cmdk-item] [class="truncate"]').length).toBeGreaterThan(0);
  expect(
    [...document.querySelectorAll("[cmdk-item]")].filter((x) =>
      x.textContent?.includes("Reunião Helix"),
    ),
  ).toHaveLength(1);
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
  expect(document.body.textContent).toContain("Outro assunto");
});
it("cancels transports immediately on edit and close, without showing stale matches", async () => {
  const signals: AbortSignal[] = [];
  m.search.mockImplementation(({ signal }: { signal: AbortSignal }) => {
    signals.push(signal);
    return new Promise(() => {});
  });
  await open();
  await type("Helix");
  const old = [...signals];
  const input = document.querySelector("[cmdk-input]") as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Outro");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(old.every((s) => s.aborted)).toBe(true);
  await type("Outro");
  await act(async () => {
    (document.querySelector('[aria-label="Close"]') as HTMLElement | null)?.click();
    const buttons = [...document.querySelectorAll("button")];
    buttons.find((x) => x.textContent === "Fechar")?.click();
  });
  expect(signals.every((s) => s.aborted)).toBe(true);
});
it("retries only partial content and never reports false empty results", async () => {
  let attempts = 0;
  m.search.mockImplementation(async ({ data }: { data: { activityPart?: string } }) =>
    data.activityPart === "content"
      ? ++attempts === 1
        ? { groups: [], partial: true }
        : found([hit("a", "Recuperado")])
      : { groups: [], partial: false },
  );
  await open();
  await type("Helix");
  expect(document.body.textContent).toContain("Resultados parciais");
  expect(document.body.textContent).not.toContain("Nenhum resultado para");
  const before = m.search.mock.calls.length;
  await act(async () => {
    [...document.querySelectorAll("button")]
      .find((b) => b.textContent === "Tentar grupos pendentes")!
      .click();
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
  expect(m.search.mock.calls.length - before).toBe(1);
  expect(document.body.textContent).toContain("Recuperado");
});
it("does not reuse visible records after identity, workspace or permission changes", async () => {
  m.search.mockImplementation(async () =>
    m.permissions.size
      ? found([hit("a", `${m.actor}-${m.workspace}-registro`)])
      : { groups: [], partial: false },
  );
  await open();
  await type("Helix");
  expect(document.body.textContent).toContain("u-w-registro");
  m.workspace = "other";
  await act(async () =>
    root.render(createElement(QueryClientProvider, { client: query }, createElement(GlobalSearch))),
  );
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
  expect(document.body.textContent).not.toContain("u-w-registro");
  expect(document.body.textContent).toContain("u-other-registro");
  m.actor = "v";
  await act(async () =>
    root.render(createElement(QueryClientProvider, { client: query }, createElement(GlobalSearch))),
  );
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
  expect(document.body.textContent).not.toContain("u-other-registro");
  expect(document.body.textContent).toContain("v-other-registro");
  m.permissions = new Set();
  await act(async () =>
    root.render(createElement(QueryClientProvider, { client: query }, createElement(GlobalSearch))),
  );
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
  expect(document.body.textContent).not.toContain("v-other-registro");
});
