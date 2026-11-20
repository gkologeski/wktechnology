// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/crm", () => ({ formatDateTime: (value: string) => value }));
import {
  DeliveryModelsPanel,
  type NotificationTemplateOption,
} from "@/components/notifications/delivery-models-panel";
import { DeliverySettingsPanel } from "@/components/notifications/delivery-settings-panel";
import { DeliveryHistoryPanel } from "@/components/notifications/delivery-history-panel";
import {
  DEFAULT_NOTIFICATION_DELIVERY_POLICY,
  type NotificationDeliveryHistoryItem,
} from "./notifications/delivery-types";

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
});
async function render(node: ReactNode) {
  await act(async () => root.render(node));
}
async function click(label: string) {
  await act(async () =>
    [...host.querySelectorAll("button")].find((button) => button.textContent === label)!.click(),
  );
}
const template: NotificationTemplateOption = {
  name: "aviso_central",
  language: "pt_BR",
  body: "{{1}} Acesse sua central: {{2}}.",
  status: "APPROVED",
  category: "UTILITY",
  compatible: true,
  preview: {
    header: "TechERP",
    body: "Há uma atualização solicitada no TechERP. Acesse sua central: https://app.example.test/notifications.",
    footer: "Gerencie seus avisos na central do TechERP.",
    button: { text: "Abrir central", url: "https://app.example.test/notifications" },
  },
};
async function openTemplate(value: NotificationTemplateOption) {
  await render(
    createElement(DeliveryModelsPanel, {
      canRead: true,
      templates: [value],
      loading: false,
      onRetry: vi.fn(),
    }),
  );
  await click("WhatsApp");
  const button = [...host.querySelectorAll("button")].find((button) =>
    button.textContent?.includes(value.name),
  )!;
  await act(async () => button.click());
}

it("shows the resolved approved template preview including its fixed header footer and button", async () => {
  await openTemplate(template);
  const preview = host.querySelector('[aria-label="Conteúdo previsto do WhatsApp"]')!;
  expect(preview.textContent).toContain(template.preview!.body);
  expect(preview.textContent).toContain(template.preview!.header);
  expect(preview.textContent).toContain(template.preview!.footer);
  expect(preview.textContent).toContain("Abrir central");
  expect(preview.textContent).not.toContain("{{1}}");
  expect(preview.querySelector("a")).toBeNull();
  expect(host.textContent).toContain("Status Meta: APPROVED");
  expect(host.textContent).toContain("Categoria: UTILITY");
  expect(host.textContent).toContain("Nenhuma mensagem é enviada");
  expect(host.querySelector('button[type="submit"]')).toBeNull();
});

it.each([
  ["PENDING", "UTILITY", "template_not_approved", "ainda não está aprovado"],
  ["PAUSED", "UTILITY", "template_not_approved", "ainda não está aprovado"],
  ["APPROVED", "MARKETING", "template_not_utility", "não pertence à categoria UTILITY"],
  ["APPROVED", "UTILITY", "template_buttons_unsupported", "não aponta para o destino autorizado"],
])(
  "shows %s/%s as ineligible with a translated reason and without a sendable preview",
  async (status, category, reason, explanation) => {
    await openTemplate({
      ...template,
      status,
      category,
      compatible: false,
      reason,
      preview: null,
      body: "PRIVATE_UNSAFE_TEMPLATE",
    });
    expect(host.textContent).toContain(`Status Meta: ${status}`);
    expect(host.textContent).toContain("Não elegível");
    expect(host.textContent).toContain(explanation);
    expect(host.textContent).not.toContain(reason);
    expect(host.textContent).not.toContain("PRIVATE_UNSAFE_TEMPLATE");
    expect(host.querySelector('[aria-label="Conteúdo previsto do WhatsApp"]')).toBeNull();
  },
);

it("does not invent an approved sendable preview when catalog metadata is unconfirmed", async () => {
  await openTemplate({ ...template, status: null, category: null, preview: null });
  expect(host.textContent).toContain("Status Meta: Não confirmado");
  expect(host.textContent).toContain("Não elegível");
  expect(host.querySelector('[aria-label="Conteúdo previsto do WhatsApp"]')).toBeNull();
});

it.each(["YELLOW", "RED", null])(
  "keeps a saved %s sender visible but blocks selecting it as eligible",
  async (quality) => {
    await render(
      createElement(DeliverySettingsPanel, {
        policy: { ...DEFAULT_NOTIFICATION_DELIVERY_POLICY, wa_sender_id: "12345" },
        revision: 0,
        canEdit: true,
        canConfigureWhatsApp: true,
        senders: [
          {
            id: "12345",
            label: "Remetente salvo",
            phone: "+5548998765432",
            available: true,
            eligible: false,
            quality,
            status: "CONNECTED",
            syncedAt: "2026-11-20T14:00:00Z",
            reason: "quality_not_high",
          },
        ],
        templates: [],
        templatesLoading: false,
        onSenderChange: vi.fn(),
        onSave: vi.fn(),
      }),
    );
    const select = host.querySelector<HTMLSelectElement>(
      '[aria-label="Remetente fixo de WhatsApp"]',
    )!;
    expect(select.value).toBe("12345");
    expect(select.querySelector<HTMLOptionElement>('option[value="12345"]')!.disabled).toBe(true);
    expect(host.textContent).toContain(`Qualidade sincronizada: ${quality ?? "Não confirmada"}`);
    expect(host.textContent).toContain("não está elegível");
    expect(host.textContent).toContain("conferidas novamente antes do envio");
  },
);

const item: NotificationDeliveryHistoryItem = {
  id: "aaaaaaaa-1111-4111-8111-111111111111",
  channel: "whatsapp",
  status: "retry_scheduled",
  reason_code: "provider_rate_limited",
  attempts: 1,
  created_at: "2026-11-20T14:00:00Z",
  updated_at: "2026-11-20T14:00:00Z",
};
const history = {
  canRead: true,
  items: [item],
  filters: { scope: "own" as const, status: "", channel: "whatsapp" },
  canWorkspace: false,
  loading: false,
  hasMore: false,
  loadingMore: false,
  onFilters: vi.fn(),
  onMore: vi.fn(),
  onRetry: vi.fn(),
};
it("shows a provider backoff as scheduled without offering resend", async () => {
  await render(createElement(DeliveryHistoryPanel, history));
  await click("Ver motivo");
  expect(host.textContent).toContain("Nova tentativa agendada");
  expect(host.textContent).toContain("O provedor limitou as requisições");
  expect(
    [...host.querySelectorAll("button")].some((button) =>
      /reenviar/i.test(button.textContent ?? ""),
    ),
  ).toBe(false);
});

it.each(["loading", "error", "channel", "scope"])(
  "clears the selected history detail after %s changes",
  async (change) => {
    await render(createElement(DeliveryHistoryPanel, history));
    await click("Ver motivo");
    expect(host.querySelector('[aria-label="Detalhe da entrega"]')).not.toBeNull();
    await render(
      createElement(DeliveryHistoryPanel, {
        ...history,
        ...(change === "loading" ? { loading: true } : {}),
        ...(change === "error" ? { error: "Consulta indisponível" } : {}),
        ...(change === "channel" ? { filters: { ...history.filters, channel: "email" } } : {}),
        ...(change === "scope"
          ? { filters: { ...history.filters, scope: "workspace" as const }, canWorkspace: true }
          : {}),
      }),
    );
    expect(host.querySelector('[aria-label="Detalhe da entrega"]')).toBeNull();
    await render(createElement(DeliveryHistoryPanel, history));
    expect(host.querySelector('[aria-label="Detalhe da entrega"]')).toBeNull();
  },
);
