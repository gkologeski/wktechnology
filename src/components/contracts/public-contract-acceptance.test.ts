// @vitest-environment jsdom
import { act, createElement, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ get: vi.fn(), decide: vi.fn(), token: "a".repeat(64) }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (f: unknown) => f }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options, useParams: () => ({ token: m.token }) }),
}));
vi.mock("@/lib/contracts/acceptance.functions", () => ({
  getPublicContractAcceptance: m.get,
  decidePublicContractAcceptance: m.decide,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { Route } from "@/routes/contract-acceptance.$token";
const Page = Route.options.component as ComponentType;
const fixture = (patch = {}) => ({
  title: "Contrato de prestação",
  number: "C-1",
  bodyHtml: '<p>Condições contratuais</p><script>danger()</script><img src="x" onerror="danger()">',
  workspaceName: "Empresa prestadora",
  counterpartyName: "Cliente autorizado",
  totalValue: 4500,
  currency: "BRL",
  status: "pending",
  clientName: null,
  acceptedAt: null,
  expiresAt: "2026-12-01T12:00:00Z",
  startsAt: "2026-11-26",
  endsAt: null,
  paymentTerms: { downPayment: { kind: "none" }, plan: { kind: "fixed_date", date: "2026-11-30" } },
  services: [],
  attachments: [{ id: "annex", name: "Escopo aceito.pdf", kind: "proposal" }],
  ...patch,
});
let host: HTMLDivElement, root: Root, qc: QueryClient;
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.clearAllMocks();
  m.get.mockResolvedValue(fixture());
  m.decide.mockResolvedValue({ accepted: true, acceptedAt: "2026-11-26" });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  await act(async () => root.unmount());
  qc.clear();
  host.remove();
  vi.unstubAllGlobals();
});
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 25));
  });
}
async function render() {
  await act(async () =>
    root.render(createElement(QueryClientProvider, { client: qc }, createElement(Page))),
  );
  await flush();
}
async function name(value: string) {
  const node = document.getElementById("public-contract-acceptance-name") as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const acceptButton = () =>
  Array.from(host.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === "Aceitar contrato",
  )!;
it("renders the frozen document safely with terms and token-scoped annex downloads", async () => {
  await render();
  expect(host.textContent).toContain("Condições contratuais");
  expect(host.textContent).toContain("30/11/2026");
  expect(host.textContent).toContain("não registra nem substitui sua assinatura");
  expect(host.querySelector("script")).toBeNull();
  expect(host.querySelector("img")?.hasAttribute("onerror")).toBe(false);
  expect(host.querySelector("a")?.getAttribute("href")).toBe(
    `/api/public/contract-acceptance/${m.token}/attachments/annex`,
  );
  expect(m.decide).not.toHaveBeenCalled();
});
it("requires explicit client agreement and identity before accepting without signing or billing", async () => {
  await render();
  expect(acceptButton().disabled).toBe(true);
  await name("Cliente autorizado");
  expect(acceptButton().disabled).toBe(true);
  await act(async () => (host.querySelector('[role="checkbox"]') as HTMLButtonElement).click());
  await act(async () => acceptButton().click());
  await flush();
  expect(m.decide).toHaveBeenCalledWith({
    data: { token: m.token, clientName: "Cliente autorizado", accepted: true },
  });
});
it("makes revoked or expired links unavailable without an acceptance form", async () => {
  m.get.mockResolvedValue(null);
  await render();
  expect(host.textContent).toContain("Link de aceite indisponível");
  expect(host.querySelector("form")).toBeNull();
  expect(m.decide).not.toHaveBeenCalled();
});
it("shows an accepted contract without describing it as signed", async () => {
  m.get.mockResolvedValue(
    fixture({ status: "accepted", clientName: "Cliente autorizado", acceptedAt: "2026-11-26" }),
  );
  await render();
  expect(host.textContent).toContain("Contrato aceito comercialmente");
  expect(host.textContent).toContain("A assinatura do contrato continua separada deste aceite");
  expect(host.querySelector("form")).toBeNull();
});
