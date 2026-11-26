// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { JourneyStatus } from "@/lib/projects/imports/import-journey";

const m = vi.hoisted(() => ({
  get: vi.fn(),
  start: vi.fn(),
  advance: vi.fn(),
  list: vi.fn(),
  detail: vi.fn(),
  targets: vi.fn(),
  review: vi.fn(),
  allowed: true,
  readonly: false,
  workspace: "workspace-a" as string | null,
  actor: "actor-a",
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
    createElement("a", { href: to }, children),
}));
vi.mock("@/lib/projects/imports/import-journey.functions", () => ({
  getImportJourneyStatus: m.get,
  startImportJourney: m.start,
  advanceImportJourney: m.advance,
  listImportJourneyRecords: m.list,
  getImportJourneyRecord: m.detail,
  listImportJourneyTargets: m.targets,
  reviewImportJourneyRecord: m.review,
}));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    workspaceId: m.workspace,
    permissions: new Set(
      m.allowed
        ? [
            "techprojects.clockify_import.view.workspace",
            "techprojects.clockify_import.manage.workspace",
          ]
        : [],
    ),
    canAny: () => m.allowed,
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: m.actor } }) }));
vi.mock("@/lib/view-as-client", () => ({ readViewAs: () => ({ readOnly: m.readonly }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("./import-source-sheet", () => ({ ImportSourceSheet: () => null }));
import { ImportJourneyPage } from "./import-journey-page";

let host: HTMLDivElement, root: Root, client: QueryClient;
const initial = (name = "Organização autorizada A"): JourneyStatus => ({
  workspaceId: m.workspace ?? "",
  legacyPending: false,
  sources: [
    {
      provider: "clockify",
      label: "Clockify",
      canView: true,
      canManage: true,
      configured: true,
      ready: true,
      sourceId: "source-a",
      sourceName: name,
      connectionStatus: "connected",
      error: null,
      coverage: [
        { entity: "time_entry", label: "Lançamentos de horas", status: "available", count: null },
      ],
    },
  ],
  runs: [],
  summary: { received: 12, ready: 5, pending: 2, unclassified: 5 },
});
beforeEach(() => {
  vi.clearAllMocks();
  m.allowed = true;
  m.readonly = false;
  m.workspace = "workspace-a";
  m.actor = "actor-a";
  m.get.mockResolvedValue(initial());
  m.start.mockResolvedValue(initial());
  m.advance.mockResolvedValue(initial());
  m.list.mockResolvedValue({ records: [], total: 0, page: 0, pageSize: 50 });
  m.targets.mockResolvedValue({ options: [] });
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
    await new Promise((resolve) => setTimeout(resolve, 35));
  });
}
async function render() {
  await act(async () =>
    root.render(createElement(QueryClientProvider, { client }, createElement(ImportJourneyPage))),
  );
  await flush();
}
async function click(text: string) {
  const button = [...host.querySelectorAll("button")].find((b) =>
    b.textContent?.trim().startsWith(text),
  );
  expect(button, text).toBeTruthy();
  await act(async () => button!.click());
  await flush();
}

it("allowed import viewer loads the real scoped status without starting an import", async () => {
  await render();
  expect(m.get).toHaveBeenCalledTimes(1);
  expect(host.textContent).toContain("Organização autorizada A");
  expect(m.start).not.toHaveBeenCalled();
  expect(m.advance).not.toHaveBeenCalled();
});
it("viewer without import key never loads the import catalogue", async () => {
  m.allowed = false;
  await render();
  expect(m.get).not.toHaveBeenCalled();
  expect(host.textContent).toContain("Você não tem permissão");
});
it("effective deny prevents UI reads and import actions", async () => {
  m.allowed = false;
  await render();
  expect(m.get).not.toHaveBeenCalled();
  expect(m.start).not.toHaveBeenCalled();
  expect(host.querySelectorAll('[role="tab"]')).toHaveLength(0);
});
it("workspace switch does not reuse another workspace record state", async () => {
  await render();
  m.workspace = "workspace-b";
  let resolve!: (value: JourneyStatus) => void;
  m.get.mockImplementation(
    () =>
      new Promise<JourneyStatus>((r) => {
        resolve = r;
      }),
  );
  await act(async () =>
    root.render(createElement(QueryClientProvider, { client }, createElement(ImportJourneyPage))),
  );
  await flush();
  expect(host.textContent).not.toContain("Organização autorizada A");
  await act(async () => resolve(initial("Organização autorizada B")));
  await flush();
  expect(host.textContent).toContain("Organização autorizada B");
});
it("inactive context with no active workspace cannot fetch or mutate", async () => {
  m.workspace = null;
  await render();
  expect(m.get).not.toHaveBeenCalled();
  expect(m.start).not.toHaveBeenCalled();
  expect(m.advance).not.toHaveBeenCalled();
});
it("only an explicit import confirmation sends selected providers", async () => {
  await render();
  await click("Conferir cobertura");
  expect(m.start).not.toHaveBeenCalled();
  await click("Importar todos os registros");
  expect(m.start).toHaveBeenCalledWith({ data: { providers: ["clockify"] } });
});
it("readonly context cannot trigger import from the journey", async () => {
  m.readonly = true;
  await render();
  expect(host.textContent).toContain("O modo somente leitura");
  const next = [...host.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("Conferir cobertura"),
  );
  expect(next?.disabled).toBe(true);
  expect(m.start).not.toHaveBeenCalled();
  expect(m.advance).not.toHaveBeenCalled();
});
it("a failed status read is displayed as an error rather than an empty catalogue", async () => {
  m.get.mockRejectedValue(new Error("Consulta indisponível"));
  await render();
  expect(host.textContent).toContain("Não foi possível carregar a central");
  expect(host.textContent).not.toContain("Nenhum registro recebido ainda");
  expect(host.textContent).toContain("Tentar novamente");
});
it("partial import keeps received records accessible while incomplete", async () => {
  const data = initial();
  data.sources[0].latestRun = {
    id: "run-a",
    provider: "clockify",
    sourceName: "Organização autorizada A",
    status: "partial",
    phase: "Lendo projetos",
    received: 12,
    ready: 5,
    pending: 2,
    coverageComplete: false,
    error: "Falha transitória",
    createdAt: "2026-11-26T10:00:00Z",
    resumable: true,
  };
  m.get.mockResolvedValue(data);
  await render();
  expect(host.textContent).toContain("Coleta incompleta");
  await click("Ver registros recebidos");
  expect(m.list).toHaveBeenCalledWith({
    data: { provider: undefined, status: undefined, q: "", page: 0, issuesOnly: false },
  });
  expect(host.textContent).toContain("Todos os registros recebidos");
});
