// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  get: vi.fn(),
  prepare: vi.fn(),
  create: vi.fn(),
  signature: vi.fn(),
  write: true,
  readonly: false,
  signatureView: true,
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params: _p, search: _s, ...props }: any) =>
    createElement("a", { ...props, href: to }, children),
}));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    workspaceId: "ws",
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    can: (key: string) =>
      key === "techcontracts.signature_evidence.view.workspace"
        ? state.signatureView
        : state.write || key.includes(".view."),
    canAny: (keys: string[]) => keys.some((k) => state.write || k.includes(".view.")),
  }),
}));
vi.mock("@/lib/view-as-client", () => ({
  readViewAs: () => (state.readonly ? { readOnly: true } : null),
}));
vi.mock("@/lib/deals/contracting-journey.functions", () => ({
  getDealContractingJourney: state.get,
  prepareDealContractDraft: state.prepare,
}));
vi.mock("@/lib/hiring/signature.functions", () => ({ getContractSignature: state.signature }));
vi.mock("@/lib/sales-flow.functions", () => ({ createContractFromSales: state.create }));
vi.mock("@/lib/audit-session", () => ({
  beginAuditSession: () => "test-session",
  endAuditSession: () => {},
}));
vi.mock("@/components/deals/deal-quotes", () => ({
  DealQuotes: () => createElement("p", null, "Controles de cotação"),
}));
vi.mock("@/components/deals/deal-proposals", () => ({ DealProposals: () => null }));
vi.mock("@/components/contracts/deal-contracts", () => ({ DealContracts: () => null }));
vi.mock("@/components/contracts/contract-wizard", () => ({ ContractWizard: () => null }));
vi.mock("@/components/deals/quote-internal-preview", () => ({ QuoteInternalPreview: () => null }));
vi.mock("@/components/deals/quote-wizard", () => ({ QuoteWizard: () => null }));
vi.mock("@/components/proposals/proposal-wizard", () => ({ ProposalWizard: () => null }));
vi.mock("@/components/contracts/contract-draft-review-page", () => ({
  ContractDraftReviewPage: () => null,
}));
vi.mock("@/components/hiring/contract-signature-card", () => ({
  ContractSignatureCard: () => null,
}));
vi.mock("@/components/contracts/contract-approvals-panel", () => ({
  ContractApprovalsPanel: () => null,
}));
vi.mock("@/components/deals/deal-delivery-panel", () => ({
  DealDeliveryPanel: () => createElement("p", null, "Preparação de entrega"),
}));
vi.mock("@/components/services/contract-services", () => ({
  ContractServices: () => createElement("p", null, "Serviços do contrato"),
}));
import { DealContractingJourney } from "./deal-contracting-journey";
const id = "10000000-0000-4000-8000-000000000001";
const proposal = {
  id,
  title: "Proposta de teste",
  status: "accepted",
  created_at: "2026-11-14",
  quote_id: null,
  version: 2,
  locked: true,
  decided_at: "2026-11-14T12:00:00Z",
  total_amount: 100,
  currency: "BRL",
  legal_entity_id: id,
};
const draft = {
  id: "draft",
  title: "Minuta de teste",
  status: "accepted",
  created_at: "2026-11-14",
  proposal_id: id,
  revision: 3,
  client_decided_at: "2026-11-14T12:00:00Z",
  client_note: null,
  missing_template: false,
};
const contract = {
  id: "contract",
  title: "Contrato de teste",
  status: "active",
  created_at: "2026-11-14",
  proposal_id: id,
  quote_id: null,
  number: "C1",
  document_kind: "main",
  starts_at: null,
  ends_at: null,
};
function fixture() {
  return {
    quotes: [],
    proposals: [proposal],
    drafts: [draft],
    contracts: [] as (typeof contract)[],
    access: { quotes: true, proposals: true, drafts: true, contracts: true },
    truncated: false,
  };
}
let host: HTMLDivElement, root: Root, client: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  state.write = true;
  state.readonly = false;
  state.signatureView = true;
  state.get.mockResolvedValue(fixture());
  state.signature.mockResolvedValue({ reason: "Assinatura incompleta" });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});
async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 25));
  });
}
async function render() {
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(DealContractingJourney, {
          dealId: id,
          origin: null,
          onOriginChange: vi.fn(),
        }),
      ),
    );
    await new Promise((r) => setTimeout(r, 25));
  });
  await flush();
}
async function click(text: string) {
  const b = Array.from(document.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === text,
  );
  expect(b, "button " + text).toBeTruthy();
  await act(async () => b!.click());
  await flush();
}
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  host.remove();
  document.querySelectorAll("[data-radix-popper-content-wrapper]").forEach((e) => e.remove());
});
it("renders five milestones and the Finance handoff without recreating documents", async () => {
  await render();
  expect(
    host.querySelector('ol[aria-label="Etapas da contratação"]')?.querySelectorAll("li"),
  ).toHaveLength(5);
  expect(host.textContent).toContain("Financeiro");
  expect(host.textContent).toContain("Conferir e preparar contrato");
  expect(state.create).not.toHaveBeenCalled();
});
it("opens a short Finance confirmation before creating the contract", async () => {
  await render();
  await click("Conferir e preparar contrato");
  expect(document.body.textContent).toContain("Condições herdadas da proposta");
  expect(document.body.textContent).toContain("Minuta aceita · revisão 3");
  expect(state.create).not.toHaveBeenCalled();
});
it("never offers contract creation to a read-only session", async () => {
  state.readonly = true;
  await render();
  expect(host.textContent).not.toContain("Conferir e preparar contrato");
  expect(state.create).not.toHaveBeenCalled();
});
it("never offers contract creation without the action key", async () => {
  state.write = false;
  await render();
  expect(host.textContent).not.toContain("Conferir e preparar contrato");
  expect(state.create).not.toHaveBeenCalled();
});
it("keeps partial or missing signature at the contract stage", async () => {
  const d = fixture();
  d.contracts = [contract];
  state.get.mockResolvedValue(d);
  await render();
  expect(host.textContent).toContain("Assinatura incompleta");
  expect(host.textContent).not.toContain("Organizar início e entrega");
});
it("does not release service from cached evidence after read permission is removed", async () => {
  state.signatureView = false;
  const d = fixture();
  d.contracts = [contract];
  state.get.mockResolvedValue(d);
  client.setQueryData(["contract-signature", "contract", "journey", undefined], { reason: null });
  await render();
  expect(host.textContent).not.toContain("Organizar início e entrega");
  expect(state.signature).not.toHaveBeenCalled();
});
it("shows operations only after current evidence is verified", async () => {
  const d = fixture();
  d.contracts = [contract];
  state.get.mockResolvedValue(d);
  state.signature.mockResolvedValue({ reason: null });
  await render();
  await flush();
  expect(host.textContent).toContain("Organizar início e entrega");
  await click("Organizar início e entrega");
  expect(host.textContent).toContain("Serviços do contrato");
});
it("shows an actionable load error instead of a false empty journey", async () => {
  state.get.mockRejectedValue(new Error("statement timeout"));
  await render();
  expect(host.textContent).toContain("Não foi possível carregar a jornada");
  expect(host.textContent).toContain("Tentar novamente");
  expect(host.textContent).not.toContain("Preparar cotação");
});
it("identifies restricted documents without claiming they do not exist", async () => {
  const d = fixture();
  d.access.drafts = false;
  d.drafts = [];
  state.get.mockResolvedValue(d);
  await render();
  expect(host.textContent).toContain("não confirma que não existam");
});
