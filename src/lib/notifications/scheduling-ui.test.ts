// @vitest-environment jsdom
import { act, createElement, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ editable: true, userId: "user", workspaceId: "workspace" }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: state.userId } }) }));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    workspaceId: state.workspaceId,
    isLoading: false,
    isError: false,
    canAny: () => state.editable,
  }),
}));
vi.mock("@/hooks/use-workspace-members", () => ({
  useWorkspaceMembers: () => ({ data: [{ user_id: "member" }], isLoading: false, isError: false }),
}));
vi.mock("@/components/workflows/token-input", () => ({
  TokenInput: () => createElement("input"),
  TokenTextarea: () => createElement("textarea"),
}));
vi.mock("@/components/workflows/builder/step-forms/pickers", () => ({
  UserPicker: ({ value, onChange }: { value: string; onChange: (value: string) => void }) =>
    createElement(
      "select",
      {
        "aria-label": "Membro explícito",
        value,
        onChange: (event: { target: { value: string } }) => onChange(event.target.value),
      },
      createElement("option", { value: "" }, "Escolha um membro"),
      createElement("option", { value: "member" }, "Membro autorizado"),
    ),
}));
vi.mock("@/lib/crm", () => ({ formatDateTime: (value: string) => value }));
import { NotificationDigestPanel } from "@/components/notifications/notification-digest-panel";
import { NotificationDeliveryChoice } from "@/components/workflows/builder/step-forms/notification-delivery-choice";
import { NotificationForm } from "@/components/workflows/builder/step-forms/notification-form";
import { DeliveryHistoryPanel } from "@/components/notifications/delivery-history-panel";
import { DeliverySettingsPanel } from "@/components/notifications/delivery-settings-panel";
import { DEFAULT_NOTIFICATION_DIGEST_SETTINGS } from "./scheduling-types";
import {
  DEFAULT_NOTIFICATION_DELIVERY_POLICY,
  type NotificationDeliveryHistoryItem,
} from "./delivery-types";
import type { WorkflowAction, WorkflowEntity } from "@/lib/workflows/types";

type Action = Extract<WorkflowAction, { type: "send_notification" }>;
let root: Root, host: HTMLDivElement;
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
  state.editable = true;
  state.userId = "user";
  state.workspaceId = "workspace";
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
async function render(node: ReactNode) {
  await act(async () => root.render(node));
}
async function click(node: Element | null | undefined) {
  expect(node).toBeTruthy();
  await act(async () => (node as HTMLElement).click());
}
const button = (text: string) =>
  [...host.querySelectorAll("button")].find((node) => node.textContent === text);
async function input(label: string, value: string) {
  const node = host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
  expect(node).toBeTruthy();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function select(label: string, value: string) {
  const node = host.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;
  expect(node).toBeTruthy();
  await act(async () => {
    node.value = value;
    node.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
function Editor({
  initial,
  eventKey,
  entity = "project_tasks",
  channelsOnly = false,
  change = () => {},
}: {
  initial: Action;
  eventKey?: string;
  entity?: WorkflowEntity;
  channelsOnly?: boolean;
  change?: (value: WorkflowAction) => void;
}) {
  const [action, setAction] = useState(initial);
  const onChange = (value: WorkflowAction) => {
    change(value);
    setAction(value as Action);
  };
  return createElement(
    "div",
    null,
    channelsOnly
      ? createElement(NotificationDeliveryChoice, {
          action,
          notificationEventKey: eventKey,
          canEdit: state.editable,
          onChange,
        })
      : createElement(NotificationForm, {
          action,
          notificationEventKey: eventKey,
          entity,
          onChange,
        }),
    createElement("pre", { "aria-label": "Rascunho do passo" }, JSON.stringify(action)),
  );
}
const savedAction = (): Action => ({
  type: "send_notification",
  title: "Aviso",
  delivery: { channels: ["inapp", "whatsapp"], fallback: "email" },
});
const draft = () =>
  JSON.parse(host.querySelector('[aria-label="Rascunho do passo"]')!.textContent!) as Action;

it("opens digest disabled without choosing a channel or writing an opt-in", async () => {
  const save = vi.fn();
  await render(
    createElement(NotificationDigestPanel, {
      userId: "user",
      workspaceId: "workspace",
      settings: DEFAULT_NOTIFICATION_DIGEST_SETTINGS,
      revision: 3,
      canEdit: true,
      onSave: save,
    }),
  );
  expect(host.querySelector("#notification-digest-enabled")?.getAttribute("aria-checked")).toBe(
    "false",
  );
  expect(host.querySelector("#notification-digest-email")?.getAttribute("aria-checked")).toBe(
    "false",
  );
  expect(host.querySelector("#notification-digest-whatsapp")?.getAttribute("aria-checked")).toBe(
    "false",
  );
  expect(host.querySelector<HTMLSelectElement>('[aria-label="Horário do resumo"]')?.value).toBe(
    "08:30",
  );
  expect(save).not.toHaveBeenCalled();
  expect(button("Salvar opções do resumo")?.disabled).toBe(true);
});
it("requires an explicit digest channel rather than silently choosing email", async () => {
  const save = vi.fn();
  await render(
    createElement(NotificationDigestPanel, {
      userId: "user",
      workspaceId: "workspace",
      settings: DEFAULT_NOTIFICATION_DIGEST_SETTINGS,
      revision: 3,
      canEdit: true,
      onSave: save,
    }),
  );
  await click(host.querySelector("#notification-digest-enabled"));
  await click(button("Salvar opções do resumo"));
  expect(host.textContent).toContain("Escolha pelo menos um canal");
  expect(save).not.toHaveBeenCalled();
});
it("saves the explicit own weekly agenda and selected channels at its original revision", async () => {
  const save = vi.fn().mockResolvedValue({});
  await render(
    createElement(NotificationDigestPanel, {
      userId: "user",
      workspaceId: "workspace",
      settings: DEFAULT_NOTIFICATION_DIGEST_SETTINGS,
      revision: 4,
      canEdit: true,
      onSave: save,
    }),
  );
  await select("Frequência do resumo", "weekly");
  await select("Dia do resumo semanal", "5");
  await select("Horário do resumo", "09:15");
  await input("Fuso horário do resumo", "Europe/Lisbon");
  await click(host.querySelector("#notification-digest-whatsapp"));
  await click(host.querySelector("#notification-digest-enabled"));
  await click(button("Salvar opções do resumo"));
  expect(save).toHaveBeenCalledExactlyOnceWith(
    {
      enabled: true,
      frequency: "weekly",
      weekday: 5,
      at: "09:15",
      timezone: "Europe/Lisbon",
      channels: ["whatsapp"],
    },
    4,
  );
  expect(host.textContent).toContain("Nenhuma mensagem foi enviada por esta ação");
});
it("distinguishes current composition, immediate central, mandatory approval and no digest fallback", async () => {
  await render(
    createElement(NotificationDigestPanel, {
      userId: "user",
      workspaceId: "workspace",
      settings: DEFAULT_NOTIFICATION_DIGEST_SETTINGS,
      revision: 0,
      canEdit: true,
      onSave: vi.fn(),
    }),
  );
  expect(host.textContent).toContain("separada do agrupamento visual");
  expect(host.textContent).toContain("A central permanece imediata");
  expect(host.textContent).toContain("Aprovações de solicitações profissionais não são agrupadas");
  expect(host.textContent).toContain("Não há fallback automático");
  expect(host.textContent).toContain("sem contagens, títulos ou dados");
  expect(host.textContent).toContain("não é um relatório histórico");
});
it("preserves a dirty digest draft on revision conflict and blocks writes", async () => {
  const save = vi.fn();
  const props = {
    userId: "user",
    workspaceId: "workspace",
    settings: DEFAULT_NOTIFICATION_DIGEST_SETTINGS,
    revision: 4,
    canEdit: true,
    onSave: save,
  };
  await render(createElement(NotificationDigestPanel, props));
  await input("Fuso horário do resumo", "Europe/Lisbon");
  await render(createElement(NotificationDigestPanel, { ...props, revision: 5 }));
  expect(host.querySelector<HTMLInputElement>('[aria-label="Fuso horário do resumo"]')!.value).toBe(
    "Europe/Lisbon",
  );
  expect(host.textContent).toContain("rascunho foi preservado");
  expect(button("Salvar opções do resumo")!.disabled).toBe(true);
  expect(save).not.toHaveBeenCalled();
});
it("keeps a digest draft after a rejected save and does not claim success", async () => {
  const save = vi.fn().mockRejectedValue(new Error("Conflito de revisão"));
  await render(
    createElement(NotificationDigestPanel, {
      userId: "user",
      workspaceId: "workspace",
      settings: DEFAULT_NOTIFICATION_DIGEST_SETTINGS,
      revision: 1,
      canEdit: true,
      onSave: save,
    }),
  );
  await select("Frequência do resumo", "weekly");
  await click(button("Salvar opções do resumo"));
  expect(host.querySelector<HTMLSelectElement>('[aria-label="Frequência do resumo"]')!.value).toBe(
    "weekly",
  );
  expect(host.textContent).toContain("Conflito de revisão");
  expect(host.textContent).not.toContain("opções do resumo deste workspace salvas");
});
it("blocks digest edits and writes while its parent revalidates access", async () => {
  const save = vi.fn();
  await render(
    createElement(NotificationDigestPanel, {
      userId: "user",
      workspaceId: "workspace",
      settings: DEFAULT_NOTIFICATION_DIGEST_SETTINGS,
      revision: 1,
      canEdit: false,
      onSave: save,
    }),
  );
  await click(host.querySelector("#notification-digest-enabled"));
  expect(host.querySelector("#notification-digest-enabled")?.getAttribute("aria-checked")).toBe(
    "false",
  );
  expect(save).not.toHaveBeenCalled();
});
it("does not rewrite a legacy step or add priority merely by opening channel settings", async () => {
  const change = vi.fn();
  await render(
    createElement(Editor, {
      initial: { type: "send_notification", title: "Legado" },
      channelsOnly: true,
      change,
    }),
  );
  await click(button("Configurar canais de aviso"));
  expect(change).not.toHaveBeenCalled();
  expect(draft().delivery).toBeUndefined();
});
it("keeps priority and bounded followup when adding a parallel channel", async () => {
  const initial = savedAction();
  initial.delivery!.priority = "low";
  initial.delivery!.followup = { reminder: { interval_hours: 24, max_occurrences: 2 } };
  await render(
    createElement(Editor, { initial, channelsOnly: true, eventKey: "projects.task.overdue" }),
  );
  await click(host.querySelector("#notification-delivery-email"));
  expect(draft().delivery).toEqual({
    channels: ["inapp", "whatsapp", "email"],
    fallback: "none",
    priority: "low",
    followup: initial.delivery!.followup,
  });
  expect(host.querySelector<HTMLButtonElement>("#notification-delivery-inapp")!.disabled).toBe(
    true,
  );
});
it("setting priority preserves the original fallback and does not enable a followup", async () => {
  await render(
    createElement(Editor, {
      initial: savedAction(),
      channelsOnly: true,
      eventKey: "projects.task.overdue",
    }),
  );
  await select("Prioridade da comunicação", "low");
  expect(draft().delivery).toEqual({
    channels: ["inapp", "whatsapp"],
    fallback: "email",
    priority: "low",
  });
});
it("starts a reminder with an empty required interval and one visible occurrence", async () => {
  await render(
    createElement(Editor, { initial: savedAction(), eventKey: "projects.task.overdue" }),
  );
  await click(host.querySelector("#notification-reminder"));
  expect(
    host.querySelector<HTMLInputElement>('[aria-label="Intervalo do lembrete em horas"]')!.value,
  ).toBe("");
  expect(
    host.querySelector<HTMLSelectElement>('[aria-label="Quantidade máxima de lembretes"]')!.value,
  ).toBe("1");
  expect(host.textContent).toContain("Revise os intervalos");
  await input("Intervalo do lembrete em horas", "24");
  await select("Quantidade máxima de lembretes", "3");
  expect(draft().delivery!.followup?.reminder).toEqual({ interval_hours: 24, max_occurrences: 3 });
});
it("does not offer automatic followup to generic or non-pending events", async () => {
  await render(
    createElement(Editor, { initial: savedAction(), eventKey: "crm.deal.won", entity: "deals" }),
  );
  expect(host.querySelector('[aria-label="Acompanhamento do aviso"]')).toBeNull();
});
it("requires in-app eligibility before allowing a new followup", async () => {
  const initial = savedAction();
  initial.delivery!.channels = ["whatsapp"];
  await render(createElement(Editor, { initial, eventKey: "projects.task.overdue" }));
  expect(host.querySelector<HTMLButtonElement>("#notification-reminder")!.disabled).toBe(true);
  expect(host.textContent).toContain("Inclua o canal No app");
});
it("keeps the mandatory preparation approver immediate and allows reminder without escalation", async () => {
  await render(
    createElement(Editor, {
      initial: savedAction(),
      eventKey: "people.approval.pending",
      entity: "hiring_preparation_requests",
    }),
  );
  expect(host.textContent).toContain("Esta aprovação não é agrupada em resumo");
  expect(host.querySelector("#notification-reminder")).toBeTruthy();
  expect(host.querySelector("#notification-escalation")).toBeNull();
  expect(host.textContent).toContain("aprovador vigente");
});
it("requires an explicit escalation recipient without creating a CEO or manager default", async () => {
  await render(
    createElement(Editor, { initial: savedAction(), eventKey: "projects.task.overdue" }),
  );
  await click(host.querySelector("#notification-escalation"));
  expect(draft().delivery!.followup?.escalation).toEqual({
    after_hours: 0,
    recipient: { kind: "user", id: "" },
  });
  await input("Prazo do escalonamento em horas", "48");
  await select("Membro explícito", "member");
  expect(draft().delivery!.followup?.escalation).toEqual({
    after_hours: 48,
    recipient: { kind: "user", id: "member" },
  });
});
it("explains that fiscal review and rejection stop NF followups", async () => {
  await render(
    createElement(Editor, {
      initial: savedAction(),
      eventKey: "finance.invoice.received",
      entity: "hiring_fiscal_documents",
    }),
  );
  expect(host.textContent).toContain("Conferência ou rejeição encerra o acompanhamento");
  expect(host.textContent).toContain("Financeiro da formalização vigente");
});
it("disabling followup preserves selected channels, priority and fallback", async () => {
  const initial = savedAction();
  initial.delivery!.priority = "high";
  initial.delivery!.followup = { reminder: { interval_hours: 12, max_occurrences: 1 } };
  await render(createElement(Editor, { initial, eventKey: "projects.task.overdue" }));
  await click(button("Desativar acompanhamento deste passo"));
  expect(draft().delivery).toEqual({
    channels: ["inapp", "whatsapp"],
    fallback: "email",
    priority: "high",
  });
});
it("shows proven scheduling kinds and parents without fabricating a workflow for the digest", async () => {
  const items = ["digest", "reminder", "escalation"].map((kind, index) => ({
    id: `row-${index}`,
    occurrence_kind: kind,
    channel: "email",
    status: "queued",
    reason_code: null,
    attempts: 0,
    created_at: "2026-11-20T12:00:00Z",
    updated_at: "2026-11-20T12:00:00Z",
    workflow_id: null,
    batch_id: kind === "digest" ? "batch-proof" : null,
    parent_intent_id: kind === "reminder" ? "parent-proof" : null,
  })) as NotificationDeliveryHistoryItem[];
  await render(
    createElement(DeliveryHistoryPanel, {
      items,
      filters: { scope: "own", status: "", channel: "" },
      canWorkspace: false,
      loading: false,
      error: null,
      hasMore: false,
      loadingMore: false,
      onMore: vi.fn(),
      onFilters: vi.fn(),
      onRetry: vi.fn(),
      canRead: true,
    }),
  );
  expect(host.textContent).toContain("Resumo pessoal");
  expect(host.textContent).toContain("Lembrete");
  expect(host.textContent).toContain("Escalonamento");
  await click(button("Ver motivo"));
  expect(host.textContent).toContain("Lote do resumo: batch-proof");
  expect(host.textContent).not.toContain("workflow");
});
it("workspace scheduling defaults stay disabled and followup enabling requires positive quota", async () => {
  const save = vi.fn();
  await render(
    createElement(DeliverySettingsPanel, {
      policy: DEFAULT_NOTIFICATION_DELIVERY_POLICY,
      revision: 0,
      canEdit: true,
      canConfigureWhatsApp: false,
      senders: [],
      templates: [],
      templatesLoading: false,
      onSenderChange: vi.fn(),
      onSave: save,
    }),
  );
  expect(host.querySelector("#notification-policy-digest")?.getAttribute("aria-checked")).toBe(
    "false",
  );
  expect(host.querySelector("#notification-policy-followups")?.getAttribute("aria-checked")).toBe(
    "false",
  );
  await click(host.querySelector("#notification-policy-followups"));
  await click(button("Salvar política de notificações"));
  expect(save).not.toHaveBeenCalled();
  expect(host.querySelector('[role="alert"]')).toBeTruthy();
  await input("Cota diária de acompanhamentos", "10");
  await click(button("Salvar política de notificações"));
  expect(save).toHaveBeenCalledExactlyOnceWith(
    { ...DEFAULT_NOTIFICATION_DELIVERY_POLICY, followups_enabled: true, followup_daily_limit: 10 },
    0,
  );
});

it.each(["other-user", "other-workspace"])(
  "hides digest options inside the panel when %s does not match its own context",
  async (mismatch) => {
    const save = vi.fn();
    if (mismatch === "other-user") state.userId = "other";
    else state.workspaceId = "other";
    await render(
      createElement(NotificationDigestPanel, {
        userId: "user",
        workspaceId: "workspace",
        settings: { ...DEFAULT_NOTIFICATION_DIGEST_SETTINGS, timezone: "PRIVATE_OLD_ZONE" },
        revision: 1,
        canEdit: true,
        onSave: save,
      }),
    );
    expect(host.textContent).toContain("Aguardando confirmação da identidade");
    expect(host.innerHTML).not.toContain("PRIVATE_OLD_ZONE");
    expect(host.querySelector("form")).toBeNull();
    expect(save).not.toHaveBeenCalled();
  },
);

it("does not regress a confirmed digest save when cache props still carry the older revision", async () => {
  const settings = { ...DEFAULT_NOTIFICATION_DIGEST_SETTINGS };
  const save = vi
    .fn()
    .mockImplementation(async (snapshot) => ({ settings: snapshot, revision: 2 }));
  const props = {
    userId: "user",
    workspaceId: "workspace",
    settings,
    revision: 1,
    canEdit: true,
    onSave: save,
  };
  await render(createElement(NotificationDigestPanel, props));
  await select("Frequência do resumo", "weekly");
  await click(button("Salvar opções do resumo"));
  // The own response is revision 2, while the parent's delayed cache notification still says 1.
  await render(createElement(NotificationDigestPanel, { ...props, settings: { ...settings } }));
  expect(host.querySelector<HTMLSelectElement>('[aria-label="Frequência do resumo"]')!.value).toBe(
    "weekly",
  );
  expect(host.textContent).toContain("Opções do resumo deste workspace salvas");
  expect(button("Salvar opções do resumo")!.disabled).toBe(true);
  await render(
    createElement(NotificationDigestPanel, {
      ...props,
      settings: { ...settings, frequency: "weekly" },
      revision: 2,
    }),
  );
  expect(host.textContent).toContain("Opções do resumo deste workspace salvas");
  expect(save).toHaveBeenCalledTimes(1);
});
