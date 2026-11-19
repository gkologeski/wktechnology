// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({ get: vi.fn(), act: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (f: unknown) => f }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({ workspaceId: "w" }),
}));
vi.mock("@/lib/access-control/use-shared-action", () => ({ useSharedAction: () => true }));
vi.mock("./formalization.functions", () => ({ getFormalization: m.get, actFormalization: m.act }));
import { FormalizationPanel } from "./formalization-panel";
import type { PreparationRow } from "./types";
let host: HTMLDivElement, root: Root, qc: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
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
});
async function render(notes: unknown[], status = "signed") {
  m.get.mockResolvedValue({
    notes,
    status,
    cycle: 2,
    contract_id: null,
    draft_id: null,
    can_prepare: false,
    can_submit: false,
    can_legal: false,
    can_finance: false,
    can_link: false,
  });
  const row = { id: "r", revision: 2 } as PreparationRow;
  await act(async () =>
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(FormalizationPanel, { kind: "professional", row, dirty: false, busy: false }),
      ),
    ),
  );
  await act(async () => {
    await new Promise((r) => setTimeout(r, 40));
  });
}
it("authorized private notes are escaped and retain cycle actor stage date", async () => {
  await render([
    {
      id: "n",
      cycle: 2,
      stage: "legal",
      actor_label: "Jurídico nomeado",
      created_at: "2026-11-19T00:00:00Z",
      note: "<script>privado</script>",
      actor_kind: "internal",
    },
  ]);
  expect(host.querySelector("script")).toBeNull();
  expect(host.textContent).toContain("<script>privado</script>");
  expect(host.textContent).toContain("Ciclo 2");
  expect(host.textContent).toContain("Jurídico nomeado");
  expect(host.textContent).toContain("aguarda autorização de início");
  expect(m.act).not.toHaveBeenCalled();
});
it("empty restricted projection renders no private note area", async () => {
  await render([], "signature_pending");
  expect(host.querySelector('[aria-label="Trilha privada de conferência"]')).toBeNull();
  expect(host.textContent).toContain("Assinatura pendente");
  expect(m.act).not.toHaveBeenCalled();
});
