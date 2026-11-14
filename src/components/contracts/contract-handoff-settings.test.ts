// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { it, expect, vi, beforeEach, afterEach } from "vitest";
const m = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn(), allowed: true, readonly: false }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (f: unknown) => f }));
vi.mock("@/lib/contracts/handoffs.functions", () => ({
  getContractHandoffSettings: m.get,
  saveContractHandoffSettings: m.save,
}));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({ workspaceId: "w", can: () => m.allowed }),
}));
vi.mock("@/lib/view-as-client", () => ({ readViewAs: () => ({ readOnly: m.readonly }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { ContractHandoffSettingsPanel } from "./contract-handoff-settings";
let host: HTMLDivElement, root: Root, q: QueryClient;
const settings = {
  enabled: true,
  legal_user_id: "u",
  finance_user_id: "u",
  signature_user_id: "u",
  operator_user_id: "u",
  escalation_user_id: "u",
  legal_days: 1,
  finance_days: 2,
  signature_days: 1,
  timezone: "America/Sao_Paulo",
};
beforeEach(() => {
  vi.clearAllMocks();
  m.allowed = true;
  m.readonly = false;
  m.get.mockResolvedValue({
    settings,
    members: [
      {
        id: "u",
        name: "Pessoa autorizada",
        legal: true,
        finance: true,
        signature: true,
        operator: true,
      },
    ],
  });
  m.save.mockResolvedValue({ ok: true });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  q = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  await act(async () => root.unmount());
  q.clear();
  host.remove();
});
async function render() {
  await act(async () =>
    root.render(
      createElement(
        QueryClientProvider,
        { client: q },
        createElement(ContractHandoffSettingsPanel),
      ),
    ),
  );
  await act(async () => {
    await new Promise((r) => setTimeout(r, 40));
  });
}
it("does not fetch or render configuration without manage permission", async () => {
  m.allowed = false;
  await render();
  expect(m.get).not.toHaveBeenCalled();
  expect(host.textContent).toBe("");
});
it("shows the persisted responsible and working-day settings", async () => {
  await render();
  expect(host.textContent).toContain("Pessoa autorizada");
  expect(host.querySelector<HTMLInputElement>("#sla-finance_days")?.value).toBe("2");
  expect(m.save).not.toHaveBeenCalled();
});
it("saves only explicit validated settings without a client workspace selector", async () => {
  await render();
  const b = [...host.querySelectorAll("button")].find(
    (b) => b.textContent === "Salvar encaminhamentos",
  )!;
  await act(async () => b.click());
  expect(m.save).toHaveBeenCalledWith({ data: settings });
});
it("readonly configuration cannot be saved even by a manager", async () => {
  m.readonly = true;
  await render();
  const b = [...host.querySelectorAll("button")].find(
    (b) => b.textContent === "Salvar encaminhamentos",
  )!;
  expect(b.disabled).toBe(true);
  expect(m.save).not.toHaveBeenCalled();
});
