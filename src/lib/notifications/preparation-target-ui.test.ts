// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const W = "aaaaaaaa-1111-4111-8111-111111111111",
  R = "bbbbbbbb-1111-4111-8111-111111111111";
const state = vi.hoisted(() => ({
  userId: "user-a",
  workspaceId: "aaaaaaaa-1111-4111-8111-111111111111" as string | null,
  view: true,
  get: vi.fn(),
  mutation: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: state.userId } }) }));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    workspaceId: state.workspaceId,
    isLoading: false,
    isError: false,
    can: () => true,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/lib/access-control/use-shared-action", () => ({
  useSharedAction: (resource: string, action: string) =>
    state.view && !resource.includes("reference") && ["view", "update"].includes(action),
}));
vi.mock("@/lib/view-as-client", () => ({ readViewAs: () => null }));
vi.mock("@/lib/hiring/requests/approvals.functions", () => ({
  getPreparationApproval: (input: unknown) => state.get(input),
  requestPreparationApproval: state.mutation,
  decidePreparationApproval: state.mutation,
}));
vi.mock("@/lib/hiring/requests/requests.functions", () => ({
  listPreparation: async () => [],
  preparationHistory: async () => [],
  searchPreparationPicker: async () => [],
  preparationReference: async () => null,
  savePreparation: state.mutation,
}));
vi.mock("@/components/hiring-requests/preparation-form", () => ({
  PreparationForm: ({
    value,
    onChange,
  }: {
    value: { title: string };
    onChange: (value: unknown) => void;
  }) =>
    createElement("input", {
      "aria-label": "Rascunho de título",
      value: value.title,
      onChange: (event: { target: { value: string } }) =>
        onChange({ ...value, title: event.target.value }),
    }),
}));
vi.mock("@/components/hiring-requests/preparation-reference-field", () => ({
  PreparationReferenceField: () => null,
}));
vi.mock("@/components/hiring-requests/preparation-origin-notice", () => ({
  PreparationOriginNotice: () => null,
}));
vi.mock("@/components/hiring-requests/supplier-document-intake", () => ({
  SupplierDocumentIntake: () => null,
}));
vi.mock("@/lib/hiring/requests/formalization-panel", () => ({ FormalizationPanel: () => null }));
vi.mock("@/lib/hiring/requests/execution-panel", () => ({ ExecutionPanel: () => null }));
vi.mock("@/lib/hiring/requests/execution-history", () => ({ ExecutionHistory: () => null }));
vi.mock("@/lib/hiring/requests/operations-panel", () => ({ OperationsPanel: () => null }));
vi.mock("@/lib/hiring/requests/operations-history", () => ({ OperationsHistory: () => null }));
vi.mock("@/lib/hiring/requests/economics-panel", () => ({ EconomicsPanel: () => null }));
vi.mock("@/lib/hiring/requests/economics-history", () => ({ EconomicsHistory: () => null }));
vi.mock("@/lib/hiring/requests/payables-panel", () => ({
  PayablesPanel: () => null,
  PayablesHistory: () => null,
}));
import { PreparationScreen } from "@/lib/hiring/requests/preparation-screen";
import { emptyPreparation } from "@/lib/hiring/requests/types";
const row = {
  ...emptyPreparation("professional"),
  title: "Solicitação profissional exata",
  id: R,
  workspace_id: W,
  kind: "professional",
  revision: 2,
  created_by: "Membro",
  created_at: "2026-11-20T12:00:00Z",
  updated_at: "2026-11-20T12:00:00Z",
};
const approval = {
  request: row,
  status: "pending",
  approval_id: R,
  stage: "manager",
  manager_name: "Gestor vigente",
  ceo_name: "CEO vigente",
  can_request: false,
  can_decide: true,
  events: [],
};
let host: HTMLDivElement, root: Root, client: QueryClient;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.assign(state, { userId: "user-a", workspaceId: W, view: true });
  state.get.mockReset().mockResolvedValue(approval);
  state.mutation.mockReset();
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
        createElement(PreparationScreen, { kind: "professional", requestId: R }),
      ),
    ),
  );
  for (let pass = 0; pass < 3; pass++)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
    });
}
async function type(selector: string, value: string) {
  await act(async () => {
    const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
    Object.getOwnPropertyDescriptor(
      input instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
it("opens the exact request in Review and current named approval without making a decision", async () => {
  await render();
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(row.title);
  expect(
    document.querySelector('[aria-label="Etapas da solicitação"] [aria-current="step"]')
      ?.textContent,
  ).toContain("Revisão");
  expect(document.querySelector('[aria-label="Aprovação da solicitação"]')?.textContent).toContain(
    "Gestor vigente",
  );
  expect(state.get).toHaveBeenCalledWith({ data: { kind: "professional", id: R } });
  expect(state.mutation).not.toHaveBeenCalled();
});
it("does not use a cached direct request before the current authorized lookup succeeds", async () => {
  client.setQueryData(["preparation-direct", "user-a", W, "professional", R], approval);
  state.get.mockImplementation(() => new Promise(() => {}));
  await render();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(host.textContent).not.toContain(row.title);
});
it("preserves the same identity draft while hiding and blocking it during revalidation, then removes it on failure", async () => {
  await render();
  await type('[aria-label="Rascunho de título"]', "Rascunho preservado");
  let finish!: (value: unknown) => void;
  state.get.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let pending!: Promise<unknown>;
  await act(async () => {
    pending = client.refetchQueries({ queryKey: ["preparation-direct"] });
  });
  await render();
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
    "Conferindo acesso à solicitação",
  );
  expect(document.querySelector<HTMLFieldSetElement>('[role="dialog"] fieldset')?.disabled).toBe(
    true,
  );
  expect(document.querySelector<HTMLInputElement>('[aria-label="Rascunho de título"]')?.value).toBe(
    "Rascunho preservado",
  );
  await act(async () => {
    finish(approval);
    await pending;
  });
  await render();
  expect(document.querySelector<HTMLInputElement>('[aria-label="Rascunho de título"]')?.value).toBe(
    "Rascunho preservado",
  );
  state.get.mockRejectedValue(new Error("Acesso revogado"));
  await act(async () => {
    await client.refetchQueries({ queryKey: ["preparation-direct"] });
  });
  await render();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.body.textContent).not.toContain("Rascunho preservado");
});
it("fences current approval capabilities and does not act on an old cached decision", async () => {
  await render();
  await type("#approval-note", "Motivo preservado");
  let finish!: (value: unknown) => void;
  state.get.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let pending!: Promise<unknown>;
  await act(async () => {
    pending = client.refetchQueries({ queryKey: ["preparation-approval"] });
  });
  await render();
  expect(document.querySelector("#approval-note")).toBeNull();
  await act(async () => {
    finish({ ...approval, can_decide: false });
    await pending;
  });
  await render();
  expect(
    [...document.querySelectorAll("button")].some((button) => button.textContent === "Aprovar"),
  ).toBe(false);
  expect(state.mutation).not.toHaveBeenCalled();
});
it("removes the prior request and draft when actor/workspace changes, or when access is denied", async () => {
  await render();
  await type('[aria-label="Rascunho de título"]', "Rascunho anterior");
  state.userId = "user-b";
  state.workspaceId = "cccccccc-1111-4111-8111-111111111111";
  state.get.mockRejectedValue(new Error("Sem acesso"));
  await render();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.body.textContent).not.toContain("Rascunho anterior");
  state.view = false;
  await render();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});
