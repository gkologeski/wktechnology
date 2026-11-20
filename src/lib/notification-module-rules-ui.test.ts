// @vitest-environment jsdom
import { act, createElement, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const WS = "aaaaaaaa-1111-4111-8111-111111111111";
const state = vi.hoisted(() => ({
  workspace: "aaaaaaaa-1111-4111-8111-111111111111" as string | null,
  loading: false,
  error: false,
  view: true,
  manage: true,
  calls: {} as Record<string, ReturnType<typeof vi.fn<(input: unknown) => Promise<unknown>>>>,
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    workspaceId: state.workspace,
    isLoading: state.loading,
    isError: state.error,
    can: (key: string) => (key.includes(".view.") ? state.view : state.manage),
    canAny: (keys: string[]) =>
      keys.some((key) => (key.includes(".view.") ? state.view : state.manage)),
  }),
}));
vi.mock("@/lib/access-control/use-sales-capabilities", () => ({
  useSalesCapabilities: () => ({
    for: () => ({ can_update: state.manage, can_manage: state.manage, can_delete: state.manage }),
  }),
}));
vi.mock("@/lib/view-as-client", () => ({ readViewAs: () => null }));
vi.mock("@/components/ui/confirm-dialog", () => ({
  confirmDialog: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/notification-delivery.functions", () => ({
  listNotificationWorkflowRules: (input: unknown) => state.calls.list(input),
  previewNotificationWorkflow: (input: unknown) => state.calls.preview(input),
}));
vi.mock("@/lib/workflows.functions", () => ({
  saveWorkflow: (input: unknown) => state.calls.save(input),
  publishWorkflow: (input: unknown) => state.calls.publish(input),
  discardDraft: (input: unknown) => state.calls.discard(input),
  deleteWorkflow: (input: unknown) => state.calls.remove(input),
}));
vi.mock("@/components/workflows/workflow-builder", () => ({
  WorkflowBuilder: ({
    draft,
    onSave,
  }: {
    draft: unknown;
    onSave: (value: unknown) => Promise<void>;
  }) =>
    createElement(
      "div",
      { "aria-label": "Existing workflow builder" },
      createElement("pre", null, JSON.stringify(draft)),
      createElement(
        "button",
        {
          onClick: () => {
            void onSave(draft).catch(() => undefined);
          },
        },
        "Save fixture draft",
      ),
    ),
}));
vi.mock("@/components/workflows/builder/conditions-editor", () => ({
  ConditionListEditor: () => createElement("p", null, "Existing conditions"),
  conditionsIncludeField: () => false,
}));
import { NotificationRulesPanel } from "@/components/notifications/notification-rules-panel";
import { TriggerConfigPanel } from "@/components/workflows/builder/trigger-config-panel";
import {
  WORKFLOW_NOTIFICATION_EVENTS,
  workflowNotificationEventTrigger,
} from "./workflows/notification-events";
import type { WorkflowEntity, WorkflowTrigger } from "./workflows/types";

let host: HTMLDivElement, root: Root, client: QueryClient;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  state.workspace = WS;
  state.loading = false;
  state.error = false;
  state.view = true;
  state.manage = true;
  state.calls = Object.fromEntries(
    ["list", "preview", "save", "publish", "discard", "remove"].map((name) => [
      name,
      vi.fn().mockResolvedValue(name === "list" ? { items: [], truncated: false } : { id: WS }),
    ]),
  );
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  host.remove();
  vi.clearAllMocks();
});
async function render(node: ReactNode) {
  await act(async () => root.render(createElement(QueryClientProvider, { client }, node)));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 15));
  });
}
async function click(label: string) {
  await act(async () =>
    [...host.querySelectorAll("button")].find((button) => button.textContent === label)!.click(),
  );
}
async function select(label: string, value: string) {
  await act(async () => {
    const select = host.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
const panel = (userId = "user") =>
  createElement(NotificationRulesPanel, { workspaceId: WS, userId });
const draft = () => JSON.parse(host.querySelector("pre")!.textContent!);

it.each(WORKFLOW_NOTIFICATION_EVENTS)(
  "opens a disabled $key draft in the existing builder without saving publishing or sending",
  async (definition) => {
    await render(panel());
    await select("Evento da nova regra", definition.key);
    await click("Criar regra");
    const value = draft();
    expect(value.entity).toBe(definition.entity);
    expect(value.enabled).toBe(false);
    expect(value.trigger.notification_event).toEqual({
      key: definition.key,
      ...(definition.deadline ? { days_before: 30 } : {}),
    });
    expect(value.actions).toEqual([
      {
        type: "send_notification",
        title: "Atualização no TechERP",
        recipients: [
          {
            kind:
              definition.key === "people.approval.pending"
                ? "pending_approvers"
                : "source_responsible",
          },
        ],
      },
    ]);
    expect(state.calls.save).not.toHaveBeenCalled();
    expect(state.calls.publish).not.toHaveBeenCalled();
    expect(state.calls.preview).not.toHaveBeenCalled();
  },
);
it("groups only supported events and preserves generic workflow creation", async () => {
  await render(panel());
  const select = host.querySelector<HTMLSelectElement>('[aria-label="Evento da nova regra"]')!;
  expect([...select.querySelectorAll("optgroup")].map((group) => group.label)).toEqual([
    "TechSales",
    "TechContracts",
    "TechProjects",
    "TechHire",
    "TechPeople",
  ]);
  expect([...select.options].map((option) => option.value)).not.toContain("finance.payable.due");
  await click("Criar regra");
  expect(draft().trigger.notification_event).toBeUndefined();
  expect(draft().entity).toBe("leads");
});
it("does not query or expose creation controls before the workspace context is confirmed", async () => {
  state.workspace = null;
  await render(panel());
  expect(state.calls.list).not.toHaveBeenCalled();
  expect(host.querySelector("select")).toBeNull();
});
it("keeps creation unavailable without workflow-management capabilities", async () => {
  state.manage = false;
  await render(panel());
  expect(host.querySelector('[aria-label="Evento da nova regra"]')).toBeNull();
  expect(state.calls.save).not.toHaveBeenCalled();
});
it("discards another identity's selected recipe and unsaved draft even at the same revision", async () => {
  await render(panel("first"));
  await select("Evento da nova regra", "contracts.contract.expiring");
  await click("Criar regra");
  expect(draft().trigger.notification_event.key).toBe("contracts.contract.expiring");
  await render(panel("second"));
  expect(host.querySelector("pre")).toBeNull();
  expect(host.querySelector<HTMLSelectElement>('[aria-label="Evento da nova regra"]')!.value).toBe(
    "",
  );
  expect(state.calls.save).not.toHaveBeenCalled();
});
it("hides a cached rule and its open draft after permission revocation", async () => {
  await render(panel());
  await select("Evento da nova regra", "crm.deal.won");
  await click("Criar regra");
  state.view = false;
  await render(panel());
  expect(host.querySelector("pre")).toBeNull();
  expect(host.querySelector("select")).toBeNull();
});
it("requires a fresh authorized read before offering rule creation from a cached visit", async () => {
  client.setQueryData(["notification-rules", "user", WS], { items: [], truncated: false });
  let finish!: (value: unknown) => void;
  state.calls.list.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await render(panel());
  expect(
    [...host.querySelectorAll("button")].find((button) => button.textContent === "Criar regra")!
      .disabled,
  ).toBe(true);
  await act(async () => finish({ items: [], truncated: false }));
});
it("does not carry a pending save confirmation or builder into another user context", async () => {
  let finish!: (value: unknown) => void;
  state.calls.save.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await render(panel("first"));
  await select("Evento da nova regra", "crm.deal.won");
  await click("Criar regra");
  await click("Save fixture draft");
  expect(state.calls.save).toHaveBeenCalledTimes(1);
  await render(panel("second"));
  await act(async () => finish({ id: WS }));
  expect(host.querySelector("pre")).toBeNull();
  expect(host.textContent).not.toContain("Rascunho salvo");
  expect(state.calls.publish).not.toHaveBeenCalled();
});

let current: WorkflowTrigger;
function TriggerEditor({
  initial,
  entity = "contracts",
}: {
  initial: WorkflowTrigger;
  entity?: WorkflowEntity;
}) {
  const [value, setValue] = useState(initial);
  current = value;
  return createElement(TriggerConfigPanel, {
    entity,
    trigger: value,
    fields: [],
    onEntityClick: vi.fn(),
    onChange: setValue,
  });
}
it("edits deadline antecedence explicitly while explaining renewal and hiding generic elapsed-time controls", async () => {
  await render(
    createElement(TriggerEditor, {
      initial: workflowNotificationEventTrigger("contracts.contract.renewal_due"),
    }),
  );
  const input = host.querySelector<HTMLInputElement>(
    '[aria-label="Antecedência do aviso em dias"]',
  )!;
  expect(input.min).toBe("1");
  expect(input.max).toBe("365");
  expect(input.value).toBe("30");
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "14");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(current.notification_event?.days_before).toBe(14);
  expect(host.textContent).toContain("fim da vigência menos o aviso prévio cadastrado");
  expect(host.textContent).toContain("não renova o contrato");
  expect(host.textContent).not.toContain("Gatilho baseado em tempo");
});
it("offers only entity-compatible canonical events and removes named selection when returning to generic", async () => {
  await render(
    createElement(TriggerEditor, {
      initial: workflowNotificationEventTrigger("crm.proposal.accepted"),
      entity: "proposals",
    }),
  );
  const options = [
    ...host.querySelector<HTMLSelectElement>('[aria-label="Evento de negócio do Workflow"]')!
      .options,
  ].map((option) => option.value);
  expect(options).toEqual(["", "crm.proposal.accepted"]);
  await select("Evento de negócio do Workflow", "");
  expect(current.notification_event).toBeUndefined();
  expect(host.textContent).toContain("Gatilho baseado em tempo");
});
it.each(WORKFLOW_NOTIFICATION_EVENTS.filter((definition) => definition.moduleKey === "projects"))(
  "shows the precise $key schedule without offering generic or incompatible controls",
  async (definition) => {
    await render(
      createElement(TriggerEditor, {
        entity: definition.entity,
        initial: workflowNotificationEventTrigger(definition.key),
      }),
    );
    const options = [
      ...host.querySelector<HTMLSelectElement>('[aria-label="Evento de negócio do Workflow"]')!
        .options,
    ].map((option) => option.value);
    expect(options).toEqual([
      "",
      ...WORKFLOW_NOTIFICATION_EVENTS.filter((event) => event.entity === definition.entity).map(
        (event) => event.key,
      ),
    ]);
    expect(host.textContent).not.toContain("Gatilho baseado em tempo");
    expect(Boolean(host.querySelector('[aria-label="Antecedência do aviso em dias"]'))).toBe(
      definition.key === "projects.milestone.due",
    );
    if (definition.scheduling === "overdue") {
      expect(host.textContent).toContain("dia seguinte ao prazo");
      expect(host.textContent).toContain("Não há antecedência nem lembrete diário");
      expect(host.textContent).toContain("antes da publicação não entram");
    }
    if (definition.key === "projects.project.started") {
      expect(host.textContent).toContain("Planejamento para Ativo");
      expect(host.textContent).toContain("importar um projeto já ativo");
    }
    if (definition.key === "projects.milestone.due") {
      expect(
        host.querySelector<HTMLInputElement>('[aria-label="Antecedência do aviso em dias"]')!.value,
      ).toBe("30");
      expect(host.textContent).toContain("prazo é a data do marco");
      expect(host.textContent).toContain("não conclui o marco nem gera cobrança");
      expect(host.textContent).not.toContain("término da vigência");
    }
  },
);
it("replaces an elapsed-time trigger with a named event while preserving explicit conditions", async () => {
  await render(
    createElement(TriggerEditor, {
      entity: "contracts",
      initial: {
        event: "updated",
        filters: [{ field: "status", op: "eq", value: "active" }],
        time_based: { kind: "time_since_field", field: "created_at", amount: 1, unit: "days" },
      },
    }),
  );
  await select("Evento de negócio do Workflow", "contracts.contract.expiring");
  expect(current.time_based).toBeUndefined();
  expect(current.filters).toEqual([{ field: "status", op: "eq", value: "active" }]);
  expect(current.notification_event).toEqual({
    key: "contracts.contract.expiring",
    days_before: 30,
  });
});

it.each(
  WORKFLOW_NOTIFICATION_EVENTS.filter(
    (definition) => definition.moduleKey === "ats" || definition.moduleKey === "people",
  ),
)("shows the exact $key scope and only document antecedence", async (definition) => {
  await render(
    createElement(TriggerEditor, {
      entity: definition.entity,
      initial: workflowNotificationEventTrigger(definition.key),
    }),
  );
  expect(host.textContent).toContain(definition.label);
  expect(host.textContent).not.toContain("Gatilho baseado em tempo");
  const antecedence = host.querySelector<HTMLInputElement>(
    '[aria-label="Antecedência do aviso em dias"]',
  );
  expect(Boolean(antecedence)).toBe(definition.key === "people.document.expiring");
  if (antecedence) {
    expect(antecedence.value).toBe("30");
    expect(antecedence.min).toBe("1");
    expect(antecedence.max).toBe("365");
    expect(host.textContent).toContain("validade do documento");
  }
  if (
    ["ats_offers", "people_documents", "hiring_preparation_requests"].includes(definition.entity)
  ) {
    expect(host.textContent).toContain("somente leitura");
    const generic = host.querySelector<HTMLSelectElement>(
      '[aria-label="Evento de negócio do Workflow"]',
    )!.options[0];
    expect(generic.disabled).toBe(true);
    await select("Evento de negócio do Workflow", "");
    expect(current.notification_event?.key).toBe(definition.key);
  }
  if (definition.key === "people.approval.pending")
    expect(host.textContent).toContain("aviso existente no aplicativo");
});
