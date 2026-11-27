// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  list: vi.fn(),
  events: vi.fn(),
  start: vi.fn(),
  reset: vi.fn(),
  decide: vi.fn(),
  context: vi.fn(),
  assume: vi.fn(),
  keys: new Set<string>(),
  readonly: false,
  parentUpdate: true,
  parentView: true,
  workspaceId: "w",
  me: "operator",
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (f: unknown) => f }));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    workspaceId: m.workspaceId,
    isLoading: false,
    isError: false,
    permissions: m.keys,
    can: (key: string) => m.keys.has(key),
    canAny: (keys: string[]) => keys.some((key) => m.keys.has(key)),
  }),
}));
vi.mock("@/lib/access-control/use-work-capabilities", () => ({
  useWorkCapabilities: () => ({
    for: () => ({ can_update: m.parentUpdate, can_view: m.parentView }),
  }),
}));
vi.mock("@/hooks/use-current-user-id", () => ({ useCurrentUserId: () => m.me }));
vi.mock("@/hooks/use-workspace-members", () => ({
  useWorkspaceMembers: () => ({
    nameFor: (id: string | null) =>
      id === "original"
        ? "Aprovadora original de teste"
        : id === "operator"
          ? "Operador de teste"
          : "Sem responsável",
  }),
}));
vi.mock("@/lib/view-as-client", () => ({ readViewAs: () => ({ readOnly: m.readonly }) }));
vi.mock("@/lib/contract-approvals.functions", () => ({
  listContractApprovals: m.list,
  listContractEvents: m.events,
  startContractApprovals: m.start,
  resetContractApprovals: m.reset,
  decideContractApproval: m.decide,
}));
vi.mock("@/lib/contracts/approval-substitution.functions", () => ({
  getContractApprovalSubstitutionContext: m.context,
  assumeContractApproval: m.assume,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/ui/confirm-dialog", () => ({ confirmDialog: vi.fn() }));
import { ContractApprovalsPanel } from "./contract-approvals-panel";
let host: HTMLDivElement, root: Root, qc: QueryClient;
const approval = (patch = {}) => ({
  id: "approval",
  contract_id: "contract",
  stage: "legal",
  status: "pending",
  approver_id: "original",
  decided_at: null,
  decided_by: null,
  comment: null,
  ...patch,
});
const context = (patch = {}) => ({
  canAssume: true,
  approvals: [
    {
      id: "approval",
      stage: "legal",
      status: "pending",
      approverId: "original",
      approverName: "Aprovadora original de teste",
      canAssume: true,
      currentActorIsApprover: false,
      orderBlockedReason: null,
      ...patch,
    },
  ],
});
beforeEach(() => {
  vi.clearAllMocks();
  m.keys = new Set([
    "techcontracts.approvals.view.workspace",
    "techcontracts.approvals.manage.workspace",
    "techcontracts.approvals.approve.workspace",
    "techcontracts.approval_substitution.manage.workspace",
    "techcontracts.audit.view.workspace",
  ]);
  m.readonly = false;
  m.parentUpdate = true;
  m.parentView = true;
  m.workspaceId = "w";
  m.me = "operator";
  m.list.mockResolvedValue([approval()]);
  m.events.mockResolvedValue([]);
  m.context.mockResolvedValue(context());
  m.assume.mockResolvedValue(
    context({ approverId: "operator", currentActorIsApprover: true, canAssume: false }),
  );
  m.decide.mockResolvedValue({ status: "approved", contractStatus: "in_review" });
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
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}
async function render() {
  await act(async () =>
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(ContractApprovalsPanel, { contractId: "contract" }),
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
async function reason(value: string) {
  const node = document.getElementById(
    "approval-assumption-reason-approval",
  ) as HTMLTextAreaElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
it("requires the dedicated substitution key, existing approval keys and update access", async () => {
  m.keys.delete("techcontracts.approval_substitution.manage.workspace");
  await render();
  expect(button("Assumir aprovação")).toBeUndefined();
  expect(m.context).not.toHaveBeenCalled();
  m.keys.add("techcontracts.approval_substitution.manage.workspace");
  m.parentUpdate = false;
  await render();
  expect(button("Assumir aprovação")).toBeUndefined();
  expect(m.context).not.toHaveBeenCalled();
});
it("does not offer substitution in a readonly session or when the server denies eligibility", async () => {
  m.readonly = true;
  await render();
  expect(button("Assumir aprovação")).toBeUndefined();
  m.readonly = false;
  m.context.mockResolvedValue({ canAssume: false, approvals: [] });
  await render();
  expect(button("Assumir aprovação")).toBeUndefined();
});
it("requires a reason, names the original assignee and never approves automatically", async () => {
  await render();
  expect(button("Aprovar")?.disabled).toBe(true);
  await click("Assumir aprovação");
  expect(document.body.textContent).toContain("Responsável atual: Aprovadora original de teste");
  expect(document.body.textContent).toContain("A decisão ficará registrada no seu nome");
  expect(button("Confirmar que vou assumir")?.disabled).toBe(true);
  await reason("Substituição autorizada pelo responsável pelo contrato.");
  m.list.mockResolvedValue([approval({ approver_id: "operator" })]);
  m.context.mockResolvedValue(
    context({ approverId: "operator", currentActorIsApprover: true, canAssume: false }),
  );
  await click("Confirmar que vou assumir");
  expect(m.assume).toHaveBeenCalledWith({
    data: {
      contractId: "contract",
      approvalId: "approval",
      expectedApproverId: "original",
      reason: "Substituição autorizada pelo responsável pelo contrato.",
    },
  });
  expect(m.decide).not.toHaveBeenCalled();
  expect(button("Aprovar")?.disabled).toBe(false);
  await click("Aprovar");
  expect(m.decide).toHaveBeenCalledWith({
    data: { approvalId: "approval", decision: "approved", comment: undefined },
  });
});
it("preserves the reason after an assignment race or permission rejection", async () => {
  m.assume.mockRejectedValueOnce(new Error("A atribuição mudou antes da confirmação."));
  await render();
  await click("Assumir aprovação");
  await reason("Substituição de responsabilidade solicitada e conferida.");
  await click("Confirmar que vou assumir");
  expect(
    (document.getElementById("approval-assumption-reason-approval") as HTMLTextAreaElement).value,
  ).toContain("solicitada e conferida");
  expect(m.decide).not.toHaveBeenCalled();
  expect(button("Aprovar")?.disabled).toBe(true);
});
it("keeps the canonical stage order after taking responsibility for a later stage", async () => {
  m.list.mockResolvedValue([
    approval({ id: "earlier", stage: "legal" }),
    approval({ id: "approval", stage: "finance", approver_id: "operator" }),
  ]);
  m.context.mockResolvedValue(
    context({
      stage: "finance",
      approverId: "operator",
      currentActorIsApprover: true,
      canAssume: false,
      orderBlockedReason: "Conclua a etapa jurídica anterior.",
    }),
  );
  await render();
  expect(host.textContent).toContain("Conclua a etapa jurídica anterior");
  expect(
    Array.from(host.querySelectorAll("button"))
      .filter((b) => b.textContent?.trim() === "Aprovar")
      .every((b) => b.disabled),
  ).toBe(true);
  expect(m.decide).not.toHaveBeenCalled();
});

it("hides cached approvals and substitution audit immediately when read permission is removed", async () => {
  m.events.mockResolvedValue([
    {
      id: "event",
      event_type: "approval_substituted",
      created_at: "2026-11-26T12:00:00Z",
      actor_id: "operator",
      payload: {
        previous_approver_id: "original",
        acting_approver_id: "operator",
        reason: "Comprovação reservada da substituição.",
      },
    },
  ]);
  await render();
  expect(host.textContent).toContain("Aprovadora original de teste");
  expect(host.textContent).toContain("Comprovação reservada da substituição");
  m.list.mockClear();
  m.events.mockClear();
  m.context.mockClear();
  m.keys.delete("techcontracts.approvals.view.workspace");
  m.keys.delete("techcontracts.audit.view.workspace");
  await render();
  expect(host.textContent).not.toContain("Aprovadora original de teste");
  expect(host.textContent).not.toContain("Comprovação reservada da substituição");
  expect(m.list).not.toHaveBeenCalled();
  expect(m.events).not.toHaveBeenCalled();
  expect(m.context).not.toHaveBeenCalled();
});

it("isolates cached snapshots by workspace and hides same-key data when parent access is revoked", async () => {
  await render();
  expect(host.textContent).toContain("Aprovadora original de teste");
  m.list.mockClear();
  m.events.mockClear();
  m.context.mockClear();
  m.parentView = false;
  await render();
  expect(host.textContent).not.toContain("Aprovadora original de teste");
  expect(m.list).not.toHaveBeenCalled();
  expect(m.events).not.toHaveBeenCalled();
  m.parentView = true;
  m.workspaceId = "another-workspace";
  m.list.mockImplementation(() => new Promise(() => {}));
  m.events.mockImplementation(() => new Promise(() => {}));
  await render();
  expect(host.textContent).not.toContain("Aprovadora original de teste");
  expect(m.list).toHaveBeenCalledOnce();
});
