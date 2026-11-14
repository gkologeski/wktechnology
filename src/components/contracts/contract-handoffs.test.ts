// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { it, expect, vi, beforeEach, afterEach } from "vitest";
const m = vi.hoisted(() => ({
  load: vi.fn(),
  retry: vi.fn(),
  reconcile: vi.fn(),
  manage: false,
  readonly: false,
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (f: unknown) => f }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: any) => createElement("a", { href: to }, children),
}));
vi.mock("@/lib/contracts/handoffs.functions", () => ({
  getContractHandoffs: m.load,
  retryContractHandoff: m.retry,
  reconcileContractHandoffs: m.reconcile,
}));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    workspaceId: "w",
    isLoading: false,
    isError: false,
    can: () => m.manage,
  }),
}));
vi.mock("@/lib/view-as-client", () => ({ readViewAs: () => ({ readOnly: m.readonly }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { ContractHandoffs } from "./contract-handoffs";
let host: HTMLDivElement, root: Root, q: QueryClient;
const fixture = () => [
  {
    id: "h",
    step: "signature",
    status: "pending",
    assignee_name: "Pessoa do Financeiro",
    subject: "Conferir e enviar para assinatura",
    href: "/contracts/c",
    due_at: "2026-12-01T18:00:00Z",
    blocked_reason: null,
    created_at: "2026-11-14T12:00:00Z",
  },
];
beforeEach(() => {
  vi.clearAllMocks();
  m.manage = false;
  m.readonly = false;
  m.load.mockResolvedValue(fixture());
  m.retry.mockResolvedValue({ ok: true });
  m.reconcile.mockResolvedValue(0);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  q = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  await act(async () => root.unmount());
  q.clear();
  host.remove();
});
async function render() {
  await act(async () =>
    root.render(
      createElement(
        QueryClientProvider,
        { client: q },
        createElement(ContractHandoffs, { dealId: "d" }),
      ),
    ),
  );
  await act(async () => {
    await new Promise((r) => setTimeout(r, 35));
  });
}
it("shows source task responsible deadline and actual state", async () => {
  await render();
  expect(host.textContent).toContain("Pessoa do Financeiro");
  expect(host.textContent).toContain("Prazo:");
  expect(host.textContent).toContain("Pendente");
  expect(host.querySelector("a")?.getAttribute("href")).toBe("/contracts/c");
  expect(m.load).toHaveBeenCalledWith({ data: { dealId: "d", contractId: undefined } });
});
it("does not represent an empty queue as completed work", async () => {
  m.load.mockResolvedValue([]);
  await render();
  expect(host.textContent).toContain("Nenhum encaminhamento registrado");
  expect(host.textContent).not.toContain("Concluído");
});
it("surfaces read failures instead of inventing no pending actions", async () => {
  m.load.mockRejectedValue(new Error("error"));
  await render();
  expect(host.querySelector("[role=alert]")?.textContent).toContain("Não foi possível");
});
it("only manager can explicitly request a blocked retry", async () => {
  m.manage = true;
  m.load.mockResolvedValue([
    { ...fixture()[0], status: "blocked", blocked_reason: "Corrija o acesso" },
  ]);
  await render();
  expect(m.retry).not.toHaveBeenCalled();
  const b = [...host.querySelectorAll("button")].find(
    (b) => b.textContent === "Reprocessar etapa",
  )!;
  await act(async () => b.click());
  expect(m.retry).toHaveBeenCalledWith({ data: { id: "h" } });
});
it("hides mutating actions for readonly even with manage permission", async () => {
  m.manage = true;
  m.readonly = true;
  m.load.mockResolvedValue([{ ...fixture()[0], status: "blocked" }]);
  await render();
  expect(host.textContent).not.toContain("Reprocessar etapa");
  expect(host.textContent).not.toContain("Gerar pendências");
  expect(m.retry).not.toHaveBeenCalled();
});
