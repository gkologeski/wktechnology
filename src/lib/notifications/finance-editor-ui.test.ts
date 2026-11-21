// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@/components/workflows/builder/use-entity-field-options", () => ({
  useEntityFieldOptions: () =>
    [
      "id",
      "status",
      "due_date",
      "amount",
      "paid_amount",
      "notes",
      "metadata",
      "bank_account_id",
      "counterparty_company_id",
    ].map((name) => ({ name, label: name })),
}));
vi.mock("@/components/workflows/use-reference-labels", () => ({
  useReferenceLabels: () => new Proxy({}, { get: () => () => "Referência" }),
}));
vi.mock("@/components/workflows/token-input", () => ({
  WorkflowTokensProvider: ({ value, children }: { value: unknown; children: ReactNode }) =>
    createElement(
      "div",
      null,
      createElement("pre", { "aria-label": "Variáveis oferecidas" }, JSON.stringify(value)),
      children,
    ),
}));
vi.mock("@/components/workflows/builder/conditions-editor", () => ({
  ConditionListEditor: ({ fields }: { fields: { name: string }[] }) =>
    createElement(
      "pre",
      { "aria-label": "Campos oferecidos" },
      JSON.stringify(fields.map((field) => field.name)),
    ),
  conditionsIncludeField: () => false,
}));
vi.mock("@/components/ui/confirm-dialog", () => ({
  confirmDialog: vi.fn().mockResolvedValue(true),
}));
import { WorkflowBuilder, type WorkflowDraft } from "@/components/workflows/workflow-builder";
import { TriggerConfigPanel } from "@/components/workflows/builder/trigger-config-panel";
import { ActionLibraryPanel } from "@/components/workflows/builder/action-library-panel";
import {
  WORKFLOW_NOTIFICATION_EVENTS,
  workflowNotificationEventTrigger,
} from "@/lib/workflows/notification-events";
let root: Root, host: HTMLDivElement;
const save = vi.fn();
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
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  save.mockClear();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function render(node: ReactNode) {
  await act(async () => root.render(node));
}
const draft = (
  key: Parameters<typeof workflowNotificationEventTrigger>[0] | null,
): WorkflowDraft => ({
  name: "Aviso em revisão",
  entity: key === "finance.invoice.received" ? "hiring_fiscal_documents" : "financial_entries",
  enabled: false,
  trigger: key ? workflowNotificationEventTrigger(key) : { event: "updated", filters: [] },
  actions: [{ type: "send_notification", title: "Atualização no TechERP" }],
});
it("offers only minimal finance source variables and excludes financial associations", async () => {
  await render(
    createElement(WorkflowBuilder, {
      open: true,
      draft: draft("finance.payable.due"),
      onClose: vi.fn(),
      onSave: save,
    }),
  );
  const offered = document.querySelector('[aria-label="Variáveis oferecidas"]')?.textContent;
  expect(offered).toContain("due_date");
  expect(offered).not.toMatch(
    /amount|paid_amount|notes|metadata|bank_account_id|counterparty_company_id/,
  );
});
it("keeps the financial variables of old generic workflows available", async () => {
  await render(
    createElement(WorkflowBuilder, {
      open: true,
      draft: draft(null),
      onClose: vi.fn(),
      onSave: save,
    }),
  );
  expect(document.querySelector('[aria-label="Variáveis oferecidas"]')?.textContent).toContain(
    "amount",
  );
});
it("preserves an incompatible saved configuration and blocks submission with an explanation", async () => {
  const saved = draft("finance.payable.overdue");
  saved.trigger.filters = [{ field: "amount", op: "gt", value: 0 }];
  await render(
    createElement(WorkflowBuilder, { open: true, draft: saved, onClose: vi.fn(), onSave: save }),
  );
  expect(document.querySelector('[role="alert"]')?.textContent).toContain(
    "Campo indisponível neste aviso financeiro",
  );
  const button = document.querySelector<HTMLButtonElement>('[aria-label="Salvar rascunho"]')!;
  expect(button.disabled).toBe(true);
  await act(async () => button.click());
  expect(save).not.toHaveBeenCalled();
  expect(saved.trigger.filters).toEqual([{ field: "amount", op: "gt", value: 0 }]);
});
it.each(WORKFLOW_NOTIFICATION_EVENTS.filter((event) => event.moduleKey === "finance"))(
  "shows $key without offset fields or private condition options",
  async (event) => {
    await render(
      createElement(TriggerConfigPanel, {
        entity: event.entity,
        trigger: workflowNotificationEventTrigger(event.key),
        fields: ["status", "due_date", "amount", "notes", "bank_account_id"].map((name) => ({
          name,
          label: name,
        })),
        onEntityClick: vi.fn(),
        onChange: vi.fn(),
      }),
    );
    expect(host.querySelector('[aria-label="Antecedência do aviso em dias"]')).toBeNull();
    for (const node of host.querySelectorAll('[aria-label="Campos oferecidos"]'))
      expect(node.textContent).not.toMatch(/amount|notes|bank_account/);
    expect(host.textContent).toContain("não paga");
    if (event.key.endsWith(".due")) expect(host.textContent).toContain("Conta do dia");
    if (event.key.endsWith(".overdue"))
      expect(host.textContent).toContain("Não há antecedência nem lembrete diário");
    if (event.key === "finance.invoice.received") {
      expect(host.textContent).toContain("Recebida não significa conferida");
      expect(host.textContent).toContain("somente leitura");
    }
  },
);
it("hides source mutation actions only for a named finance event", async () => {
  await render(
    createElement(ActionLibraryPanel, {
      notificationEventKey: "finance.payable.due",
      onClose: vi.fn(),
      onPick: vi.fn(),
    }),
  );
  expect(host.textContent).not.toContain("Atualizar campo");
  expect(host.textContent).not.toContain("Incrementar campo");
  expect(host.textContent).not.toContain("Limpar campo");
  await render(createElement(ActionLibraryPanel, { onClose: vi.fn(), onPick: vi.fn() }));
  expect(host.textContent).toContain("Atualizar campo");
  expect(host.textContent).toContain("Incrementar campo");
});

it.each(WORKFLOW_NOTIFICATION_EVENTS.filter((event) => event.moduleKey === "finance"))(
  "hides financial schedule aliases for $key while keeping generic legacy choices",
  async (event) => {
    const labels = [
      "Programar contas a pagar",
      "Lançar conta a receber",
      "Cancelar parcelas futuras",
    ];
    await render(
      createElement(ActionLibraryPanel, {
        notificationEventKey: event.key,
        onClose: vi.fn(),
        onPick: vi.fn(),
      }),
    );
    for (const label of labels) expect(host.textContent).not.toContain(label);
    await render(createElement(ActionLibraryPanel, { onClose: vi.fn(), onPick: vi.fn() }));
    for (const label of labels) expect(host.textContent).toContain(label);
  },
);

it("explains publication of new finance occurrences without excluding titles that already exist today", async () => {
  await render(
    createElement(WorkflowBuilder, {
      open: true,
      draft: draft("finance.payable.due"),
      onClose: vi.fn(),
      onSave: save,
    }),
  );
  expect(document.body.textContent).toContain("novas ocorrências após publicar");
  expect(document.body.textContent).toContain("contas do dia podem ser já existentes");
  expect(document.body.textContent).not.toContain("novos registros depois de publicar");
});
it("preserves the existing publication banner for a generic workflow", async () => {
  await render(
    createElement(WorkflowBuilder, {
      open: true,
      draft: draft(null),
      onClose: vi.fn(),
      onSave: save,
    }),
  );
  expect(document.body.textContent).toContain("novos registros depois de publicar");
  expect(document.body.textContent).not.toContain("contas do dia podem ser já existentes");
});
