// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  list: vi.fn(),
  preview: vi.fn(),
  error: vi.fn(),
  view: true,
  update: true,
  manage: true,
  readonly: false,
  user: "u",
  workspace: "w",
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (f: unknown) => f }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: m.user } }) }));
vi.mock("@/lib/contracts/attachments.functions", () => ({
  listContractAttachments: m.list,
  previewContractSignaturePackage: m.preview,
}));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    workspaceId: m.workspace,
    permissions: new Set(["view"]),
    can: () => m.manage,
  }),
}));
vi.mock("@/lib/access-control/use-work-capabilities", () => ({
  useWorkCapabilities: () => ({ for: () => ({ can_view: m.view, can_update: m.update }) }),
}));
vi.mock("@/lib/view-as-client", () => ({ readViewAs: () => ({ readOnly: m.readonly }) }));
vi.mock("sonner", () => ({ toast: { error: m.error } }));
import { SignatureAttachmentsSummary } from "./signature-attachments-summary";
let host: HTMLDivElement, root: Root, qc: QueryClient;
const fixture = [
  {
    id: "a",
    kind: "file",
    name: "Anexo técnico.pdf",
    audience: "client",
    reviewed_by: "reviewer",
    reviewed_at: "2026-11-27",
    commercial_sensitive: false,
    signature_included: true,
    sharing_blocked: false,
  },
  {
    id: "b",
    kind: "proposal",
    name: "Proposta comercial",
    frozen: true,
    audience: "client",
    reviewed_by: null,
    reviewed_at: null,
    commercial_sensitive: false,
    signature_included: true,
    sharing_blocked: false,
  },
];
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(m, {
    view: true,
    update: true,
    manage: true,
    readonly: false,
    user: "u",
    workspace: "w",
  });
  m.list.mockResolvedValue(fixture);
  m.preview.mockResolvedValue({ url: "#preview" });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  await act(async () => root.unmount());
  qc.clear();
  host.remove();
  window.history.replaceState(null, "", "/");
});
async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
}
async function render(override?: boolean) {
  await act(async () =>
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(SignatureAttachmentsSummary, {
          contractId: "c",
          canPreviewOverride: override,
        }),
      ),
    ),
  );
  await flush();
}
async function click(text: string) {
  const b = [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);
  expect(b).toBeTruthy();
  await act(async () => b!.click());
  await flush();
}
it("shows file and frozen commercial attachments without generating a package on opening", async () => {
  await render();
  expect(host.textContent).toContain("2 anexo(s)");
  expect(host.textContent).toContain("Anexo técnico.pdf");
  expect(host.textContent).toContain("Proposta comercial");
  expect(host.textContent).toContain("Cópia congelada");
  expect(m.preview).not.toHaveBeenCalled();
  await click("Baixar prévia do contrato e anexos");
  expect(m.preview).toHaveBeenCalledWith({ data: { contractId: "c" } });
  expect(window.location.hash).toBe("#preview");
});
it("does not read or expose cached attachments without current contract access", async () => {
  m.view = false;
  qc.setQueryData(["contract-attachments", "u", "w", ["view"], "c"], fixture);
  await render();
  expect(m.list).not.toHaveBeenCalled();
  expect(host.textContent).not.toContain("Anexo técnico.pdf");
  expect(host.querySelector("button")).toBeNull();
});
it.each(["update", "manage", "readonly"] as const)(
  "cannot generate a preview when %s forbids it",
  async (key) => {
    m[key] = key === "readonly";
    await render();
    expect(host.querySelector("button")?.disabled).toBe(true);
    expect(m.preview).not.toHaveBeenCalled();
  },
);
it("distinguishes a read failure from an empty list and supports retry", async () => {
  m.list.mockRejectedValueOnce(new Error("denied"));
  await render();
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
  expect(host.textContent).not.toContain("Nenhum anexo disponível no seu acesso");
  expect(m.preview).not.toHaveBeenCalled();
  await click("Tentar novamente");
  expect(host.textContent).toContain("Anexo técnico.pdf");
});
it("shows an empty list without offering a package preview", async () => {
  m.list.mockResolvedValue([]);
  await render();
  expect(host.textContent).toContain("Nenhum anexo disponível no seu acesso");
  expect(host.querySelector("button")).toBeNull();
});
it("keeps separate caches for users and workspaces", async () => {
  await render();
  m.user = "another-user";
  m.workspace = "another-workspace";
  m.list.mockResolvedValue([]);
  await render();
  expect(m.list).toHaveBeenCalledTimes(2);
  expect(host.textContent).not.toContain("Anexo técnico.pdf");
});
it("reports a failed preview without navigating or sending anything", async () => {
  m.preview.mockRejectedValue(new Error("Documento comercial indisponível"));
  await render();
  await click("Baixar prévia do contrato e anexos");
  expect(m.error).toHaveBeenCalledWith("Documento comercial indisponível");
  expect(window.location.hash).toBe("");
  expect(host.querySelector("button")?.disabled).toBe(false);
});

it("hiring preview is authorized independently from finance or signature management", async () => {
  m.update = false;
  m.manage = false;
  await render(true);
  await click("Baixar prévia do contrato e anexos");
  expect(m.preview).toHaveBeenCalledWith({ data: { contractId: "c" } });
});
it("hiring preview explicit denial and read only cannot be overridden", async () => {
  await render(false);
  expect(host.querySelector("button")?.disabled).toBe(true);
  m.readonly = true;
  await render(true);
  expect(host.querySelector("button")?.disabled).toBe(true);
  expect(m.preview).not.toHaveBeenCalled();
});
it("preserves reviewed internal files on the record without counting them in the signature", async () => {
  m.list.mockResolvedValue([
    ...fixture,
    {
      ...fixture[0],
      id: "internal",
      name: "Notas internas.pdf",
      audience: "internal",
      signature_included: false,
    },
  ]);
  await render();
  expect(host.textContent).toContain("2 anexo(s) externo(s)");
  expect(host.textContent).toContain("Somente interno · não acompanha a assinatura");
  expect(
    host.querySelector('[aria-label="Anexos que acompanham o contrato"]')?.textContent,
  ).not.toContain("Notas internas.pdf");
  expect(
    host.querySelector('[aria-label="Arquivos internos preservados na ficha"]')?.textContent,
  ).toContain("Notas internas.pdf");
  await click("Baixar prévia do contrato e anexos");
  expect(m.preview).toHaveBeenCalledOnce();
});
it("blocks preparation for an unclassified upload instead of silently omitting it", async () => {
  m.list.mockResolvedValue([
    {
      ...fixture[0],
      audience: "internal",
      reviewed_by: null,
      reviewed_at: null,
      signature_included: false,
      sharing_blocked: true,
    },
  ]);
  await render();
  expect(host.textContent).toContain("Revise o público dos anexos antes do envio");
  expect(host.querySelector("button")?.disabled).toBe(true);
  expect(m.preview).not.toHaveBeenCalled();
});
it("does not label a client sales proposal as included in a supplier purchase package", async () => {
  m.list.mockResolvedValue(
    fixture.map((row) => ({ ...row, signature_included: false, sharing_blocked: true })),
  );
  await render();
  expect(host.textContent).toContain("público pendente ou incompatível");
  expect(host.querySelector("button")?.disabled).toBe(true);
  expect(m.preview).not.toHaveBeenCalled();
});
it("includes the reviewed own supplier proposal but rejects sensitive technical-shared content", async () => {
  m.list.mockResolvedValue([{ ...fixture[0], audience: "supplier", commercial_sensitive: true }]);
  await render();
  expect(host.textContent).toContain("1 anexo(s) externo(s)");
  expect(host.querySelector("button")?.disabled).toBe(false);
  m.list.mockResolvedValue([
    {
      ...fixture[0],
      audience: "technical_shared",
      commercial_sensitive: true,
      signature_included: false,
      sharing_blocked: true,
    },
  ]);
  await act(async () => {
    await qc.invalidateQueries({ queryKey: ["contract-attachments"] });
  });
  await flush();
  expect(host.textContent).toContain("Revise o público");
  expect(host.querySelector("button")?.disabled).toBe(true);
});
it("does not let the governed hiring preview override bypass pending audience review", async () => {
  m.list.mockResolvedValue([
    {
      ...fixture[0],
      audience: "internal",
      reviewed_at: null,
      reviewed_by: null,
      signature_included: false,
      sharing_blocked: true,
    },
  ]);
  await render(true);
  expect(host.textContent).toContain("Revise o público");
  expect(host.querySelector("button")?.disabled).toBe(true);
  expect(m.preview).not.toHaveBeenCalled();
});
it("fails closed when audience classification metadata is absent", async () => {
  m.list.mockResolvedValue([
    { id: "unknown", kind: "file", name: "Arquivo sem classificação.pdf" },
  ]);
  await render();
  expect(host.textContent).toContain("Revise o público");
  expect(host.querySelector("button")?.disabled).toBe(true);
  expect(m.preview).not.toHaveBeenCalled();
});
