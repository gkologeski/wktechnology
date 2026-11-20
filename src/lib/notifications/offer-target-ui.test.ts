// @vitest-environment jsdom
import { act, createElement, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const W = "aaaaaaaa-1111-4111-8111-111111111111",
  O = "bbbbbbbb-1111-4111-8111-111111111111";
const state = vi.hoisted(() => ({
  userId: "user-a",
  workspaceId: "aaaaaaaa-1111-4111-8111-111111111111" as string | null,
  view: true,
  search: {} as Record<string, unknown>,
  get: vi.fn(),
  list: vi.fn(),
  mutation: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useSearch: () => state.search,
    useNavigate: () => vi.fn(),
  }),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: state.userId } }) }));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    workspaceId: state.workspaceId,
    isLoading: false,
    isError: false,
    permissions: new Set(),
    canAny: () => state.view,
    can: () => false,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/lib/access-control/use-hr-capabilities", () => ({ useHrCapabilities: () => ({}) }));
vi.mock("@/lib/ats/offers.functions", () => ({
  getOffer: (input: unknown) => state.get(input),
  listOffers: () => state.list(),
  sendOffer: state.mutation,
  cancelOffer: state.mutation,
  deleteOffer: state.mutation,
  reviewOffer: state.mutation,
  getOfferLink: state.mutation,
}));
vi.mock("@/components/ats/offer-terms-editor", () => ({ OfferTermsEditor: () => null }));
vi.mock("@/components/grid/grid-list-toolbar", () => ({ GridListToolbar: () => null }));
vi.mock("@/components/grid/grid-bulk-bar", () => ({ GridBulkBar: () => null }));
vi.mock("@/components/grid/use-grid-selection", () => ({
  useGridSelection: () => ({
    hasSelection: false,
    ids: [],
    selectedRows: [],
    isSelected: () => false,
  }),
  idQueryFor: () => undefined,
}));
vi.mock("@/components/kanban/kanban-board", () => ({ KanbanBoard: () => null }));
vi.mock("@/lib/audit-session", () => ({
  beginAuditSession: () => "fixture",
  endAuditSession: () => {},
  touchAuditSession: () => {},
}));
import { Route } from "@/routes/_authenticated/(ats)/offers";
const page = Route as unknown as {
  options: {
    component: ComponentType;
    validateSearch: (input: Record<string, unknown>) => Record<string, unknown>;
  };
};
const offer = {
  id: O,
  title: "Oferta demonstrativa",
  status: "draft",
  revision: 2,
  approval_status: "pending",
  salary_amount: 9000,
  salary_currency: "BRL",
  body: "Condições privadas autorizadas",
  start_date: "2026-12-15",
  can_view_terms: true,
  can_edit_terms: false,
  can_approve: true,
  can_request: false,
  can_send: false,
  can_cancel: false,
  can_delete: false,
  ats_candidates: { full_name: "Candidato demonstrativo", email: null },
  ats_jobs: { title: "Vaga demonstrativa" },
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
    userId: "user-a",
    workspaceId: W,
    view: true,
    search: page.options.validateSearch({ offerId: O }),
  });
  state.get.mockReset().mockResolvedValue(offer);
  state.list.mockReset().mockResolvedValue([]);
  state.mutation.mockReset().mockResolvedValue({});
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
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}
async function click(text: string) {
  await act(async () =>
    [...host.querySelectorAll("button")]
      .find((button) => button.textContent?.trim() === text)!
      .click(),
  );
}
it("opens the exact offer independently of an empty list, without reviewing or sending automatically", async () => {
  await render();
  expect(state.get).toHaveBeenCalledExactlyOnceWith({ data: { id: O } });
  expect(host.querySelector('[aria-label="Oferta do aviso"]')?.textContent).toContain(offer.title);
  expect(host.querySelector('tr[aria-current="true"]')?.textContent).toContain(offer.title);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(state.mutation).not.toHaveBeenCalled();
});
it("does not query offers without a view key or an active workspace", async () => {
  state.view = false;
  await render();
  expect(state.get).not.toHaveBeenCalled();
  expect(state.list).not.toHaveBeenCalled();
  state.view = true;
  state.workspaceId = null;
  await render();
  expect(state.get).not.toHaveBeenCalled();
});
it("rejects malformed URL IDs instead of constructing a target", () => {
  expect(
    page.options.validateSearch({ offerId: "bad&redirect=elsewhere" }).offerId,
  ).toBeUndefined();
});
it("hides cached content until a fresh authorized lookup finishes and removes it after failure", async () => {
  client.setQueryData(["notification-offer", "user-a", W, O], offer);
  let reject!: (cause: Error) => void;
  state.get.mockImplementation(
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
  );
  await render();
  expect(host.textContent).not.toContain(offer.title);
  await act(async () => reject(new Error("Acesso indisponível")));
  await render();
  expect(host.textContent).not.toContain(offer.title);
  expect(host.textContent).toContain("indisponível");
});
it("does not adopt another actor's pending result after an identity or workspace switch", async () => {
  let finish!: (value: unknown) => void;
  state.get.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await render();
  state.userId = "user-b";
  state.workspaceId = "cccccccc-1111-4111-8111-111111111111";
  state.get.mockRejectedValue(new Error("Indisponível"));
  await render();
  await act(async () => finish(offer));
  await render();
  expect(host.textContent).not.toContain(offer.title);
  expect(state.mutation).not.toHaveBeenCalled();
});
it.each(["approval permission", "offer status"])(
  "fences a stale review when %s changes at the same revision, preserving the note",
  async (reason) => {
    await render();
    await click("Revisar");
    const note = document.querySelector<HTMLTextAreaElement>(
      '[aria-label="Parecer da aprovação"]',
    )!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(
        note,
        "Rascunho de parecer",
      );
      note.dispatchEvent(new Event("input", { bubbles: true }));
    });
    state.get.mockResolvedValue({
      ...offer,
      ...(reason === "approval permission" ? { can_approve: false } : { status: "cancelled" }),
    });
    await act(async () => {
      await client.refetchQueries({
        queryKey: ["notification-offer", "user-a", W, O],
        exact: true,
      });
    });
    await render();
    const fields = document.querySelector<HTMLFieldSetElement>('[role="dialog"] fieldset')!;
    expect(fields.hidden).toBe(true);
    expect(fields.disabled).toBe(true);
    expect(fields.hasAttribute("inert")).toBe(true);
    expect(
      document.querySelector<HTMLTextAreaElement>('[aria-label="Parecer da aprovação"]')?.value,
    ).toBe("Rascunho de parecer");
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      "As condições ou permissões mudaram",
    );
    expect(state.mutation).not.toHaveBeenCalled();
  },
);
it("removes a focused review after lookup failure instead of leaving old private conditions actionable", async () => {
  await render();
  await click("Revisar");
  state.get.mockRejectedValue(new Error("Permissão revogada"));
  await act(async () => {
    await client.refetchQueries({ queryKey: ["notification-offer", "user-a", W, O], exact: true });
  });
  await render();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(host.textContent).not.toContain(offer.body);
  expect(state.mutation).not.toHaveBeenCalled();
});
