import { beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import type { PurchaseProposalContext, PurchaseProposalDocument } from "./purchase-proposal.types";
import { createEmptyPurchaseProposalData } from "./purchase-proposal.types";
import { createPurchaseFactoryTemplate } from "./purchase-proposal-render";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  active: vi.fn(),
  adminUpload: vi.fn(),
  signed: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@/lib/access-control/work-core.server", () => ({ workRpc: mocks.rpc }));
vi.mock("@/lib/access-control/enforce.server", () => ({ getActiveWorkspaceId: mocks.active }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    storage: {
      from: () => ({
        upload: mocks.adminUpload,
        createSignedUrl: mocks.signed,
        remove: mocks.remove,
      }),
    },
  },
}));
import {
  generatePurchaseProposalDocument,
  previewPurchaseProposalDocument,
  savePurchaseProposal,
} from "./purchase-proposal.server";

const CONTRACT = "40000000-0000-4000-8000-000000000001",
  DOC = "50000000-0000-4000-8000-000000000001",
  ATTACHMENT = "60000000-0000-4000-8000-000000000001";
const HASH = "a".repeat(64),
  PATH = "workspace/contract/attachment";
const data = {
  ...createEmptyPurchaseProposalData(),
  scope: "Escopo independente de compra",
  acceptanceCriteria: "Aceite expresso",
  hours: 8,
  hourlyRate: 75,
  businessDays: 2,
  milestones: [
    {
      id: "m1",
      title: "Entrega",
      description: "Implementação",
      acceptanceCriteria: "Critérios objetivos",
      hours: 8,
      businessDays: 2,
    },
  ],
};
const design = createPurchaseFactoryTemplate();
const document: PurchaseProposalDocument = {
  id: DOC,
  version: 1,
  templateId: "template",
  templateRevision: 1,
  data,
  design,
  parties: {
    wk: { name: "WK", cnpj: "11111111000111" },
    supplier: { name: "Prestadora", cnpj: "22222222000122" },
  },
  createdAt: "2026-11-27T12:00:00Z",
  attachmentId: null,
  status: "draft",
  sha256: null,
};
const context = (): PurchaseProposalContext => ({
  canView: true,
  canManage: true,
  canGenerate: true,
  canManageTemplates: false,
  isPurchase: true,
  contractHash: HASH,
  blockedReason: null,
  contract: { id: CONTRACT, totalValue: 600, currency: "BRL", startsOn: null, endsOn: null },
  parties: document.parties,
  templates: [{ id: "template", name: "Fábrica", revision: 1, design }],
  documents: [document],
});
const bytes = new TextEncoder().encode("%PDF-1.7\nfixture content");
const input = {
  contractId: CONTRACT,
  documentId: DOC,
  expectedVersion: 1,
  expectedContractHash: HASH,
};
const download = vi.fn(),
  upload = vi.fn(),
  storage = vi.fn();
const sb = { storage: { from: storage } } as unknown as SupabaseClient;
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("BROWSERLESS_TOKEN", "local-test-only");
  fetchMock = vi.fn().mockResolvedValue(new Response(bytes, { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  mocks.active.mockResolvedValue("workspace");
  mocks.adminUpload.mockResolvedValue({ error: null });
  mocks.signed.mockResolvedValue({
    data: { signedUrl: "https://private.invalid/preview" },
    error: null,
  });
  mocks.remove.mockResolvedValue({ error: null });
  storage.mockReturnValue({ download, upload });
  download.mockResolvedValue({ data: null, error: { message: "Not found" } });
  upload.mockResolvedValue({ error: null });
  mocks.rpc.mockImplementation(async (_sb: unknown, name: string) => {
    if (name === "purchase_proposal_context") return context();
    if (name === "purchase_proposal_prepare")
      return {
        id: ATTACHMENT,
        path: PATH,
        document: { ...document, attachmentId: ATTACHMENT, status: "reserved" },
        generated: false,
      };
    if (name === "purchase_proposal_finish")
      return { ...document, attachmentId: ATTACHMENT, status: "generated" };
    if (name === "purchase_proposal_save") return document;
    throw Error("Unexpected RPC " + name);
  });
});
it("denied economic read stops preview before PDF rendering or privileged storage", async () => {
  mocks.rpc.mockResolvedValue({ ...context(), canView: false, documents: [] });
  await expect(previewPurchaseProposalDocument(sb, "actor", CONTRACT, DOC)).rejects.toThrow(
    "sem permissão",
  );
  expect(fetchMock).not.toHaveBeenCalled();
  expect(mocks.adminUpload).not.toHaveBeenCalled();
});
it("denied generation and stale contract never reserve, render or upload an attachment", async () => {
  mocks.rpc.mockResolvedValue({ ...context(), canGenerate: false });
  await expect(generatePurchaseProposalDocument(sb, input)).rejects.toThrow("Recarregue");
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(upload).not.toHaveBeenCalled();
  mocks.rpc.mockResolvedValue(context());
  await expect(
    generatePurchaseProposalDocument(sb, { ...input, expectedContractHash: "stale" }),
  ).rejects.toThrow("Recarregue");
  expect(fetchMock).not.toHaveBeenCalled();
});
it("version already generated reuses canonical attachment without provider call", async () => {
  mocks.rpc.mockResolvedValue({
    ...context(),
    documents: [{ ...document, status: "generated", attachmentId: ATTACHMENT }],
  });
  await expect(generatePurchaseProposalDocument(sb, input)).resolves.toEqual({
    documentId: DOC,
    attachmentId: ATTACHMENT,
  });
  expect(storage).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
});
it("lost finalization resumes own reserved PDF without rerendering or overwrite", async () => {
  download.mockResolvedValue({ data: new Blob([bytes], { type: "application/pdf" }), error: null });
  await expect(generatePurchaseProposalDocument(sb, input)).resolves.toEqual({
    documentId: DOC,
    attachmentId: ATTACHMENT,
  });
  expect(fetchMock).not.toHaveBeenCalled();
  expect(upload).not.toHaveBeenCalled();
  expect(mocks.rpc).toHaveBeenLastCalledWith(sb, "purchase_proposal_finish", {
    p_contract: CONTRACT,
    p_document: DOC,
    p_sha: createHash("sha256").update(bytes).digest("hex"),
  });
});
it("fresh generation uploads only a private PDF and its own content hash", async () => {
  await generatePurchaseProposalDocument(sb, input);
  expect(storage).toHaveBeenCalledWith("contract-attachments");
  expect(upload).toHaveBeenCalledWith(PATH, bytes, {
    contentType: "application/pdf",
    upsert: false,
    metadata: { sha256: createHash("sha256").update(bytes).digest("hex") },
  });
  expect(mocks.adminUpload).not.toHaveBeenCalled();
});
it("upload collision never overwrites the reserved artifact or marks it ready", async () => {
  upload.mockResolvedValue({ error: { message: "Already exists" } });
  await expect(generatePurchaseProposalDocument(sb, input)).rejects.toThrow("gravar o PDF");
  expect(upload.mock.calls[0][2].upsert).toBe(false);
  expect(mocks.rpc.mock.calls.some((call) => call[1] === "purchase_proposal_finish")).toBe(false);
});
it("malformed renderer response cannot become a signed annex", async () => {
  fetchMock.mockResolvedValue(new Response("upstream HTML error", { status: 200 }));
  await expect(generatePurchaseProposalDocument(sb, input)).rejects.toThrow("PDF válido");
  expect(upload).not.toHaveBeenCalled();
  expect(mocks.rpc.mock.calls.some((call) => call[1] === "purchase_proposal_finish")).toBe(false);
});
it("revoked permission after preview upload removes the privileged temporary file", async () => {
  let reads = 0;
  mocks.rpc.mockImplementation(async () =>
    ++reads < 3 ? context() : { ...context(), canView: false, documents: [] },
  );
  await expect(previewPurchaseProposalDocument(sb, "actor", CONTRACT, DOC)).rejects.toThrow(
    "sem permissão",
  );
  expect(mocks.adminUpload).toHaveBeenCalledTimes(1);
  expect(mocks.remove).toHaveBeenCalledTimes(1);
  expect(mocks.signed).not.toHaveBeenCalled();
});
it("save uses canonical purchase parties and compiled design instead of caller design", async () => {
  const before = context();
  before.documents = [];
  mocks.rpc.mockImplementation(async (_sb: unknown, name: string) =>
    name === "purchase_proposal_context" ? before : document,
  );
  await savePurchaseProposal(sb, {
    contractId: CONTRACT,
    templateId: "template",
    expectedVersion: 0,
    expectedContractHash: HASH,
    data,
  });
  const call = mocks.rpc.mock.calls.find((row) => row[1] === "purchase_proposal_save");
  expect(call).toBeDefined();
  expect(JSON.stringify(call?.[2])).toContain("Prestadora");
  expect(call?.[2].p_data).toEqual(data);
  expect(JSON.stringify(call?.[2])).not.toContain("saleTotal");
  expect(fetchMock).not.toHaveBeenCalled();
});
