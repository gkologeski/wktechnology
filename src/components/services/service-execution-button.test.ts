// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ complete: vi.fn(), allowed: true, readonly: false }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (f: unknown) => f }));
vi.mock("@/lib/services.functions", () => ({ completeServiceExecution: m.complete }));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    isLoading: false,
    isError: false,
    can: () => m.allowed,
  }),
}));
vi.mock("@/lib/view-as-client", () => ({ readViewAs: () => ({ readOnly: m.readonly }) }));
vi.mock("@/components/iso-date-picker", () => ({
  IsoDatePicker: ({ value, onChange }: { value: string; onChange: (value: string) => void }) =>
    createElement(
      "button",
      { type: "button", onClick: () => onChange("2026-11-26") },
      value || "Escolher data real",
    ),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { ServiceExecutionButton } from "./service-execution-button";
let host: HTMLDivElement, root: Root, qc: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  m.allowed = true;
  m.readonly = false;
  m.complete.mockResolvedValue({
    service: { status: "completed", billing_hold: "awaiting_signature" },
  });
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
async function render(status = "active", canUpdate = true) {
  await act(async () =>
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(ServiceExecutionButton, {
          serviceId: "s",
          contractId: "c",
          status,
          canUpdate,
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
async function setReason(value: string) {
  const node = document.getElementById("service-completion-reason") as HTMLTextAreaElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
it("requires execution permission and record update before offering completion", async () => {
  m.allowed = false;
  await render();
  expect(button("Concluir execução")).toBeUndefined();
  m.allowed = true;
  await render("active", false);
  expect(button("Concluir execução")).toBeUndefined();
  m.readonly = true;
  await render();
  expect(button("Concluir execução")).toBeUndefined();
});
it("does not allow completion before activation or after already completing", async () => {
  await render("pending");
  expect(button("Concluir execução")).toBeUndefined();
  await render("completed");
  expect(button("Concluir execução")).toBeUndefined();
});
it("requires an explicitly chosen delivery date and reason without a finance or signature payload", async () => {
  await render();
  await click("Concluir execução");
  expect(button("Confirmar conclusão da execução")?.disabled).toBe(true);
  await setReason("As horas contratadas foram executadas e entregues.");
  expect(button("Confirmar conclusão da execução")?.disabled).toBe(true);
  await click("Escolher data real");
  await click("Confirmar conclusão da execução");
  expect(m.complete).toHaveBeenCalledWith({
    data: {
      id: "s",
      completedAt: "2026-11-26",
      reason: "As horas contratadas foram executadas e entregues.",
    },
  });
});
it("preserves the date and evidence after a denied or stale completion attempt", async () => {
  m.complete.mockRejectedValueOnce(new Error("Permissão revogada antes da confirmação."));
  await render();
  await click("Concluir execução");
  await click("Escolher data real");
  await setReason("Entrega técnica confirmada no atendimento.");
  await click("Confirmar conclusão da execução");
  expect(
    (document.getElementById("service-completion-reason") as HTMLTextAreaElement).value,
  ).toContain("Entrega técnica");
  expect(button("2026-11-26")).toBeTruthy();
  expect(button("Confirmar conclusão da execução")?.disabled).toBe(false);
});
