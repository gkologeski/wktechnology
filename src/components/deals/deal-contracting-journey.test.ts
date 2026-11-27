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
  services: vi.fn(),
  acceptance: vi.fn(),
  write: true,
  readonly: false,
  signatureView: true,
  serviceView: true,
  contractView: true,
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params: _p, search: _s, ...props }: any) =>
    createElement("a", { ...props, href: to }, children),
}));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => {
    const can = (key: string) =>
      key === "techcontracts.signature_evidence.view.workspace"
        ? state.signatureView
        : key.startsWith("techservice.services.view.")
          ? state.serviceView
          : key.startsWith("techcontracts.contracts.view.")
            ? state.contractView
            : state.write || key.includes(".view.");
    return {
      workspaceId: "ws",
      isLoading: false,
      isError: false,
      permissions: new Set(
        [
          "techservice.services.view.workspace",
          "techcontracts.contracts.view.workspace",
          "techcontracts.signature_evidence.view.workspace",
        ].filter(can),
      ),
      refetch: vi.fn(),
      can,
      canAny: (keys: string[]) => keys.some(can),
    };
  },
}));
vi.mock("@/lib/view-as-client", () => ({
  readViewAs: () => (state.readonly ? { readOnly: true } : null),
}));
vi.mock("@/lib/deals/contracting-journey.functions", () => ({
  getDealContractingJourney: state.get,
  prepareDealContractDraft: state.prepare,
}));
vi.mock("@/lib/hiring/signature.functions", () => ({ getContractSignature: state.signature }));
vi.mock("@/lib/services.functions", () => ({ listServices: state.services }));
vi.mock("@/lib/contracts/acceptance.functions", () => ({
  getContractAcceptance: state.acceptance,
}));
vi.mock("@/components/contracts/contract-acceptance-card", () => ({
  ContractAcceptanceCard: () => createElement("p", null, "Gestão de aceite comercial"),
}));
vi.mock("@/lib/integrations/forsign/forsign.functions", () => ({
  getContractForsign: vi.fn().mockResolvedValue({ operations: [] }),
}));
vi.mock("@/lib/sales-flow.functions", () => ({ createContractFromSales: state.create }));
vi.mock("@/lib/audit-session", () => ({
  beginAuditSession: () => "test-session",
  endAuditSession: () => {},
}));
vi.mock("@/components/deals/deal-quotes", () => ({
  DealQuotes: () => createElement("p", null, "Controles de cotação"),
}));
vi.mock("@/components/deals/deal-proposals", () => ({ DealProposals: () => null }));
vi.mock("@/components/contracts/contract-handoffs", () => ({ ContractHandoffs: () => null }));
vi.mock("@/components/contracts/deal-contracts", () => ({ DealContracts: () => null }));
vi.mock("@/components/contracts/contract-wizard", () => ({ ContractWizard: () => null }));
vi.mock("@/components/contracts/purchase-from-sale-dialog", () => ({
  PurchaseFromSaleButton: () => null,
}));
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
import { DealContractingJourney, DealContractingPanel } from "./deal-contracting-journey";
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
  state.serviceView = true;
  state.contractView = true;
  state.get.mockResolvedValue(fixture());
  state.signature.mockResolvedValue({ reason: "Assinatura incompleta" });
  state.services.mockResolvedValue([]);
  state.acceptance.mockResolvedValue({
    accepted: false,
    signaturePending: true,
    billingReleased: false,
  });
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
async function render(panel = false) {
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(panel ? DealContractingPanel : DealContractingJourney, {
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

it("uses understandable Portuguese contract status in the journey history", async () => {
  const d = fixture();
  d.contracts = [{ ...contract, status: "awaiting_signature" }];
  state.get.mockResolvedValue(d);
  await render();
  const tab =
    host.querySelector('[role="tab"][data-state="inactive"][id$="activity"]') ??
    Array.from(host.querySelectorAll('[role="tab"]')).find((t) => t.textContent === "Histórico");
  expect(tab).toBeTruthy();
  await act(async () => {
    tab!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    tab!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
  });
  await flush();
  expect(host.textContent).toContain("Aguardando assinatura");
  expect(host.textContent).not.toContain("awaiting_signature");
});

it("keeps the complete journey closed until opened from the sidebar card", async () => {
  await render(true);
  expect(host.querySelector('ol[aria-label="Etapas da contratação"]')).toBeNull();
  expect(host.textContent).toContain("Contratação");
  await click("Abrir jornada e documentos");
  expect(document.body.textContent).toContain("Contratação do negócio");
  expect(
    document.body.querySelector('ol[aria-label="Etapas da contratação"]')?.querySelectorAll("li"),
  ).toHaveLength(5);
});

it("shows completed delivery with accepted contract, pending signature and retained billing", async () => {
  const d = fixture();
  d.contracts = [{ ...contract, status: "awaiting_signature" }];
  state.get.mockResolvedValue(d);
  state.services.mockResolvedValue([
    { id: "service", status: "completed", billing_hold: "awaiting_signature" },
  ]);
  state.acceptance.mockResolvedValue({
    accepted: true,
    signaturePending: true,
    billingReleased: false,
  });
  await render();
  await flush();
  expect(host.textContent).toContain("Execução: 1 de 1 serviço(s) concluído(s)");
  expect(host.textContent).toContain("Contrato aceito comercialmente · Assinatura pendente");
  expect(host.textContent).toContain("Cobrança retida em 1 serviço(s)");
  const milestones = host
    .querySelector('ol[aria-label="Etapas da contratação"]')!
    .querySelectorAll("li");
  expect(milestones[3].textContent).toContain("Etapa atual");
  expect(milestones[4].textContent).toContain("Concluída");
  expect(host.textContent).not.toContain("Assinatura válida para a versão atual");
  await click("Acompanhar execução");
  expect(host.textContent).toContain("Serviços do contrato");
  expect(state.services).toHaveBeenCalledWith({ data: { contractId: "contract", limit: 500 } });
});

it("does not fetch or reuse cached service results when service read permission is removed", async () => {
  const d = fixture();
  d.contracts = [contract];
  state.get.mockResolvedValue(d);
  client.setQueryDefaults(["journey-services"], { gcTime: Infinity });
  state.services.mockResolvedValue([
    { id: "cached-service", status: "completed", billing_hold: "awaiting_signature" },
  ]);
  await render();
  expect(host.textContent).toContain("Execução: 1 de 1 serviço(s) concluído(s)");
  state.services.mockClear();
  state.serviceView = false;
  await render();
  expect(state.services).not.toHaveBeenCalled();
  expect(host.textContent).not.toContain("Execução: 1 de 1 serviço(s) concluído(s)");
  expect(host.textContent).not.toContain("Cobrança retida em 1 serviço(s)");
  expect(host.textContent).not.toContain("Acompanhar execução dos serviços");
});
it("hides cached acceptance evidence when contract read access is removed", async () => {
  const d = fixture();
  d.contracts = [contract];
  state.get.mockResolvedValue(d);
  state.acceptance.mockResolvedValue({
    accepted: true,
    signaturePending: true,
    billingReleased: false,
  });
  await render();
  expect(host.textContent).toContain("Contrato aceito comercialmente");
  state.acceptance.mockClear();
  state.contractView = false;
  await render();
  expect(state.acceptance).not.toHaveBeenCalled();
  expect(host.textContent).not.toContain("Contrato aceito comercialmente");
});
