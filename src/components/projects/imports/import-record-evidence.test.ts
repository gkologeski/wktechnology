// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { JourneyRecordDetail } from "@/lib/projects/imports/import-journey";
import { importPermissionFingerprint } from "./import-access";
const m = vi.hoisted(() => ({ load: vi.fn(), allowed: true }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/projects/imports/import-journey.functions", () => ({
  listImportJourneyEvidence: m.load,
}));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    workspaceId: "workspace",
    permissions: new Set(m.allowed ? ["techprojects.clockify_import.view.workspace"] : []),
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: "actor" }, loading: false }) }));
vi.mock("@/lib/view-as-client", () => ({ readViewAs: () => null }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
import { useImportRecordEvidence } from "./use-import-record-evidence";
const keys = new Set(["techprojects.clockify_import.view.workspace"]);
let record: JourneyRecordDetail, host: HTMLDivElement, root: Root, client: QueryClient;
function Harness() {
  const state = useImportRecordEvidence(record, [
    "actor",
    "workspace",
    importPermissionFingerprint(keys),
  ]);
  return createElement(
    "div",
    null,
    createElement("p", { id: "versions" }, state.versions.map((v) => v.id).join(",")),
    createElement("p", { id: "history" }, state.history.map((h) => h.note).join(",")),
    createElement("button", { onClick: () => state.loadMore("versions") }, "Versões"),
    createElement("button", { onClick: () => state.loadMore("history") }, "Decisões"),
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  m.allowed = true;
  record = {
    id: "record",
    provider: "clockify",
    entity: "time_entry",
    label: "Origem",
    externalId: "source",
    sourceName: "Org",
    status: "pending",
    issues: [],
    receivedAt: "2026-11-26T10:00:00Z",
    versionCount: 51,
    original: {},
    history: [],
    versions: [{ id: "current", at: "2026-11-26T10:00:00Z", hash: "current-hash" }],
    currentVersionId: "current",
    versionsCursor: "cursor",
    historyCursor: "event-cursor",
    canManage: false,
  };
  m.load.mockResolvedValue({
    versions: [{ id: "older", at: "2026-11-20T10:00:00Z", hash: "old-hash" }],
    history: [{ at: "2026-11-20T09:00:00Z", actor: "Conferente", note: "Decisão preservada" }],
    nextCursor: null,
  });
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
    root.render(createElement(QueryClientProvider, { client }, createElement(Harness))),
  );
  await flush();
}
async function click(text: string) {
  const button = [...host.querySelectorAll("button")].find((b) => b.textContent === text)!;
  await act(async () => button.click());
  await flush();
}

it("loads the next evidence page explicitly without replacing the current version", async () => {
  await render();
  expect(m.load).not.toHaveBeenCalled();
  await click("Versões");
  expect(m.load).toHaveBeenCalledWith({
    data: { id: "record", kind: "versions", cursor: "cursor" },
  });
  expect(host.querySelector("#versions")?.textContent).toBe("current,older");
});
it("loads history separately and preserves decisions on a retry failure", async () => {
  await render();
  await click("Decisões");
  expect(host.querySelector("#history")?.textContent).toBe("Decisão preservada");
  m.load.mockRejectedValue(new Error("Falha transitória"));
  await click("Versões");
  expect(host.querySelector("#history")?.textContent).toBe("Decisão preservada");
});
it("does not fetch older evidence after the effective permission is denied", async () => {
  m.allowed = false;
  await render();
  await click("Versões");
  expect(m.load).not.toHaveBeenCalled();
});
it("ignores a response from an earlier source generation", async () => {
  let resolve!: (result: unknown) => void;
  m.load.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  await render();
  await click("Versões");
  record = {
    ...record,
    currentVersionId: "new-current",
    versions: [{ id: "new-current", at: "2026-11-26T11:00:00Z", hash: "new-hash" }],
    versionsCursor: "new-cursor",
  };
  await render();
  await act(async () =>
    resolve({
      versions: [{ id: "stale", at: "2026-11-20T10:00:00Z", hash: "stale" }],
      history: [],
      nextCursor: null,
    }),
  );
  await flush();
  expect(host.querySelector("#versions")?.textContent).toBe("new-current");
});
