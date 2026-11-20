// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  user: "user-a",
  workspace: "aaaaaaaa-1111-4111-8111-111111111111" as string | null,
  fresh: true,
  fetching: false,
  failed: false,
  view: true,
  update: true,
  create: true,
  readOnly: false,
  upsert: vi.fn(),
  upload: vi.fn(),
  capability: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: state.user } }) }));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({ workspaceId: state.workspace, isLoading: false, isError: false }),
}));
vi.mock("@/lib/access-control/use-hr-capabilities", () => ({
  useHrCapabilities: (resource: string, ids: string[]) => {
    state.capability(resource, ids);
    return {
      isFetchedAfterMount: state.fresh,
      isFetching: state.fetching,
      isLoading: !state.fresh,
      isError: state.failed,
      for: () => ({
        can_view: state.view,
        can_update: state.update,
        can_create_child: state.create,
      }),
    };
  },
}));
vi.mock("@/lib/view-as-client", () => ({
  readViewAs: () => (state.readOnly ? { readOnly: true } : null),
}));
vi.mock("@/lib/people/documents.functions", () => ({
  upsertPersonDocument: (input: unknown) => state.upsert(input),
  createDocumentUpload: (input: unknown) => state.upload(input),
}));
vi.mock("@/components/files/file-center-picker", () => ({ FileCenterPickerDialog: () => null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { PersonDocumentDialog } from "@/components/people/document-dialog";
import type { PeopleDocumentRow } from "@/lib/people/documents.functions";
const P = "bbbbbbbb-1111-4111-8111-111111111111",
  D = "cccccccc-1111-4111-8111-111111111111";
const doc = {
  id: D,
  person_id: P,
  doc_type: "Certificado privado",
  doc_number: "PRIVATE_DOCUMENT_NUMBER",
  expires_at: "2026-12-15",
  issued_at: null,
  file_url: null,
  file_name: null,
  notes: null,
  status: "valid",
  is_sensitive: true,
} as PeopleDocumentRow;
let host: HTMLDivElement, root: Root, client: QueryClient;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  Object.assign(state, {
    user: "user-a",
    workspace: "aaaaaaaa-1111-4111-8111-111111111111",
    fresh: true,
    fetching: false,
    failed: false,
    view: true,
    update: true,
    create: true,
    readOnly: false,
  });
  state.upsert.mockReset().mockResolvedValue(doc);
  state.upload.mockReset();
  state.capability.mockClear();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  client = new QueryClient();
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  host.remove();
  vi.unstubAllGlobals();
});
async function render(initial: PeopleDocumentRow | null = doc, revalidating = false) {
  await act(async () =>
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(PersonDocumentDialog, {
          open: true,
          onOpenChange: vi.fn(),
          personId: P,
          document: initial,
          revalidating,
        }),
      ),
    ),
  );
}
const form = () => document.querySelector<HTMLFieldSetElement>('[role="dialog"] fieldset');
async function type(value: string) {
  await act(async () => {
    const input = document.querySelector<HTMLInputElement>(
      '[placeholder="Ex.: RG, Contrato Social..."]',
    )!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
it("requires the actual document update capability and saves a civil date without a time", async () => {
  await render();
  expect(state.capability).toHaveBeenCalledWith("documents", [D]);
  expect(form()?.disabled).toBe(false);
  await act(async () =>
    [...document.querySelectorAll("button")]
      .find((button) => button.textContent === "Salvar")!
      .click(),
  );
  expect(state.upsert).toHaveBeenCalledWith({
    data: expect.objectContaining({ id: D, person_id: P, expires_at: "2026-12-15" }),
  });
  expect(state.upload).not.toHaveBeenCalled();
});
it("requires canonical create-child capability for a new document", async () => {
  state.create = false;
  await render(null);
  expect(state.capability).toHaveBeenCalledWith("person_documents", [P]);
  expect(form()).toBeNull();
  expect(state.upsert).not.toHaveBeenCalled();
});
it("does not expose preloaded private fields before a fresh capability result", async () => {
  state.fresh = false;
  state.fetching = true;
  await render();
  expect(form()?.hidden).toBe(true);
  expect(form()?.disabled).toBe(true);
  expect(
    [...document.querySelectorAll("input")].some((input) => input.value === doc.doc_number),
  ).toBe(false);
});
it("preserves a draft while hidden and disabled during revalidation, then restores it without reset", async () => {
  await render();
  await type("Rascunho preservado");
  state.fetching = true;
  await render();
  expect(form()?.hidden).toBe(true);
  expect(form()?.disabled).toBe(true);
  state.fetching = false;
  await render();
  expect(form()?.hidden).toBe(false);
  expect(
    document.querySelector<HTMLInputElement>('[placeholder="Ex.: RG, Contrato Social..."]')?.value,
  ).toBe("Rascunho preservado");
});
it.each(["denied", "failed", "readOnly"])(
  "blocks writes after %s without trusting the parent writable default",
  async (reason) => {
    await render();
    if (reason === "denied") state.update = false;
    if (reason === "failed") state.failed = true;
    if (reason === "readOnly") state.readOnly = true;
    await render();
    expect(form() === null || form()!.disabled).toBe(true);
    expect(state.upsert).not.toHaveBeenCalled();
    expect(state.upload).not.toHaveBeenCalled();
  },
);
it("removes private fields after view revocation and discards prior actor drafts", async () => {
  await render();
  await type("Rascunho anterior");
  state.view = false;
  await render();
  expect(form()).toBeNull();
  state.user = "user-b";
  state.workspace = "dddddddd-1111-4111-8111-111111111111";
  state.fresh = false;
  state.fetching = true;
  await render();
  expect(
    [...document.querySelectorAll("input")].some((input) =>
      ["Rascunho anterior", doc.doc_number].includes(input.value),
    ),
  ).toBe(false);
  state.workspace = null;
  await render();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});
