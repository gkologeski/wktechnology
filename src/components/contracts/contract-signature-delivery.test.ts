// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  load: vi.fn(),
  send: vi.fn(),
  view: true,
  sendAllowed: true,
  readonly: false,
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (f: unknown) => f }));
vi.mock("@/lib/esign.functions", () => ({ getEsignDocument: m.load }));
vi.mock("@/lib/contracts/signature-delivery.functions", () => ({
  sendContractSignatureRequest: m.send,
}));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    workspaceId: "w",
    isLoading: false,
    isError: false,
    canAny: () => m.view,
  }),
}));
vi.mock("@/lib/access-control/use-work-capabilities", () => ({
  useWorkCapabilities: () => ({ for: () => ({ can_send: m.sendAllowed }) }),
}));
vi.mock("@/lib/view-as-client", () => ({ readViewAs: () => ({ readOnly: m.readonly }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));
import { ContractSignatureDelivery } from "./contract-signature-delivery";
let host: HTMLDivElement, root: Root, qc: QueryClient;
const fixture = () => ({
  doc: { title: "Contrato", status: "draft", expires_at: null },
  signers: [
    {
      id: "s",
      name: "Pessoa de teste",
      email: "pessoa@example.test",
      status: "pending",
      public_token: null,
    },
  ],
  deliveries: [],
});
beforeEach(() => {
  vi.clearAllMocks();
  m.view = true;
  m.sendAllowed = true;
  m.readonly = false;
  m.load.mockResolvedValue(fixture());
  m.send.mockResolvedValue({ accepted: 1, suppressed: 0, failed: 0 });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  await act(async () => root.unmount());
  qc.clear();
  host.remove();
});
async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
}
async function render(current = true) {
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(ContractSignatureDelivery, {
          contractId: "c",
          documentId: "d",
          hash: "hash",
          current,
        }),
      ),
    );
  });
  await flush();
}
async function click(label: string) {
  const b = Array.from(document.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === label,
  );
  expect(b).toBeTruthy();
  await act(async () => b!.click());
  await flush();
}
it("requires explicit recipient confirmation before inviting contract signers", async () => {
  await render();
  await click("Enviar para assinatura por e-mail");
  expect(document.body.textContent).toContain("pessoa@example.test");
  expect(m.send).not.toHaveBeenCalled();
  await click("Confirmar envio dos convites");
  expect(m.send).toHaveBeenCalledWith({
    data: expect.objectContaining({
      contractId: "c",
      documentId: "d",
      requestId: expect.any(String),
    }),
  });
});
it("does not offer an invitation without send permission", async () => {
  m.sendAllowed = false;
  await render();
  expect(host.textContent).not.toContain("Enviar para assinatura por e-mail");
  expect(m.send).not.toHaveBeenCalled();
});
it("does not offer an invitation in read-only mode", async () => {
  m.readonly = true;
  await render();
  expect(host.textContent).not.toContain("Enviar para assinatura por e-mail");
});
it("does not offer an invitation for revoked or previous-version evidence", async () => {
  await render(false);
  expect(host.textContent).toContain("foi revogada");
  expect(host.textContent).not.toContain("Enviar para assinatura por e-mail");
});
it("does not query signer details when read permission is absent", async () => {
  m.view = false;
  await render();
  expect(m.load).not.toHaveBeenCalled();
  expect(host.textContent).toContain("Solicite acesso");
});
it("does not offer resend once all signers have signed", async () => {
  const f = fixture();
  f.doc.status = "completed";
  f.signers[0].status = "signed";
  m.load.mockResolvedValue(f);
  await render();
  expect(host.textContent).toContain("Assinaturas concluídas");
  expect(host.textContent).not.toContain("Reenviar");
});
