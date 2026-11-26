// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  clockify: vi.fn(),
  jibble: vi.fn(),
  noop: vi.fn(),
  actor: "actor-a",
  workspace: "workspace-a",
  allowed: true,
  readOnly: false,
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => createElement("span", null, children),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: m.actor }, loading: false }) }));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    workspaceId: m.workspace,
    permissions: new Set(
      m.allowed
        ? ["clockify", "jibble"].flatMap((p) => [
            `techprojects.${p}_import.view.workspace`,
            `techprojects.${p}_import.manage.workspace`,
          ])
        : [],
    ),
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("@/lib/view-as-client", () => ({ readViewAs: () => ({ readOnly: m.readOnly }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock("./clockify-review", () => ({ MappingsTable: () => null, StagingTable: () => null }));
vi.mock("@/lib/integrations/clockify/clockify.functions", () => ({
  getClockifyImportStatus: m.clockify,
  advanceClockifyImportRun: m.noop,
  clockifyImportTargetOptions: m.noop,
  confirmClockifyImportPreview: m.noop,
  createClockifyImportIdentity: m.noop,
  createClockifyImportIdentitiesBulk: m.noop,
  reopenClockifyImportEntries: m.noop,
  getClockifyImportRun: m.noop,
  listClockifyImportMappings: m.noop,
  listClockifyImportStaging: m.noop,
  removeClockifyImportConnection: m.noop,
  saveClockifyImportConnection: m.noop,
  selectClockifyImportSource: m.noop,
  setClockifyImportMapping: m.noop,
  setClockifyImportRunState: m.noop,
  startClockifyImportRun: m.noop,
  testClockifyImportConnection: m.noop,
}));
vi.mock("@/lib/integrations/jibble/jibble.functions", () => ({
  getJibbleImportStatus: m.jibble,
  advanceJibbleImportRun: m.noop,
  confirmJibbleImportPreview: m.noop,
  confirmJibbleImportSource: m.noop,
  decideJibbleImportDuplicate: m.noop,
  jibbleImportTargetOptions: m.noop,
  listJibbleImportDuplicates: m.noop,
  listJibbleImportMappings: m.noop,
  listJibbleImportStaging: m.noop,
  removeJibbleImportConnection: m.noop,
  saveJibbleImportConnection: m.noop,
  setJibbleImportMapping: m.noop,
  setJibbleImportRunState: m.noop,
  startJibbleImportRun: m.noop,
  testJibbleImportConnection: m.noop,
}));
import { ClockifyImportPage } from "./clockify-import-page";
import { JibbleImportPage } from "../jibble-import/jibble-import-page";

let host: HTMLDivElement, root: Root, client: QueryClient;
const initial = (name: string) => ({
  encryptionReady: true,
  runs: [],
  connection: {
    configured: true,
    status: "configured",
    source: null,
    org: null,
    region: "global",
    keyMasked: name,
    clientIdMasked: name,
    secretMasked: "***",
    lastError: null,
  },
});
beforeEach(() => {
  vi.clearAllMocks();
  m.actor = "actor-a";
  m.workspace = "workspace-a";
  m.allowed = true;
  m.readOnly = false;
  m.clockify.mockResolvedValue(initial("ORIGIN-A"));
  m.jibble.mockResolvedValue(initial("ORIGIN-A"));
  m.noop.mockResolvedValue({ rows: [] });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  host.remove();
});
async function render(Page: typeof ClockifyImportPage) {
  await act(async () =>
    root.render(createElement(QueryClientProvider, { client }, createElement(Page))),
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 25));
  });
}

for (const [name, Page, status, selector] of [
  ["Clockify", ClockifyImportPage, m.clockify, "#ck-key"],
  ["Jibble", JibbleImportPage, m.jibble, "#jb-client-secret"],
] as const) {
  for (const change of ["workspace", "actor"] as const) {
    it(`${name}: isola o cache e limpa credenciais ao trocar ${change}`, async () => {
      await render(Page);
      expect(host.textContent).toContain("ORIGIN-A");
      const field = host.querySelector<HTMLInputElement>(selector)!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
          field,
          "draft-secret",
        );
        field.dispatchEvent(new Event("input", { bubbles: true }));
      });
      status.mockResolvedValue(initial("ORIGIN-B"));
      m[change] = `${change}-b`;
      await render(Page);
      expect(host.textContent).toContain("ORIGIN-B");
      expect(host.textContent).not.toContain("ORIGIN-A");
      expect(host.querySelector<HTMLInputElement>(selector)?.value).toBe("");
      expect(status).toHaveBeenCalledTimes(2);
    });
  }
  it(`${name}: retira os dados e bloqueia consultas quando o acesso é revogado`, async () => {
    await render(Page);
    expect(host.textContent).toContain("ORIGIN-A");
    m.allowed = false;
    await render(Page);
    expect(host.textContent).not.toContain("ORIGIN-A");
    expect(host.textContent).toContain("Importação indisponível");
    expect(status).toHaveBeenCalledOnce();
  });
  it(`${name}: perfil de somente leitura não pode salvar credenciais`, async () => {
    m.readOnly = true;
    await render(Page);
    const save = [...host.querySelectorAll<HTMLButtonElement>("button")].find((b) =>
      b.textContent?.includes("Salvar"),
    );
    expect(save?.disabled).toBe(true);
    expect(m.noop).not.toHaveBeenCalled();
  });
}
