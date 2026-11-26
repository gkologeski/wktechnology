// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { JourneyRecordDetail } from "@/lib/projects/imports/import-journey";
import { importPermissionFingerprint } from "./import-access";

const m = vi.hoisted(() => ({
  targets: vi.fn(),
  save: vi.fn(),
  allowed: true,
  readonly: false,
  version: "current",
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/projects/imports/import-journey.functions", () => ({
  listImportJourneyTargets: m.targets,
  reviewImportJourneyRecord: m.save,
}));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    workspaceId: "workspace",
    permissions: new Set(
      m.allowed
        ? [
            "techprojects.clockify_import.view.workspace",
            "techprojects.clockify_import.manage.workspace",
          ]
        : [],
    ),
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: "actor" }, loading: false }) }));
vi.mock("@/lib/view-as-client", () => ({ readViewAs: () => ({ readOnly: m.readonly }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import {
  useImportRecordReview,
  ImportRecordReviewFields,
  ImportRecordReviewActions,
} from "./import-record-review";

const keys = new Set([
  "techprojects.clockify_import.view.workspace",
  "techprojects.clockify_import.manage.workspace",
]);
let record: JourneyRecordDetail, host: HTMLDivElement, root: Root, client: QueryClient;
function Harness() {
  const review = useImportRecordReview(
    record,
    ["actor", "workspace", importPermissionFingerprint(keys)],
    m.readonly,
    m.version,
  );
  return createElement(
    "div",
    null,
    createElement(ImportRecordReviewFields, { review }),
    createElement(ImportRecordReviewActions, { review }),
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  m.allowed = true;
  m.readonly = false;
  m.version = "current";
  record = {
    id: "record",
    provider: "clockify",
    entity: "time_entry",
    label: "Intervalo sem saída",
    externalId: "source-id",
    sourceName: "Origem autorizada",
    status: "pending",
    issues: ["open_interval"],
    receivedAt: "2026-11-26T10:00:00Z",
    versionCount: 1,
    currentVersionId: "version-1",
    versionsCursor: null,
    historyCursor: null,
    original: { end: null },
    history: [],
    versions: [{ id: "version-1", at: "2026-11-26T10:00:00Z", hash: "hash" }],
    canManage: true,
  };
  m.targets.mockImplementation(async ({ data }) => ({
    options:
      data.purpose === "review"
        ? [{ id: "reviewer", label: "Pessoa aprovadora autorizada" }]
        : [{ id: "project", label: "Projeto autorizado" }],
  }));
  m.save.mockResolvedValue(record);
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
    await new Promise((resolve) => setTimeout(resolve, 40));
  });
}
async function render() {
  await act(async () =>
    root.render(createElement(QueryClientProvider, { client }, createElement(Harness))),
  );
  await flush();
}
async function note(text: string) {
  const field = host.querySelector("textarea")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, text);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function click(text: string) {
  const button = [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === text)!;
  expect(button).toBeTruthy();
  await act(async () => button.click());
  await flush();
}

it("annotation preserves the source version and requires a meaningful note", async () => {
  await render();
  const button = [...host.querySelectorAll("button")].find(
    (b) => b.textContent === "Registrar anotação",
  )!;
  expect(button.disabled).toBe(true);
  await note("Conferir a saída com o lançamento original.");
  expect(button.disabled).toBe(false);
  await click("Registrar anotação");
  expect(m.save).toHaveBeenCalledWith({
    data: {
      id: "record",
      versionId: "version-1",
      action: "review",
      note: "Conferir a saída com o lançamento original.",
      targetId: undefined,
      assigneeId: undefined,
    },
  });
});
it("assignment uses an explicitly selected active authorized reviewer", async () => {
  await render();
  await act(async () => host.querySelector<HTMLInputElement>("#import-review-assignee")!.focus());
  await flush();
  expect(m.targets).toHaveBeenCalledWith({ data: { id: "record", q: "", purpose: "review" } });
  await click("Pessoa aprovadora autorizada");
  await note("Conferir a saída ausente com a origem.");
  await click("Encaminhar conferência");
  expect(m.save).toHaveBeenCalledWith({
    data: {
      id: "record",
      versionId: "version-1",
      action: "review",
      note: "Conferir a saída ausente com a origem.",
      targetId: undefined,
      assigneeId: "reviewer",
    },
  });
});
it("source-version conflict keeps the user's note for a new review", async () => {
  m.save.mockRejectedValue(new Error("A origem mudou; atualize a evidência."));
  await render();
  await note("Texto de conferência que deve continuar salvo no rascunho.");
  await click("Registrar anotação");
  expect(host.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
    "Texto de conferência que deve continuar salvo no rascunho.",
  );
});
it("readonly and historical versions cannot save or load reviewer options", async () => {
  m.readonly = true;
  await render();
  expect(host.querySelector("textarea")).toBeNull();
  expect(m.targets).not.toHaveBeenCalled();
  expect(m.save).not.toHaveBeenCalled();
  m.readonly = false;
  m.version = "historical";
  await render();
  expect(host.querySelector("textarea")).toBeNull();
  expect(m.targets).not.toHaveBeenCalled();
});
it("effective deny hides writable fields despite stale server canManage metadata", async () => {
  m.allowed = false;
  await render();
  expect(host.querySelector("textarea")).toBeNull();
  expect(m.targets).not.toHaveBeenCalled();
  expect(m.save).not.toHaveBeenCalled();
});
