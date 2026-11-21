// @vitest-environment jsdom
import { act, createElement, Fragment, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const W = "aaaaaaaa-1111-4111-8111-111111111111",
  R = "bbbbbbbb-1111-4111-8111-111111111111",
  D = "cccccccc-1111-4111-8111-111111111111";
const state = vi.hoisted(() => ({
  user: "user-a",
  workspace: "aaaaaaaa-1111-4111-8111-111111111111" as string | null,
  view: true,
  get: vi.fn(),
  write: vi.fn(),
  search: {} as Record<string, unknown>,
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options, useSearch: () => state.search }),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: state.user } }) }));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    workspaceId: state.workspace,
    isLoading: false,
    isError: false,
    can: () => state.view,
    canAny: () => state.view,
    permissions: new Set(),
  }),
}));
vi.mock("@/lib/access-control/use-shared-action", () => ({
  useSharedAction: () => state.view && !!state.workspace,
}));
vi.mock("@/lib/hiring/requests/operations.functions", () => ({
  getOperations: (input: unknown) => state.get(input),
  downloadFiscalDocument: state.write,
  reviewFiscalDocument: state.write,
  uploadFiscalDocument: state.write,
  saveDelivery: state.write,
  submitDelivery: state.write,
  decideDelivery: state.write,
  listDeliveryProjects: async () => ({ projects: [], milestones: [] }),
}));
vi.mock("@/lib/hiring/requests/preparation-screen", () => ({
  PreparationScreen: (props: unknown) => createElement("pre", null, JSON.stringify(props)),
}));
import { NotificationTargetNotice } from "@/components/notifications/notification-target-notice";
import { OperationsPanel } from "@/lib/hiring/requests/operations-panel";
import { OperationsHistory } from "@/lib/hiring/requests/operations-history";
import { emptyPreparation, type PreparationRow } from "@/lib/hiring/requests/types";
import { Route as PeopleRoute } from "@/routes/_authenticated/people.hiring-requests";
import { Route as SupplierRoute } from "@/routes/_authenticated/contracts.supplier-requests";
const row = {
  ...emptyPreparation("professional"),
  id: R,
  workspace_id: W,
  kind: "professional",
  title: "Solicitação exata",
  revision: 2,
  created_by: "user-a",
  created_at: "2026-11-20T12:00:00Z",
  updated_at: "2026-11-20T12:00:00Z",
} as PreparationRow;
const fiscal = {
  id: D,
  status: "registered",
  doc_type: "nfse",
  modality: null,
  file_name: "PRIVATE_FISCAL_FILE.pdf",
  mime_type: "application/pdf",
  size_bytes: 20,
  sha256: "a".repeat(64),
  issuer_tax_id: "12345678000199",
  taker_tax_id: "98765432000199",
  amount: 12345,
  currency: "BRL",
  document_number: "PRIVATE_NF_NUMBER",
  issued_on: "2026-12-15",
  delivery_id: null,
  uploaded_by_name: "Membro",
  registered_at: "2026-11-20T14:00:00Z",
  review: null,
  can_review: true,
};
const context = {
  started: true,
  proof_problem: null,
  kind: "professional",
  regime: "pj",
  period: null,
  can_manage_deliveries: false,
  can_register_fiscal: false,
  can_view_fiscal: true,
  deliveries: [],
  fiscal: [fiscal],
  eligible_responsibles: [],
};
let host: HTMLDivElement, root: Root, client: QueryClient;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  Object.assign(state, { user: "user-a", workspace: W, view: true, search: {} });
  state.get.mockReset().mockResolvedValue(context);
  state.write.mockReset();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  host.remove();
  vi.unstubAllGlobals();
});
async function render() {
  await act(async () =>
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          Fragment,
          null,
          createElement(OperationsHistory, { kind: "professional", row, fiscalDocumentId: D }),
          createElement(OperationsPanel, { kind: "professional", row, dirty: false, busy: false }),
        ),
      ),
    ),
  );
  for (let i = 0; i < 3; i++)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
    });
}
async function reason(value: string) {
  await act(async () => {
    const field = host.querySelector<HTMLTextAreaElement>(`#fiscal-review-${D}-reason`)!;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(
      field,
      value,
    );
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
it("locates and highlights the exact authorized NF without downloading, reviewing or accepting", async () => {
  await render();
  expect(host.querySelector('li[aria-current="true"]')?.textContent).toContain("PRIVATE_NF_NUMBER");
  expect(host.querySelector('li[aria-current="true"]')?.textContent).toContain("NF do aviso");
  expect(host.querySelector('li[aria-current="true"]')?.textContent).toContain("15/12/2026");
  expect(state.get).toHaveBeenCalledWith({ data: { kind: "professional", id: R } });
  expect(state.write).not.toHaveBeenCalled();
});
it("shows no fiscal values or CNPJ to a reader who only has request access", async () => {
  state.get.mockResolvedValue({ ...context, can_view_fiscal: false, fiscal: null });
  await render();
  expect(host.textContent).not.toContain(fiscal.document_number);
  expect(host.textContent).not.toContain("12.345");
  expect(host.textContent).not.toContain("12.345.678");
  expect(host.textContent).not.toContain(fiscal.file_name);
  expect(host.querySelector('li[aria-current="true"]')).toBeNull();
  expect(document.activeElement?.getAttribute("aria-label")).toBe("NF de contratação do aviso");
  expect(state.write).not.toHaveBeenCalled();
});
it("does not display a cached fiscal context before the fresh user/workspace read", async () => {
  client.setQueryData(["hiring-operations", "user-a", W, "professional", R, 2], context);
  state.get.mockImplementation(() => new Promise(() => {}));
  await render();
  expect(host.textContent).not.toContain(fiscal.document_number);
  expect(host.textContent).not.toContain(fiscal.file_name);
  expect(host.textContent).not.toContain("12.345.678");
});
it("preserves a fiscal review draft while revalidating and removes private content after failure", async () => {
  await render();
  await reason("Rascunho preservado");
  let finish!: (value: unknown) => void;
  state.get.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let pending!: Promise<unknown>;
  await act(async () => {
    pending = client.refetchQueries({ queryKey: ["hiring-operations"] });
  });
  await render();
  expect(
    host.querySelector<HTMLFieldSetElement>('[aria-label="Entregas e documentos fiscais"] fieldset')
      ?.hidden,
  ).toBe(true);
  expect(host.querySelector<HTMLTextAreaElement>(`#fiscal-review-${D}-reason`)?.value).toBe(
    "Rascunho preservado",
  );
  await act(async () => {
    finish(context);
    await pending;
  });
  await render();
  expect(host.querySelector<HTMLTextAreaElement>(`#fiscal-review-${D}-reason`)?.value).toBe(
    "Rascunho preservado",
  );
  state.get.mockRejectedValue(new Error("Acesso revogado"));
  await act(async () => {
    await client.refetchQueries({ queryKey: ["hiring-operations"] });
  });
  await render();
  expect(host.textContent).not.toContain(fiscal.document_number);
  expect(host.querySelector(`#fiscal-review-${D}-reason`)).toBeNull();
  expect(state.write).not.toHaveBeenCalled();
});
it("does not retain another actor's fiscal response after a workspace switch", async () => {
  let finish!: (value: unknown) => void;
  state.get.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await render();
  state.user = "user-b";
  state.workspace = "dddddddd-1111-4111-8111-111111111111";
  state.get.mockResolvedValue({ ...context, can_view_fiscal: false, fiscal: null });
  await render();
  await act(async () => finish(context));
  await render();
  expect(host.textContent).not.toContain(fiscal.document_number);
  expect(host.textContent).not.toContain(fiscal.file_name);
});
it.each(["payroll_evidence", "freelance_document"])(
  "does not label %s as an exact NF destination",
  async (doc_type) => {
    state.get.mockResolvedValue({
      ...context,
      fiscal: [{ ...fiscal, doc_type, can_review: false }],
    });
    await render();
    expect(host.querySelector('li[aria-current="true"]')).toBeNull();
    expect(host.querySelector('[aria-label="NF de contratação do aviso"]')?.textContent).toContain(
      "indisponível",
    );
  },
);
it("does not query the fiscal context without request view or active workspace", async () => {
  state.view = false;
  await render();
  expect(state.get).not.toHaveBeenCalled();
  state.view = true;
  state.workspace = null;
  await render();
  expect(state.get).not.toHaveBeenCalled();
});
type TestRoute = {
  options: {
    validateSearch: { parse: (value: unknown) => Record<string, unknown> };
    component: ComponentType;
  };
};
it.each([
  [PeopleRoute, "professional"],
  [SupplierRoute, "supplier"],
] as const)(
  "validates exact fiscal focus and retains the real request kind",
  async (route, kind) => {
    const page = route as unknown as TestRoute;
    state.search = page.options.validateSearch.parse({
      request: R,
      fiscalDocumentId: D,
      action: "approve",
    });
    await act(async () => root.render(createElement(page.options.component)));
    expect(JSON.parse(host.querySelector("pre")!.textContent!)).toEqual({
      kind,
      requestId: R,
      fiscalDocumentId: D,
    });
    expect(page.options.validateSearch.parse({ request: "bad", fiscalDocumentId: "bad" })).toEqual({
      request: undefined,
      fiscalDocumentId: undefined,
    });
    expect(state.write).not.toHaveBeenCalled();
  },
);

it("waits for fresh loading to end before focusing an unavailable fiscal target", async () => {
  const props = {
    label: "NF de contratação do aviso",
    targetId: D,
    available: false,
    failed: true,
    focusOnUnavailable: true,
    retry: null,
    children: null,
  };
  await act(async () =>
    root.render(createElement(NotificationTargetNotice, { ...props, loading: true })),
  );
  expect(document.activeElement?.getAttribute("aria-label")).not.toBe("NF de contratação do aviso");
  await act(async () =>
    root.render(createElement(NotificationTargetNotice, { ...props, loading: false })),
  );
  expect(document.activeElement?.getAttribute("aria-label")).toBe("NF de contratação do aviso");
  expect(host.textContent).toContain("indisponível");
  expect(state.write).not.toHaveBeenCalled();
});
it("preserves the default behavior of other destinations when unavailable focus is not enabled", async () => {
  await act(async () =>
    root.render(
      createElement(NotificationTargetNotice, {
        label: "Destino anterior",
        targetId: D,
        available: false,
        failed: true,
        loading: false,
        retry: null,
        children: "PRIVATE_CHILD",
      }),
    ),
  );
  expect(document.activeElement?.getAttribute("aria-label")).not.toBe("Destino anterior");
  expect(host.textContent).not.toContain("PRIVATE_CHILD");
  expect(state.write).not.toHaveBeenCalled();
});
