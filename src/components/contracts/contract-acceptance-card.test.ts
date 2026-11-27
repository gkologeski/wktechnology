// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  get: vi.fn(),
  record: vi.fn(),
  createLink: vi.fn(),
  release: vi.fn(),
  revoke: vi.fn(),
  revokeLink: vi.fn(),
  keys: new Set<string>(),
  readonly: false,
  selectedDate: "2026-11-26",
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (f: unknown) => f }));
vi.mock("@/lib/contracts/acceptance.functions", () => ({
  getContractAcceptance: m.get,
  recordContractAcceptance: m.record,
  createContractAcceptanceLink: m.createLink,
  releaseContractAcceptanceBilling: m.release,
  revokeContractAcceptance: m.revoke,
  revokeContractAcceptanceLink: m.revokeLink,
}));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    workspaceId: "w",
    isLoading: false,
    isError: false,
    can: (key: string) => m.keys.has(key),
  }),
}));
vi.mock("@/lib/view-as-client", () => ({ readViewAs: () => ({ readOnly: m.readonly }) }));
vi.mock("@/components/iso-date-picker", () => ({
  IsoDatePicker: ({
    id,
    value,
    onChange,
  }: {
    id: string;
    value: string;
    onChange: (value: string) => void;
  }) =>
    createElement(
      "button",
      { id, type: "button", onClick: () => onChange(m.selectedDate) },
      value || "Escolher data",
    ),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { ContractAcceptanceCard } from "./contract-acceptance-card";

let host: HTMLDivElement, root: Root, qc: QueryClient;
const fixture = (patch = {}) => ({
  contractId: "c",
  currentHash: "h",
  accepted: false,
  acceptance: null,
  history: [],
  signaturePending: true,
  billingReleased: false,
  canRecord: true,
  canManageLinks: true,
  canReleaseBilling: true,
  ...patch,
});
beforeEach(() => {
  vi.clearAllMocks();
  m.keys = new Set([
    "techcontracts.contracts.view.workspace",
    "techcontracts.contract_acceptance.approve.workspace",
    "techcontracts.contract_acceptance.manage.workspace",
    "techcontracts.contract_acceptance_billing.manage.workspace",
    "techservice.billing.manage.workspace",
    "techfinance.entries.create.workspace",
    "techfinance.entries.view.workspace",
  ]);
  m.readonly = false;
  m.selectedDate = "2026-11-26";
  m.get.mockResolvedValue(fixture());
  m.record.mockResolvedValue({ accepted: true });
  m.release.mockResolvedValue({ generated: 1 });
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
});
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 25));
  });
}
async function render(hasUnsavedChanges = false) {
  await act(async () =>
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(ContractAcceptanceCard, {
          contractId: "c",
          role: "provider",
          hasUnsavedChanges,
        }),
      ),
    ),
  );
  await flush();
}
const button = (label: string) =>
  Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.trim() === label);
async function click(label: string) {
  expect(button(label)).toBeTruthy();
  await act(async () => button(label)!.click());
  await flush();
}
async function fill(id: string, value: string) {
  const node = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement;
  expect(node).toBeTruthy();
  const prototype =
    node instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("keeps commercial acceptance and pending signature visible as independent facts", async () => {
  m.get.mockResolvedValue(
    fixture({
      accepted: true,
      acceptance: {
        id: "a",
        source: "internal",
        clientName: "Cliente autorizado",
        acceptedAt: "2026-11-26",
        recordedAt: "2026-11-26T12:00:00Z",
        evidence: "Aceite pelo e-mail do cliente",
        contentHash: "h",
      },
    }),
  );
  await render();
  expect(host.textContent).toContain("Contrato aceito · versão atual");
  expect(host.textContent).toContain("Assinatura pendente");
  expect(host.textContent).toContain("Sem liberação pelo aceite vigente");
  expect(m.release).not.toHaveBeenCalled();
});
it("does not offer record, links, or financial release without their own permission", async () => {
  m.keys = new Set(["techcontracts.contracts.view.workspace"]);
  m.get.mockResolvedValue(fixture({ accepted: true }));
  await render();
  expect(button("Registrar aceite recebido")).toBeUndefined();
  expect(button("Gerar link de aceite")).toBeUndefined();
  expect(button("Liberar faturamento")).toBeUndefined();
  expect(button("Revogar aceite")).toBeUndefined();
});
it("keeps actions unavailable when the server blocks approval readiness or the view is readonly", async () => {
  m.get.mockResolvedValue(
    fixture({ canRecord: false, canManageLinks: false, canReleaseBilling: false }),
  );
  await render();
  expect(button("Registrar aceite recebido")).toBeUndefined();
  expect(button("Gerar link de aceite")).toBeUndefined();
});
it("requires real date, client name and evidence and preserves the draft on an RPC failure", async () => {
  m.record.mockRejectedValueOnce(new Error("A versão foi alterada; confira o contrato."));
  await render();
  await click("Registrar aceite recebido");
  expect(button("Confirmar aceite recebido")?.disabled).toBe(true);
  await fill("contract-acceptance-name", "Cliente autorizado");
  await click("Escolher data");
  expect(button("Confirmar aceite recebido")?.disabled).toBe(true);
  await fill(
    "contract-acceptance-evidence",
    "Cliente confirmou este contrato pelo e-mail de 26/11.",
  );
  await click("Confirmar aceite recebido");
  expect(m.record).toHaveBeenCalledWith({
    data: {
      contractId: "c",
      expectedHash: "h",
      clientName: "Cliente autorizado",
      acceptedAt: "2026-11-26",
      evidence: "Cliente confirmou este contrato pelo e-mail de 26/11.",
    },
  });
  expect(
    (document.getElementById("contract-acceptance-evidence") as HTMLTextAreaElement).value,
  ).toContain("confirmou este contrato");
  expect(m.release).not.toHaveBeenCalled();
  expect(button("Confirmar aceite recebido")?.disabled).toBe(false);
});
it("sends an explicitly reviewed due date only on financial release, without signature fields", async () => {
  m.get.mockResolvedValue(fixture({ accepted: true }));
  await render();
  await click("Liberar faturamento");
  expect(m.release).not.toHaveBeenCalled();
  m.selectedDate = "2026-11-30";
  await click("Escolher data");
  await fill("contract-acceptance-reason", "Pagamento acordado com o cliente para esta data.");
  await click("Confirmar liberação do faturamento");
  expect(m.release).toHaveBeenCalledWith({
    data: {
      contractId: "c",
      expectedHash: "h",
      dueDate: "2026-11-30",
      reason: "Pagamento acordado com o cliente para esta data.",
    },
  });
  expect(m.record).not.toHaveBeenCalled();
});
it("requires saving local contract changes before any acceptance action", async () => {
  await render(true);
  expect(host.textContent).toContain("Salve as alterações do contrato");
  expect(button("Registrar aceite recebido")).toBeUndefined();
  expect(button("Gerar link de aceite")).toBeUndefined();
});
it("keeps the originally reviewed hash and blocks a form if the current version changes", async () => {
  await render();
  await click("Registrar aceite recebido");
  await fill("contract-acceptance-name", "Cliente autorizado");
  await click("Escolher data");
  await fill("contract-acceptance-evidence", "Aceite do documento revisado pelo cliente.");
  await act(async () =>
    qc.setQueryData(["contract-acceptance", "w", "c"], fixture({ currentHash: "new-hash" })),
  );
  await flush();
  expect(document.body.textContent).toContain("O documento mudou durante esta conferência");
  expect(button("Confirmar aceite recebido")?.disabled).toBe(true);
  expect(m.record).not.toHaveBeenCalled();
});
