// @vitest-environment jsdom
import { act, createElement, type PropsWithChildren } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type {
  PurchaseProposalContext,
  PurchaseProposalDocument,
} from "@/lib/contracts/purchase-proposal.types";

const m = vi.hoisted(() => ({
  get: vi.fn(),
  save: vi.fn(),
  generate: vi.fn(),
  preview: vi.fn(),
  packagePreview: vi.fn(),
  generated: vi.fn(),
  close: vi.fn(),
  keys: new Set<string>(),
  workspace: "wk",
  user: "buyer",
  loading: false,
  error: false,
  parentView: true,
  parentUpdate: true,
  readonly: false,
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/contracts/purchase-proposal.functions", () => ({
  getPurchaseProposalContext: m.get,
  savePurchaseProposalDraft: m.save,
  generatePurchaseProposalAttachment: m.generate,
  previewPurchaseProposal: m.preview,
}));
vi.mock("@/lib/contracts/attachments.functions", () => ({
  previewContractSignaturePackage: m.packagePreview,
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: m.user } }) }));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    workspaceId: m.workspace,
    permissions: m.keys,
    isLoading: m.loading,
    isError: m.error,
    can: (key: string) => m.keys.has(key),
  }),
}));
vi.mock("@/lib/access-control/use-work-capabilities", () => ({
  useWorkCapabilities: () => ({
    for: () => ({ can_view: m.parentView, can_update: m.parentUpdate }),
  }),
}));
vi.mock("@/lib/view-as-client", () => ({ readViewAs: () => ({ readOnly: m.readonly }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: PropsWithChildren) => createElement("div", null, children),
  DialogContent: ({ children }: PropsWithChildren) =>
    createElement("div", { role: "dialog" }, children),
  DialogHeader: ({ children }: PropsWithChildren) => createElement("header", null, children),
  DialogTitle: ({ children }: PropsWithChildren) => createElement("h2", null, children),
  DialogDescription: ({ children }: PropsWithChildren) => createElement("p", null, children),
  DialogFooter: ({ children }: PropsWithChildren) => createElement("footer", null, children),
}));
vi.mock("@/components/iso-date-picker", () => ({
  IsoDatePicker: ({ id, value }: { id: string; value: string | null }) =>
    createElement("button", { id, type: "button" }, value || "Escolher data"),
}));
import { PurchaseProposalWizard } from "./purchase-proposal-wizard";

const data = {
  title: "Escopo da fornecedora",
  scope: "Implementação do módulo solicitado.",
  exclusions: "Infraestrutura não incluída.",
  acceptanceCriteria: "Aceite expresso da WK após os testes acordados.",
  hours: 40,
  hourlyRate: 90,
  businessDays: 8,
  startsOn: null,
  endsOn: null,
  paymentTerms: "10 dias úteis após aceite expresso e nota fiscal válida.",
  responsibilities: "Prestadora desenvolve e testa; WK implanta em produção.",
  warrantyDays: 90,
  milestones: [
    {
      id: "m1",
      title: "Módulo funcional",
      description: "Código, testes e documentação.",
      acceptanceCriteria: "Testes aceitos expressamente pela WK.",
      hours: 40,
      businessDays: 8,
    },
  ],
};
const documentFixture = (
  patch: Partial<PurchaseProposalDocument> = {},
): PurchaseProposalDocument => ({
  id: "doc-1",
  version: 1,
  templateId: "model-1",
  templateRevision: 1,
  data: structuredClone(data),
  design: {} as PurchaseProposalDocument["design"],
  parties: {
    wk: { name: "WK contratante", cnpj: "cnpj-wk" },
    supplier: { name: "Prestadora autorizada", cnpj: "cnpj-supplier" },
  },
  createdAt: "2026-11-27T12:00:00Z",
  attachmentId: null,
  status: "draft",
  sha256: null,
  ...patch,
});
const fixture = (patch: Partial<PurchaseProposalContext> = {}): PurchaseProposalContext => ({
  canView: true,
  canManage: true,
  canGenerate: true,
  canManageTemplates: false,
  isPurchase: true,
  contractHash: "purchase-hash",
  blockedReason: null,
  contract: { id: "purchase", totalValue: 3600, currency: "BRL", startsOn: null, endsOn: null },
  parties: documentFixture().parties,
  templates: [
    {
      id: "model-1",
      name: "Fábrica de Software — por entregas",
      revision: 1,
      design: {} as PurchaseProposalDocument["design"],
    },
  ],
  documents: [documentFixture()],
  ...patch,
});
let host: HTMLDivElement, root: Root, qc: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(m, {
    workspace: "wk",
    user: "buyer",
    loading: false,
    error: false,
    parentView: true,
    parentUpdate: true,
    readonly: false,
  });
  m.keys = new Set([
    "techcontracts.purchase_proposals.view.workspace",
    "techcontracts.purchase_proposals.manage.workspace",
    "techcontracts.signature_evidence.manage.workspace",
  ]);
  m.get.mockResolvedValue(fixture());
  m.save.mockImplementation(async ({ data: input }) =>
    documentFixture({ id: "doc-2", version: 2, data: input.data }),
  );
  m.generate.mockResolvedValue({ documentId: "doc-2", attachmentId: "attachment" });
  m.preview.mockResolvedValue({
    url: "https://private.example/document.pdf",
    name: "Proposta técnica de compra · versão 2",
  });
  m.packagePreview.mockResolvedValue({ url: "https://private.example/package.pdf" });
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
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}
async function render() {
  await act(async () =>
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(PurchaseProposalWizard, {
          contractId: "purchase",
          open: true,
          onOpenChange: m.close,
          onGenerated: m.generated,
        }),
      ),
    ),
  );
  await flush();
}
const button = (label: string) =>
  Array.from(host.querySelectorAll("button")).find((node) => node.textContent?.trim() === label);
async function click(label: string) {
  const node = button(label);
  expect(node, label).toBeTruthy();
  await act(async () => node!.click());
  await flush();
}
async function fill(id: string, value: string) {
  const node = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement;
  expect(node, id).toBeTruthy();
  const proto =
    node instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function reviewChangedDraft() {
  await click("Usar este modelo");
  await fill("purchase-scope", "Escopo atualizado exclusivamente para a prestadora.");
  await click("Salvar e conferir");
}

it("does not fetch economic documents without the own view key or while permissions are unavailable", async () => {
  m.keys.clear();
  await render();
  expect(m.get).not.toHaveBeenCalled();
  expect(host.textContent).not.toContain("Prestadora autorizada");
  m.keys.add("techcontracts.purchase_proposals.view.workspace");
  m.loading = true;
  await render();
  expect(m.get).not.toHaveBeenCalled();
  m.loading = false;
  m.error = true;
  await render();
  expect(m.get).not.toHaveBeenCalled();
});
it("does not reveal cached purchase data when parent access is denied", async () => {
  await render();
  expect(host.textContent).toContain("Prestadora autorizada");
  m.parentView = false;
  await render();
  expect(host.textContent).not.toContain("Prestadora autorizada");
  expect(host.textContent).not.toContain("3.600");
});
it("uses server denial even when local keys allow viewing", async () => {
  m.get.mockResolvedValue(
    fixture({ canView: false, blockedReason: "Acesso negado pelo workspace." }),
  );
  await render();
  expect(host.textContent).toContain("Acesso negado pelo workspace.");
  expect(host.textContent).not.toContain("Prestadora autorizada");
  expect(button("Usar este modelo")).toBeUndefined();
});
it("keeps consultation read-only without manage, parent update or in a readonly session", async () => {
  m.keys.delete("techcontracts.purchase_proposals.manage.workspace");
  await render();
  await click("Usar este modelo");
  expect((document.getElementById("purchase-scope") as HTMLTextAreaElement).disabled).toBe(true);
  expect(button("Salvar e conferir")).toBeUndefined();
  expect(m.save).not.toHaveBeenCalled();
  m.keys.add("techcontracts.purchase_proposals.manage.workspace");
  m.parentUpdate = false;
  await render();
  expect(button("Salvar e conferir")).toBeUndefined();
  m.parentUpdate = true;
  m.readonly = true;
  await render();
  expect(button("Salvar e conferir")).toBeUndefined();
});
it("starts a new purchase without transaction examples or inherited sale values", async () => {
  m.get.mockResolvedValue(
    fixture({
      documents: [],
      contract: { id: "purchase", totalValue: 0, currency: "BRL", startsOn: null, endsOn: null },
    }),
  );
  await render();
  await click("Usar este modelo");
  expect((document.getElementById("purchase-hours") as HTMLInputElement).value).toBe("");
  expect((document.getElementById("purchase-hourlyRate") as HTMLInputElement).value).toBe("");
  expect((document.getElementById("purchase-scope") as HTMLTextAreaElement).value).toBe("");
  expect(host.textContent).toContain("não altera automaticamente o valor do contrato");
  expect(host.textContent).not.toContain("170 horas");
  expect(host.textContent).not.toContain("125,00");
  await click("Salvar e conferir");
  expect(m.save).not.toHaveBeenCalled();
  expect(host.querySelector('[role="alert"]')).toBeTruthy();
});
it("validates milestone allocation before saving and preserves a failed draft", async () => {
  await render();
  await click("Usar este modelo");
  await fill("purchase-hours", "41");
  await click("Salvar e conferir");
  expect(m.save).not.toHaveBeenCalled();
  expect(host.textContent).toContain("A soma das horas deve ser igual");
  await fill("purchase-hours", "40");
  await fill("purchase-scope", "Escopo que deve permanecer no erro.");
  m.save.mockRejectedValueOnce(new Error("Revisão concorrente: atualize o contrato."));
  await click("Salvar e conferir");
  expect(host.textContent).toContain("Revisão concorrente");
  expect((document.getElementById("purchase-scope") as HTMLTextAreaElement).value).toContain(
    "deve permanecer",
  );
  expect(m.generate).not.toHaveBeenCalled();
});
it("saves only purchase fields and requires viewing its own PDF before generating", async () => {
  await render();
  await reviewChangedDraft();
  expect(m.save).toHaveBeenCalledWith({
    data: {
      contractId: "purchase",
      templateId: "model-1",
      expectedVersion: 1,
      expectedContractHash: "purchase-hash",
      data: { ...data, scope: "Escopo atualizado exclusivamente para a prestadora." },
    },
  });
  expect((button("Gerar documento e anexar") as HTMLButtonElement).disabled).toBe(true);
  expect((document.getElementById("purchase-reviewed") as HTMLButtonElement).disabled).toBe(true);
  await click("Abrir prévia da proposta");
  expect(m.preview).toHaveBeenCalledWith({ data: { contractId: "purchase", documentId: "doc-2" } });
  expect(host.querySelector("iframe")?.getAttribute("src")).toBe(
    "https://private.example/document.pdf",
  );
  expect(m.generate).not.toHaveBeenCalled();
  expect(m.packagePreview).not.toHaveBeenCalled();
});
it("generates an immutable annex, refreshes the contract and leaves signature sending explicit", async () => {
  await render();
  await reviewChangedDraft();
  await click("Abrir prévia da proposta");
  await act(async () =>
    (document.getElementById("purchase-reviewed") as HTMLButtonElement).click(),
  );
  m.get.mockResolvedValue(
    fixture({
      documents: [
        documentFixture({
          id: "doc-2",
          version: 2,
          attachmentId: "attachment",
          status: "generated",
          sha256: "hash",
        }),
      ],
    }),
  );
  await click("Gerar documento e anexar");
  expect(m.generate).toHaveBeenCalledWith({
    data: {
      contractId: "purchase",
      documentId: "doc-2",
      expectedVersion: 2,
      expectedContractHash: "purchase-hash",
    },
  });
  expect(m.generated).toHaveBeenCalledOnce();
  expect(host.textContent).toContain("Proposta técnica no contrato");
  expect(host.textContent).toContain("assinatura nativa ou a ForSign");
  expect(m.packagePreview).not.toHaveBeenCalled();
  expect(button("Gerar documento e anexar")).toBeUndefined();
});
it("preserves the reviewed document on generation failure without fabricating an attachment", async () => {
  m.generate.mockRejectedValueOnce(new Error("Contrato em assinatura: anexo bloqueado."));
  await render();
  await reviewChangedDraft();
  await click("Abrir prévia da proposta");
  await act(async () =>
    (document.getElementById("purchase-reviewed") as HTMLButtonElement).click(),
  );
  await click("Gerar documento e anexar");
  expect(host.textContent).toContain("anexo bloqueado");
  expect(m.generated).not.toHaveBeenCalled();
  expect(host.textContent).not.toContain("Proposta técnica no contrato");
});
it("does not retry generation if the follow-up refresh fails after the attachment was created", async () => {
  await render();
  await reviewChangedDraft();
  await click("Abrir prévia da proposta");
  await act(async () =>
    (document.getElementById("purchase-reviewed") as HTMLButtonElement).click(),
  );
  m.get.mockRejectedValueOnce(new Error("Falha temporária na consulta."));
  await click("Gerar documento e anexar");
  expect(host.textContent).toContain("O anexo foi gerado");
  expect(button("Gerar documento e anexar")).toBeUndefined();
  expect(m.generate).toHaveBeenCalledOnce();
});
it("clears the former user's purchase on workspace switches and rejects inactive access", async () => {
  await render();
  expect(host.textContent).toContain("Prestadora autorizada");
  m.workspace = "another-workspace";
  m.user = "inactive";
  m.get.mockResolvedValue(
    fixture({
      canView: false,
      parties: undefined,
      contract: undefined,
      templates: [],
      documents: [],
      blockedReason: "Membro inativo ou sem acesso.",
    }),
  );
  await render();
  expect(host.textContent).not.toContain("Prestadora autorizada");
  expect(host.textContent).toContain("Membro inativo");
  expect(m.save).not.toHaveBeenCalled();
});
it("keeps generated versions available and previews only the selected own document", async () => {
  m.get.mockResolvedValue(
    fixture({
      documents: [documentFixture({ status: "generated", attachmentId: "a", sha256: "h" })],
    }),
  );
  await render();
  expect(host.textContent).toContain("Proposta técnica no contrato");
  await click("Conferir versão 1");
  expect(m.preview).toHaveBeenCalledWith({ data: { contractId: "purchase", documentId: "doc-1" } });
  expect(m.generate).not.toHaveBeenCalled();
  expect(m.save).not.toHaveBeenCalled();
});
it("requires the own purchase price to match an already-valued contract without changing it", async () => {
  m.get.mockResolvedValue(
    fixture({
      contract: { id: "purchase", totalValue: 5000, currency: "BRL", startsOn: null, endsOn: null },
    }),
  );
  await render();
  await click("Usar este modelo");
  await click("Salvar e conferir");
  expect(host.textContent).toContain("difere do valor do contrato de compra");
  expect(m.save).not.toHaveBeenCalled();
  expect(m.generate).not.toHaveBeenCalled();
});
it("does not claim that a generated document is attached after its link was removed", async () => {
  m.get.mockResolvedValue(
    fixture({ documents: [documentFixture({ status: "generated", attachmentId: null })] }),
  );
  await render();
  expect(host.textContent).toContain("anexo desta versão foi removido");
  expect(host.textContent).not.toContain("Proposta técnica no contrato");
  await click("Iniciar nova revisão");
  await click("Salvar e conferir");
  expect(m.save).toHaveBeenCalledWith({
    data: expect.objectContaining({ expectedVersion: 1, data }),
  });
  expect(host.textContent).toContain("Confira o documento para a prestadora");
  expect(m.generate).not.toHaveBeenCalled();
});
it("does not offer generation when the server blocks the contract despite local management keys", async () => {
  m.get.mockResolvedValue(
    fixture({ canGenerate: false, blockedReason: "Revisão jurídica pendente." }),
  );
  await render();
  await click("Usar este modelo");
  await click("Salvar e conferir");
  expect(host.textContent).toContain("Revisão jurídica pendente");
  expect(button("Gerar documento e anexar")).toBeUndefined();
  expect(m.generate).not.toHaveBeenCalled();
});
it("keeps the form usable with invalid monetary inputs instead of crashing the summary", async () => {
  await render();
  await click("Usar este modelo");
  await fill("purchase-hours", "-2");
  expect(host.textContent).toContain("Preencha valores válidos");
  await click("Salvar e conferir");
  expect(m.save).not.toHaveBeenCalled();
});
it("does not silently adopt a new contract hash after a background refetch", async () => {
  await render();
  await click("Usar este modelo");
  await fill("purchase-scope", "Rascunho anterior ainda não revisado.");
  await act(async () => {
    qc.setQueryData(
      ["purchase-proposal-context", m.user, m.workspace, "purchase", [...m.keys].sort().join("|")],
      fixture({ contractHash: "changed-in-background" }),
    );
  });
  await flush();
  expect(host.textContent).toContain("foram alterados durante a edição");
  expect((document.getElementById("purchase-scope") as HTMLTextAreaElement).value).toBe(
    "Rascunho anterior ainda não revisado.",
  );
  expect((button("Salvar e conferir") as HTMLButtonElement).disabled).toBe(true);
  expect(m.save).not.toHaveBeenCalled();
  expect(m.generate).not.toHaveBeenCalled();
});
