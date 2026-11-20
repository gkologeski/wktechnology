// @vitest-environment jsdom
import { act, createElement, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  workspace: "aaaaaaaa-1111-4111-8111-111111111111" as string | null,
}));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({ workspaceId: state.workspace, isLoading: false, isError: false }),
}));
vi.mock("@/components/ui/phone-input", () => ({
  PhoneInput: ({
    value,
    onChange,
    id,
    disabled,
  }: {
    value: string;
    onChange: (value: string) => void;
    id: string;
    disabled: boolean;
  }) =>
    createElement("input", {
      id,
      value,
      disabled,
      onChange: (event: { target: { value: string } }) => onChange(event.target.value),
    }),
}));
vi.mock("@/lib/crm", () => ({ formatDateTime: (value: string) => value }));
import { NotificationConsentPanel } from "@/components/notifications/notification-consent-panel";
import { DeliverySettingsPanel } from "@/components/notifications/delivery-settings-panel";
import { DeliveryModelsPanel } from "@/components/notifications/delivery-models-panel";
import { DeliveryHistoryPanel } from "@/components/notifications/delivery-history-panel";
import { NotificationRulesList } from "@/components/notifications/notification-rules-list";
import { NotificationDeliveryChoice } from "@/components/workflows/builder/step-forms/notification-delivery-choice";
import { DEFAULT_NOTIFICATION_DELIVERY_POLICY } from "./notifications/delivery-types";
import type { WorkflowAction } from "./workflows/types";
import type { NotificationWorkflowRuleRow } from "@/components/notifications/notification-rules-panel";

let host: HTMLDivElement, root: Root;
beforeEach(() => {
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
  state.workspace = "aaaaaaaa-1111-4111-8111-111111111111";
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.clearAllMocks();
});
async function render(node: ReactNode) {
  await act(async () => root.render(node));
}
async function click(element: Element | null | undefined) {
  expect(element).toBeTruthy();
  await act(async () => {
    (element as HTMLElement).click();
  });
}
function button(text: string) {
  return [...host.querySelectorAll("button")].find((node) => node.textContent === text);
}
async function input(selector: string, value: string) {
  const node = host.querySelector<HTMLInputElement>(selector)!;
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
const PHONE = "+5548998765432",
  OTHER = "+5548998765433";
const consent = { phone: PHONE, consent: null, deliveryAvailable: false };
const noop = async () => {};

it("does not grant WhatsApp consent or change the profile merely by opening the panel", async () => {
  const save = vi.fn(),
    phone = vi.fn();
  await render(
    createElement(NotificationConsentPanel, {
      canEdit: true,
      data: consent,
      onSave: save,
      onUpdatePhone: phone,
    }),
  );
  expect(host.querySelector('[role="checkbox"]')?.getAttribute("aria-checked")).toBe("false");
  expect(button("Salvar minha escolha")?.matches(":disabled")).toBe(true);
  expect(save).not.toHaveBeenCalled();
  expect(phone).not.toHaveBeenCalled();
  expect(host.textContent).toContain("não verifica a posse por SMS");
});
it("saves explicit consent only for the persisted own phone and current revision", async () => {
  const save = vi.fn().mockResolvedValue({});
  const phone = vi.fn();
  await render(
    createElement(NotificationConsentPanel, {
      canEdit: true,
      data: consent,
      onSave: save,
      onUpdatePhone: phone,
    }),
  );
  await click(host.querySelector('[role="checkbox"]'));
  await click(button("Salvar minha escolha"));
  expect(save).toHaveBeenCalledExactlyOnceWith({ granted: true, phone: PHONE, revision: 0 });
  expect(phone).not.toHaveBeenCalled();
  expect(host.textContent).toContain("autorização foi registrada");
});
it("revokes an old grant even after the profile phone was removed", async () => {
  const save = vi.fn().mockResolvedValue({});
  const data = {
    phone: null,
    consent: {
      phone: PHONE,
      grantedAt: "2026-11-20T10:00:00Z",
      revokedAt: null,
      version: "notifica-wa-v1",
      revision: 4,
    },
  };
  await render(
    createElement(NotificationConsentPanel, {
      canEdit: true,
      data,
      onSave: save,
      onUpdatePhone: noop,
    }),
  );
  await click(button("Revogar autorização"));
  expect(save).toHaveBeenCalledExactlyOnceWith({ granted: false, phone: PHONE, revision: 4 });
  expect(host.textContent).toContain("foi revogada");
});
it("requires an explicit separate profile update before authorizing a new number", async () => {
  const save = vi.fn(),
    phone = vi.fn().mockResolvedValue({});
  await render(
    createElement(NotificationConsentPanel, {
      canEdit: true,
      data: consent,
      onSave: save,
      onUpdatePhone: phone,
    }),
  );
  await input("#notification-personal-phone", OTHER);
  expect(host.querySelector('[role="checkbox"]')?.matches(":disabled")).toBe(true);
  await click(button("Atualizar telefone no perfil"));
  expect(phone).toHaveBeenCalledExactlyOnceWith({ phone: OTHER, expectedPhone: PHONE });
  expect(save).not.toHaveBeenCalled();
});
it("does not show consent saved after a CAS conflict and preserves the requested choice", async () => {
  const save = vi.fn().mockRejectedValue(new Error("A autorização mudou em outra sessão."));
  await render(
    createElement(NotificationConsentPanel, {
      canEdit: true,
      data: consent,
      onSave: save,
      onUpdatePhone: noop,
    }),
  );
  await click(host.querySelector('[role="checkbox"]'));
  await click(button("Salvar minha escolha"));
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("outra sessão");
  expect(host.querySelector('[role="checkbox"]')?.getAttribute("aria-checked")).toBe("true");
  expect(host.textContent).not.toContain("autorização foi registrada");
});

const settingsProps = {
  policy: DEFAULT_NOTIFICATION_DELIVERY_POLICY,
  revision: 0,
  canEdit: true,
  canConfigureWhatsApp: true,
  senders: [],
  templates: [],
  templatesLoading: false,
  onSenderChange: () => {},
  onSave: noop,
};
it("keeps external channels off and never saves policy automatically", async () => {
  const save = vi.fn();
  await render(createElement(DeliverySettingsPanel, { ...settingsProps, onSave: save }));
  expect(host.querySelector("#notification-policy-email")?.getAttribute("aria-checked")).toBe(
    "false",
  );
  expect(host.querySelector("#notification-policy-wa")?.getAttribute("aria-checked")).toBe("false");
  expect(save).not.toHaveBeenCalled();
  expect(button("Salvar política de notificações")?.matches(":disabled")).toBe(true);
});
it("does not save enabled email without an explicit positive quota", async () => {
  const save = vi.fn();
  await render(createElement(DeliverySettingsPanel, { ...settingsProps, onSave: save }));
  await click(host.querySelector("#notification-policy-email"));
  await click(button("Salvar política de notificações"));
  expect(save).not.toHaveBeenCalled();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("cota positiva");
});
it("saves the bounded policy with its revision after explicit configuration", async () => {
  const save = vi.fn().mockResolvedValue({});
  await render(
    createElement(DeliverySettingsPanel, { ...settingsProps, revision: 2, onSave: save }),
  );
  await click(host.querySelector("#notification-policy-email"));
  await input('input[aria-label="Cota diária de e-mail"]', "25");
  await click(button("Salvar política de notificações"));
  expect(save).toHaveBeenCalledExactlyOnceWith(
    { ...DEFAULT_NOTIFICATION_DELIVERY_POLICY, email_enabled: true, email_daily_limit: 25 },
    2,
  );
});
it("keeps policy read-only without the edit capability", async () => {
  const save = vi.fn();
  await render(
    createElement(DeliverySettingsPanel, { ...settingsProps, canEdit: false, onSave: save }),
  );
  expect(host.querySelector("fieldset")?.matches(":disabled")).toBe(true);
  expect(button("Salvar política de notificações")?.matches(":disabled")).toBe(true);
  expect(save).not.toHaveBeenCalled();
});
it("changes the pinned sender without retaining the previous sender's template", async () => {
  const save = vi.fn().mockResolvedValue({}),
    changed = vi.fn();
  const policy = {
    ...DEFAULT_NOTIFICATION_DELIVERY_POLICY,
    wa_sender_id: "12345",
    wa_template_name: "old_model",
    wa_template_language: "pt_BR",
  };
  await render(
    createElement(DeliverySettingsPanel, {
      ...settingsProps,
      policy,
      senders: [
        { id: "12345", label: "Principal", phone: PHONE, available: true, quality: "GREEN" },
        { id: "67890", label: "Alternativo", phone: OTHER, available: true, quality: "GREEN" },
      ],
      onSave: save,
      onSenderChange: changed,
    }),
  );
  await select("Remetente fixo de WhatsApp", "67890");
  await click(button("Salvar política de notificações"));
  expect(changed).toHaveBeenCalledWith("67890");
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      wa_sender_id: "67890",
      wa_template_name: null,
      wa_template_language: null,
    }),
    0,
  );
});
it("shows a policy save conflict without clearing the edited quota", async () => {
  const save = vi.fn().mockRejectedValue(new Error("A política mudou em outra sessão."));
  await render(createElement(DeliverySettingsPanel, { ...settingsProps, onSave: save }));
  await input('input[aria-label="Cota diária de e-mail"]', "10");
  await click(button("Salvar política de notificações"));
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("outra sessão");
  expect(
    host.querySelector<HTMLInputElement>('input[aria-label="Cota diária de e-mail"]')?.value,
  ).toBe("10");
});

it("does not label an incompatible WhatsApp model as compatible or send from its preview", async () => {
  await render(
    createElement(DeliveryModelsPanel, {
      canRead: true,
      templates: [
        {
          name: "fixture_model",
          language: "pt_BR",
          body: "Texto do modelo",
          compatible: false,
          reason: "Formato não compatível",
        },
      ],
      loading: false,
      onRetry: () => {},
    }),
  );
  await click(button("WhatsApp"));
  await click(
    [...host.querySelectorAll("button")].find((node) =>
      node.textContent?.includes("fixture_model"),
    ),
  );
  expect(host.textContent).toContain("Não elegível");
  expect(host.textContent).toContain("O modelo não atende ao formato de avisos desta central.");
  expect(host.textContent).toContain("Nenhuma mensagem é enviada");
});
it("history keeps uncertain results separate from delivery and never renders raw provider details", async () => {
  await render(
    createElement(DeliveryHistoryPanel, {
      canRead: true,
      items: [
        {
          id: state.workspace!,
          channel: "whatsapp",
          status: "uncertain",
          reason_code: "transport_unknown",
          attempts: 1,
          created_at: "2026-11-20T10:00:00Z",
          updated_at: "2026-11-20T10:00:00Z",
          provider_id: "SECRET_PROVIDER_ID",
          recipient_user_id: PHONE,
        },
      ],
      filters: { scope: "own", status: "", channel: "" },
      canWorkspace: false,
      loading: false,
      hasMore: false,
      loadingMore: false,
      onFilters: () => {},
      onMore: () => {},
      onRetry: () => {},
    }),
  );
  await click(button("Ver motivo"));
  expect(host.textContent).toContain("Aguarde a conciliação");
  expect(host.textContent).not.toContain("SECRET_PROVIDER_ID");
  expect(host.textContent).not.toContain(PHONE);
  expect(
    [...host.querySelectorAll("button")].some((node) => /reenviar/i.test(node.textContent ?? "")),
  ).toBe(false);
  expect(host.querySelector('option[value="workspace"]')).toBeNull();
});
it("history query failure is shown as an error rather than an empty list", async () => {
  await render(
    createElement(DeliveryHistoryPanel, {
      canRead: true,
      items: [],
      filters: { scope: "own", status: "", channel: "" },
      canWorkspace: false,
      loading: false,
      error: "Consulta indisponível",
      hasMore: false,
      loadingMore: false,
      onFilters: () => {},
      onMore: () => {},
      onRetry: () => {},
    }),
  );
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Consulta indisponível");
  expect(host.textContent).not.toContain("Nenhuma entrega encontrada");
});

type Notice = Extract<WorkflowAction, { type: "send_notification" }>;
let draft: Notice;
function Choice() {
  const [value, setValue] = useState<Notice>({ type: "send_notification", title: "Aviso" });
  draft = value;
  return createElement(NotificationDeliveryChoice, {
    canEdit: true,
    action: value,
    onChange: (next) => setValue(next as Notice),
  });
}
it("opening delivery choices preserves the legacy in-app-only action", async () => {
  await render(createElement(Choice));
  expect(draft.delivery).toBeUndefined();
  await click(button("Configurar canais de aviso"));
  expect(draft.delivery).toBeUndefined();
  expect(host.querySelector("#notification-delivery-inapp")?.getAttribute("aria-checked")).toBe(
    "true",
  );
});
it("prevents fallback duplication when email becomes a parallel channel", async () => {
  await render(createElement(Choice));
  await click(button("Configurar canais de aviso"));
  await click(host.querySelector("#notification-delivery-whatsapp"));
  await select("Fallback da notificação", "email");
  expect(draft.delivery?.fallback).toBe("email");
  await click(host.querySelector("#notification-delivery-email"));
  expect(draft.delivery).toEqual({ channels: ["inapp", "whatsapp", "email"], fallback: "none" });
  expect(
    host.querySelector('select[aria-label="Fallback da notificação"]')?.matches(":disabled"),
  ).toBe(true);
});
const rule = {
  id: "bbbbbbbb-1111-4111-8111-111111111111",
  name: "Aviso do negócio",
  entity: "deals",
  enabled: false,
  status: "draft",
  published_version: 0,
  trigger: { event: "created", filters: [] },
  actions: [],
  draft_trigger: null,
  draft_actions: null,
} as NotificationWorkflowRuleRow;
it("rule list exposes only preview when record capabilities do not permit mutation", async () => {
  const action = vi.fn();
  await render(
    createElement(NotificationRulesList, {
      canRead: true,
      rows: [rule],
      capabilityFor: () => ({ can_update: false, can_manage: false, can_delete: false }),
      manager: true,
      readOnly: false,
      pending: false,
      onAction: action,
    }),
  );
  expect(button("Editar no construtor")).toBeUndefined();
  expect(button("Publicar versão")).toBeUndefined();
  await click(button("Conferir configuração sem enviar"));
  expect(action).toHaveBeenCalledExactlyOnceWith("preview", rule, undefined);
});
it("rule list waits for a valid workspace context before showing configuration", async () => {
  state.workspace = null;
  await render(
    createElement(NotificationRulesList, {
      canRead: true,
      rows: [rule],
      capabilityFor: () => ({ can_update: true, can_manage: true, can_delete: true }),
      manager: true,
      readOnly: false,
      pending: false,
      onAction: () => {},
    }),
  );
  expect(host.textContent).toContain("Aguardando confirmação");
  expect(host.textContent).not.toContain(rule.name);
});

it("denies delegated interactions unless permission is explicitly true", async () => {
  const { notificationDeliveryInteractionAllowed } =
    await import("./notification-delivery-interaction");
  expect(notificationDeliveryInteractionAllowed(undefined)).toBe(false);
  expect(notificationDeliveryInteractionAllowed(false)).toBe(false);
  expect(notificationDeliveryInteractionAllowed(true, true)).toBe(false);
  expect(notificationDeliveryInteractionAllowed(true, false)).toBe(true);
});
it("keeps own consent disabled when its authenticated wrapper has no capability", async () => {
  const save = vi.fn(),
    phone = vi.fn();
  await render(
    createElement(NotificationConsentPanel, { data: consent, onSave: save, onUpdatePhone: phone }),
  );
  expect(host.querySelector('[role="checkbox"]')?.matches(":disabled")).toBe(true);
  await click(button("Salvar minha escolha"));
  expect(save).not.toHaveBeenCalled();
  expect(phone).not.toHaveBeenCalled();
});
it("does not expose delivery details or call history APIs without explicit read capability", async () => {
  const retry = vi.fn();
  await render(
    createElement(DeliveryHistoryPanel, {
      items: [],
      filters: { scope: "own", status: "", channel: "" },
      canWorkspace: true,
      loading: false,
      hasMore: false,
      loadingMore: false,
      onFilters: vi.fn(),
      onMore: vi.fn(),
      onRetry: retry,
    }),
  );
  expect(host.textContent).toContain("Sem permissão");
  expect(button("Atualizar entregas")).toBeUndefined();
  expect(retry).not.toHaveBeenCalled();
});
