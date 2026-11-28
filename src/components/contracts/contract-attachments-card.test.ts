// @vitest-environment jsdom
import { act, createElement, type PropsWithChildren } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  policy: vi.fn(),
  list: vi.fn(),
  sources: vi.fn(),
  link: vi.fn(),
  reserve: vi.fn(),
  finish: vi.fn(),
  remove: vi.fn(),
  download: vi.fn(),
  preview: vi.fn(),
  review: vi.fn(),
  upload: vi.fn(),
  confirm: vi.fn(),
  keys: new Set<string>(),
  readonly: false,
  canView: true,
  canUpdate: true,
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/contracts/attachments.functions", () => ({
  getContractAttachmentPolicy: m.policy,
  listContractAttachments: m.list,
  listContractAttachmentSources: m.sources,
  linkContractAttachment: m.link,
  reserveContractAttachment: m.reserve,
  finishContractAttachment: m.finish,
  removeContractAttachment: m.remove,
  downloadContractAttachment: m.download,
  previewContractSignaturePackage: m.preview,
  reviewContractAttachment: m.review,
  CONTRACT_ATTACHMENT_MAX_BYTES: 20 * 1024 * 1024,
  CONTRACT_ATTACHMENT_TYPES: ["application/pdf"],
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: "buyer" } }) }));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    workspaceId: "wk",
    permissions: m.keys,
    isLoading: false,
    isError: false,
    can: (key: string) => m.keys.has(key),
  }),
}));
vi.mock("@/lib/access-control/use-work-capabilities", () => ({
  useWorkCapabilities: () => ({ for: () => ({ can_view: m.canView, can_update: m.canUpdate }) }),
}));
vi.mock("@/lib/view-as-client", () => ({ readViewAs: () => ({ readOnly: m.readonly }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: () => ({ upload: m.upload }) } },
}));
vi.mock("@/components/ui/confirm-dialog", () => ({ confirmDialog: m.confirm }));
vi.mock("@/components/deals/quote-internal-preview", () => ({ QuoteInternalPreview: () => null }));
vi.mock("./purchase-proposal-wizard", () => ({
  PurchaseProposalWizard: () => createElement("p", null, "Assistente de compra aberto"),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
    disabled,
  }: PropsWithChildren<{
    value: string;
    onValueChange: (value: string) => void;
    disabled: boolean;
  }>) =>
    createElement(
      "select",
      {
        value,
        disabled,
        onChange: (event) => onValueChange((event.currentTarget as HTMLSelectElement).value),
      },
      children,
    ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: PropsWithChildren) => children,
  SelectItem: ({
    children,
    value,
    disabled,
  }: PropsWithChildren<{ value: string; disabled?: boolean }>) =>
    createElement("option", { value, disabled }, children),
}));
import { ContractAttachmentsCard } from "./contract-attachments-card";

const file = (patch = {}) => ({
  id: "file-1",
  kind: "file",
  source_id: null,
  name: "escopo.pdf",
  created_at: "2026-11-27",
  audience: "internal",
  commercial_sensitive: false,
  reviewed_by: null,
  reviewed_at: null,
  can_review: true,
  review_required: true,
  ...patch,
});
let host: HTMLDivElement, root: Root, qc: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  m.readonly = false;
  m.canView = true;
  m.canUpdate = true;
  m.keys = new Set([
    "techcontracts.purchase_proposals.view.workspace",
    "techcontracts.esign_share.manage.workspace",
  ]);
  m.policy.mockResolvedValue({
    hiring_origin: false,
    is_purchase: true,
    can_preview: true,
    can_review: true,
  });
  m.list.mockResolvedValue([file()]);
  m.sources.mockResolvedValue([]);
  m.confirm.mockResolvedValue(true);
  m.reserve.mockResolvedValue({ id: "new", path: "private/file.pdf" });
  m.upload.mockResolvedValue({ error: null });
  m.finish.mockResolvedValue({ ok: true });
  m.review.mockResolvedValue({ ok: true });
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
async function render() {
  await act(async () =>
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(ContractAttachmentsCard, { contractId: "purchase", canEdit: true }),
      ),
    ),
  );
  await flush();
}
const button = (label: string) =>
  Array.from(host.querySelectorAll("button")).find((node) => node.textContent?.trim() === label);
async function click(label: string) {
  expect(button(label)).toBeTruthy();
  await act(async () => button(label)!.click());
  await flush();
}

it("never fetches sales quote/proposal sources for a purchase and opens only its native wizard", async () => {
  await render();
  expect(m.sources).not.toHaveBeenCalled();
  expect(button("Vincular documento")).toBeUndefined();
  await click("Proposta técnica de compra");
  expect(host.textContent).toContain("Assistente de compra aberto");
  expect(m.link).not.toHaveBeenCalled();
});
it("does not offer the economic purchase wizard without its own view permission", async () => {
  m.keys.delete("techcontracts.purchase_proposals.view.workspace");
  await render();
  expect(button("Proposta técnica de compra")).toBeUndefined();
  expect(button("Enviar arquivo")).toBeUndefined();
  expect(host.textContent).not.toContain("Assistente de compra aberto");
  expect(m.sources).not.toHaveBeenCalled();
});
it("keeps the existing commercial source selector for a sales contract", async () => {
  m.policy.mockResolvedValue({
    hiring_origin: false,
    is_purchase: false,
    can_preview: true,
    can_review: true,
  });
  await render();
  expect(m.sources).toHaveBeenCalledWith({ data: { contractId: "purchase" } });
  expect(button("Vincular documento")).toBeTruthy();
  expect(button("Proposta técnica de compra")).toBeUndefined();
});
it("requires both sharing permission and server authorization to classify an attachment", async () => {
  m.keys.delete("techcontracts.esign_share.manage.workspace");
  await render();
  expect(button("Conferir público")).toBeUndefined();
  expect(m.review).not.toHaveBeenCalled();
  m.keys.add("techcontracts.esign_share.manage.workspace");
  m.policy.mockResolvedValue({
    hiring_origin: false,
    is_purchase: true,
    can_preview: true,
    can_review: false,
  });
  await qc.invalidateQueries({ queryKey: ["contract-attachment-policy"] });
  await render();
  expect(button("Conferir público")).toBeUndefined();
});
it("offers only the supplier audience for a purchase and explicitly confirms the review", async () => {
  await render();
  const select = host.querySelector("select")!;
  expect(Array.from(select.options).map((option) => option.value)).toEqual([
    "internal",
    "supplier",
    "technical_shared",
  ]);
  await act(async () => {
    select.value = "supplier";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await click("Conferir público");
  expect(m.confirm).toHaveBeenCalledWith(
    expect.objectContaining({ title: "Conferir público do anexo" }),
  );
  expect(m.review).toHaveBeenCalledWith({
    data: { contractId: "purchase", id: "file-1", audience: "supplier" },
  });
  expect(m.preview).not.toHaveBeenCalled();
});
it("does not mark a commercial document as technical or rewrite a frozen attachment", async () => {
  m.list.mockResolvedValue([file({ commercial_sensitive: true })]);
  await render();
  expect(host.querySelector('option[value="technical_shared"]')?.hasAttribute("disabled")).toBe(
    true,
  );
  m.list.mockResolvedValue([file({ frozen: true })]);
  await act(async () => {
    await qc.invalidateQueries({ queryKey: ["contract-attachments"] });
  });
  await flush();
  expect(button("Conferir público")).toBeUndefined();
  expect(m.review).not.toHaveBeenCalled();
});
it("keeps new uploads internal until a separate authorized audience review", async () => {
  await render();
  const input = host.querySelector('input[type="file"]')!;
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [new File(["%PDF-test"], "new.pdf", { type: "application/pdf" })],
  });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
  await flush();
  expect(m.reserve).toHaveBeenCalledWith({ data: { contractId: "purchase", name: "new.pdf" } });
  expect(m.finish).toHaveBeenCalledWith({ data: { contractId: "purchase", id: "new" } });
  expect(m.review).not.toHaveBeenCalled();
  expect(m.preview).not.toHaveBeenCalled();
});
it("preserves read-only access and does not mutate files after a declined audience confirmation", async () => {
  await render();
  m.confirm.mockResolvedValueOnce(false);
  await click("Conferir público");
  expect(m.review).not.toHaveBeenCalled();
  m.readonly = true;
  await render();
  expect(button("Enviar arquivo")).toBeUndefined();
  expect(button("Conferir público")).toBeUndefined();
});
it("does not offer audience rewriting for the immutable native purchase proposal", async () => {
  m.list.mockResolvedValue([
    file({
      audience: "supplier",
      commercial_sensitive: true,
      can_review: false,
      review_required: false,
      reviewed_by: "buyer",
      reviewed_at: "2026-11-27",
    }),
  ]);
  await render();
  expect(host.textContent).toContain("Destinado à prestadora");
  expect(button("Conferir público")).toBeUndefined();
  expect(m.review).not.toHaveBeenCalled();
});
