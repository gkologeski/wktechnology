// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/crm", () => ({ formatDateTime: (value: string) => value }));
import { NotificationSlackPolicyPanel } from "@/components/notifications/slack-policy-panel";
import { DeliveryHistoryPanel } from "@/components/notifications/delivery-history-panel";
import type { NotificationSlackSettings } from "@/lib/notifications/delivery-types";

const INTEGRATION = "aaaaaaaa-1111-4111-8111-111111111111";
const settings = (): NotificationSlackSettings => ({
  revision: 4,
  policy: { enabled: false, daily_limit: 0, integration_id: null, template_version: "neutral-v1" },
  integrations: [
    { id: INTEGRATION, team_name: "WK", default_channel_name: "avisos", endpoint_revision: 2 },
  ],
  canManage: true,
});
let host: HTMLDivElement, root: Root;
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
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.clearAllMocks();
});
async function render(node: ReactNode) {
  await act(async () => root.render(node));
}
async function click(selector: string) {
  const node = host.querySelector<HTMLElement>(selector)!;
  expect(node).toBeTruthy();
  await act(async () => node.click());
}
async function input(selector: string, value: string) {
  const node = host.querySelector<HTMLInputElement>(selector)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function choose() {
  const node = host.querySelector<HTMLSelectElement>('[aria-label="Conexão do Slack"]')!;
  await act(async () => {
    node.value = INTEGRATION;
    node.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
async function submit() {
  await act(async () => {
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}
async function enable() {
  await click("#notification-policy-slack");
  await input("#notification-slack-limit", "15");
  await choose();
}

it("keeps Slack off initially and previews only a neutral shared-channel notice without sending", async () => {
  const onSave = vi.fn();
  await render(
    createElement(NotificationSlackPolicyPanel, { settings: settings(), canEdit: true, onSave }),
  );
  expect(host.querySelector("#notification-policy-slack")?.getAttribute("aria-checked")).toBe(
    "false",
  );
  expect(host.textContent).toContain("Há uma atualização solicitada no TechERP.");
  expect(host.textContent).toContain("canal compartilhado");
  expect(host.textContent).toContain("prévia sem envio");
  expect(host.textContent).toContain("não comprova entrega ou leitura");
  expect(host.textContent).not.toContain("hooks.slack.com");
  expect(onSave).not.toHaveBeenCalled();
});
it("requires both explicit edit capability and server-confirmed integration management", async () => {
  const onSave = vi.fn();
  await render(
    createElement(NotificationSlackPolicyPanel, {
      settings: { ...settings(), canManage: false },
      canEdit: true,
      onSave,
    }),
  );
  expect(host.querySelector("fieldset")?.disabled).toBe(true);
  await submit();
  expect(onSave).not.toHaveBeenCalled();
  await render(createElement(NotificationSlackPolicyPanel, { settings: settings(), onSave }));
  await submit();
  expect(onSave).not.toHaveBeenCalled();
});
it("requires acknowledgement of the channel audience and saves the neutral version with CAS", async () => {
  const onSave = vi.fn().mockResolvedValue({});
  await render(
    createElement(NotificationSlackPolicyPanel, { settings: settings(), canEdit: true, onSave }),
  );
  await enable();
  await submit();
  expect(onSave).not.toHaveBeenCalled();
  expect(host.textContent).toContain("confirme o público");
  await click('[aria-label="Confirmar público compartilhado do Slack"]');
  await submit();
  expect(onSave).toHaveBeenCalledWith(
    { enabled: true, daily_limit: 15, integration_id: INTEGRATION, template_version: "neutral-v1" },
    4,
  );
});
it("does not enable Slack for a connection missing from the authorized metadata", async () => {
  const onSave = vi.fn();
  const value = settings();
  value.policy = { ...value.policy, integration_id: INTEGRATION };
  value.integrations = [];
  await render(
    createElement(NotificationSlackPolicyPanel, { settings: value, canEdit: true, onSave }),
  );
  await click("#notification-policy-slack");
  await input("#notification-slack-limit", "15");
  await click('[aria-label="Confirmar público compartilhado do Slack"]');
  await submit();
  expect(onSave).not.toHaveBeenCalled();
  expect(host.textContent).toContain("não está disponível com seu acesso atual");
});
it("preserves the edited quota and old revision when a concurrent save fails", async () => {
  const onSave = vi
    .fn()
    .mockRejectedValue(new Error("A política mudou. Recarregue antes de salvar."));
  await render(
    createElement(NotificationSlackPolicyPanel, { settings: settings(), canEdit: true, onSave }),
  );
  await enable();
  await click('[aria-label="Confirmar público compartilhado do Slack"]');
  await submit();
  expect(host.textContent).toContain("A política mudou");
  expect(host.querySelector<HTMLInputElement>("#notification-slack-limit")?.value).toBe("15");
  expect(onSave.mock.calls[0][1]).toBe(4);
});
it("does not race two submissions or allow a channel change while saving", async () => {
  let resolve!: () => void;
  const onSave = vi.fn(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  await render(
    createElement(NotificationSlackPolicyPanel, { settings: settings(), canEdit: true, onSave }),
  );
  await enable();
  await click('[aria-label="Confirmar público compartilhado do Slack"]');
  await submit();
  await submit();
  expect(onSave).toHaveBeenCalledTimes(1);
  expect(host.querySelector("fieldset")?.disabled).toBe(true);
  await act(async () => resolve());
});
const collective = {
  id: "slack-collective",
  channel: "slack" as const,
  status: "accepted",
  reason_code: null,
  attempts: 1,
  created_at: "2026-11-20",
  updated_at: "2026-11-20",
};
const history = (scope: "own" | "workspace", onFilters = vi.fn()) =>
  createElement(DeliveryHistoryPanel, {
    items: [collective],
    filters: { scope, status: "", channel: "" },
    canWorkspace: true,
    loading: false,
    hasMore: false,
    loadingMore: false,
    canRead: true,
    onFilters,
    onMore: vi.fn(),
    onRetry: vi.fn(),
  });
it("never represents a shared Slack notice as a personal delivery", async () => {
  await render(history("own"));
  expect(host.querySelector('option[value="slack"]')).toBeNull();
  expect(host.textContent).not.toContain("slack-co");
  expect(host.textContent).toContain("Nenhuma entrega encontrada");
});
it("shows Slack only in workspace history and labels acceptance without a read receipt", async () => {
  await render(history("workspace"));
  expect(host.querySelector('option[value="slack"]')).toBeTruthy();
  expect(host.textContent).toContain("Slack coletivo");
  expect(host.textContent).toContain("Aceito pelo provedor");
  expect(host.textContent).toContain("sem alegar entrega pessoal ou leitura");
});
