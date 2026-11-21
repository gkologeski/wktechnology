// @vitest-environment jsdom
import { act, createElement, type ComponentType, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const W = "aaaaaaaa-1111-4111-8111-111111111111",
  E = "bbbbbbbb-1111-4111-8111-111111111111";
const state = vi.hoisted(() => ({
  user: "user-a",
  workspace: "aaaaaaaa-1111-4111-8111-111111111111" as string | null,
  view: true,
  pay: true,
  fetching: false,
  fresh: true,
  failed: false,
  readOnly: false,
  get: vi.fn(),
  siblings: vi.fn(),
  write: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useParams: () => ({ id: "bbbbbbbb-1111-4111-8111-111111111111" }),
  }),
  useNavigate: () => vi.fn(),
  Link: ({ to, children }: { to: string; children: ReactNode }) =>
    createElement("a", { href: to }, children),
}));
vi.mock("@/lib/access-control/use-hr-capabilities", () => ({ useHrCapabilities: () => ({}) }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: state.user } }) }));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    workspaceId: state.workspace,
    isLoading: false,
    isError: false,
    permissions: new Set(),
    canAny: () => state.view,
    can: () => state.view,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/lib/access-control/use-finance-capabilities", () => ({
  useFinanceCapabilities: () => ({
    isFetching: state.fetching,
    isFetchedAfterMount: state.fresh,
    isError: state.failed,
    refetch: vi.fn(),
    for: () => ({
      can_pay: state.pay,
      can_update: false,
      can_cancel: false,
      can_reverse: false,
      can_delete: false,
    }),
  }),
}));
vi.mock("@/lib/access-control/use-can-delete", () => ({
  DELETE_NOT_ALLOWED_TITLE: "Sem permissão",
  useCanDelete: () => ({ isLoading: false, canDeleteRecord: () => false }),
}));
vi.mock("@/lib/view-as-client", () => ({
  readViewAs: () => (state.readOnly ? { readOnly: true } : null),
}));
vi.mock("@/lib/finance.functions", () => ({
  getFinancialEntry: (input: unknown) => state.get(input),
  listInstallmentSiblings: () => state.siblings(),
  cancelFinancialEntry: state.write,
  deletePayment: state.write,
  deleteInstallmentGroup: state.write,
  registerPayment: state.write,
}));
vi.mock("@/lib/finance-references.functions", () => ({ listBankReferences: async () => [] }));
import { Route } from "@/routes/_authenticated/finance.entries.$id";
const page = Route as unknown as { options: { component: ComponentType } };
const entry = {
  id: E,
  workspace_id: W,
  description: "Título financeiro exato",
  direction: "payable",
  amount: 100,
  paid_amount: 20,
  currency: "BRL",
  status: "partial",
  competence_date: "2026-12-01",
  due_date: "2026-12-15",
  notes: "PRIVATE_AUTHORIZED_ENTRY_NOTE",
  owner_id: "user-a",
  parent_entry_id: null,
  installment_total: null,
  payments_visible: false,
  payments: [],
  companies: null,
  contracts: null,
  services: null,
  financial_categories: null,
  origin_type: "manual",
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
  Object.assign(state, {
    user: "user-a",
    workspace: W,
    view: true,
    pay: true,
    fetching: false,
    fresh: true,
    failed: false,
    readOnly: false,
  });
  state.get.mockReset().mockResolvedValue(entry);
  state.siblings.mockReset().mockResolvedValue([]);
  state.write.mockReset().mockResolvedValue({});
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
      createElement(QueryClientProvider, { client }, createElement(page.options.component)),
    ),
  );
  for (let i = 0; i < 3; i++)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
    });
}
async function click(label: string) {
  await act(async () =>
    [...document.querySelectorAll("button")]
      .find((button) => button.textContent?.trim() === label)!
      .click(),
  );
}
async function draft(value: string) {
  await act(async () => {
    const input = document.querySelector<HTMLInputElement>(
      '[role="dialog"] input[inputmode="decimal"]',
    )!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
it.each(["payable", "receivable"])(
  "opens the exact %s entry with civil dates and no mutation",
  async (direction) => {
    state.get.mockResolvedValue({ ...entry, direction });
    await render();
    expect(state.get).toHaveBeenCalledExactlyOnceWith({ data: { id: E } });
    expect(host.textContent).toContain(entry.description);
    expect(host.textContent).toContain("15/12/2026");
    expect(host.textContent).toContain("01/12/2026");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(state.write).not.toHaveBeenCalled();
  },
);
it("requires a fresh result before displaying cached amounts or notes", async () => {
  client.setQueryData(["finance-entry", "user-a", W, E], entry);
  state.get.mockImplementation(() => new Promise(() => {}));
  await render();
  expect(host.textContent).not.toContain(entry.description);
  expect(host.textContent).not.toContain(entry.notes);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});
it("does not load without screen permission or an active workspace", async () => {
  state.view = false;
  await render();
  expect(state.get).not.toHaveBeenCalled();
  state.view = true;
  state.workspace = null;
  await render();
  expect(state.get).not.toHaveBeenCalled();
});
it("rejects a response from another workspace and does not expose private fields", async () => {
  state.get.mockResolvedValue({ ...entry, workspace_id: "cccccccc-1111-4111-8111-111111111111" });
  await render();
  expect(host.textContent).not.toContain(entry.notes);
  expect(host.textContent).not.toContain(entry.description);
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
});
it("preserves the real payment form draft while revalidating then restores it, without resetting inputs", async () => {
  await render();
  await click("Registrar pagamento");
  await render();
  await draft("35,50");
  let finish!: (value: unknown) => void;
  state.get.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let pending!: Promise<unknown>;
  await act(async () => {
    pending = client.refetchQueries({ queryKey: ["finance-entry", "user-a", W, E], exact: true });
  });
  await render();
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
    "Conferindo acesso à baixa",
  );
  expect(document.querySelector<HTMLFieldSetElement>('[role="dialog"] fieldset')?.disabled).toBe(
    true,
  );
  expect(
    document.querySelector<HTMLInputElement>('[role="dialog"] input[inputmode="decimal"]')?.value,
  ).toBe("35,50");
  await act(async () => {
    finish(entry);
    await pending;
  });
  await render();
  expect(
    document.querySelector<HTMLInputElement>('[role="dialog"] input[inputmode="decimal"]')?.value,
  ).toBe("35,50");
  expect(state.write).not.toHaveBeenCalled();
});
it.each(["paid", "cancelled", "balance", "capability"])(
  "blocks an old payment form after %s changes without automatically posting a payment",
  async (reason) => {
    await render();
    await click("Registrar pagamento");
    await render();
    await draft("35,50");
    if (reason === "capability") state.pay = false;
    state.get.mockResolvedValue({
      ...entry,
      ...(reason === "balance"
        ? { paid_amount: 90 }
        : reason === "capability"
          ? {}
          : { status: reason }),
    });
    await act(async () => {
      await client.refetchQueries({ queryKey: ["finance-entry", "user-a", W, E], exact: true });
    });
    await render();
    expect(document.querySelector<HTMLFieldSetElement>('[role="dialog"] fieldset')?.disabled).toBe(
      true,
    );
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      "Saldo, situação ou permissão mudaram",
    );
    expect(state.write).not.toHaveBeenCalled();
  },
);
it("removes an old form after lookup failure and discards state on actor/workspace change", async () => {
  await render();
  await click("Registrar pagamento");
  await render();
  await draft("35,50");
  state.get.mockRejectedValue(new Error("Sem acesso"));
  await act(async () => {
    await client.refetchQueries({ queryKey: ["finance-entry", "user-a", W, E], exact: true });
  });
  await render();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(host.textContent).not.toContain(entry.notes);
  state.user = "user-b";
  state.workspace = "cccccccc-1111-4111-8111-111111111111";
  await render();
  expect(host.textContent).not.toContain(entry.notes);
  expect(state.write).not.toHaveBeenCalled();
});
it("does not show cached installment rows until their separate authorized lookup finishes", async () => {
  state.get.mockResolvedValue({ ...entry, installment_total: 2 });
  client.setQueryData(
    ["finance-entry-siblings", "user-a", W, E],
    [{ ...entry, description: "PRIVATE_OLD_SIBLING", amount: 999 }],
  );
  state.siblings.mockImplementation(() => new Promise(() => {}));
  await render();
  expect(host.textContent).not.toContain("PRIVATE_OLD_SIBLING");
  expect(host.textContent).not.toContain("999");
});
