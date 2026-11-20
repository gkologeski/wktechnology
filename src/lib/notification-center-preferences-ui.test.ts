// @vitest-environment jsdom
import { act, Children, createElement, Fragment, isValidElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// Keep form edits and validation real, excluding portal/positioning implementation details.
vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
    disabled,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: ReactNode;
    disabled?: boolean;
  }) => {
    const trigger = Children.toArray(children).find(
      (child) =>
        isValidElement(child) && Boolean((child.props as Record<string, unknown>)["aria-label"]),
    );
    return createElement(
      "select",
      {
        value,
        disabled,
        "aria-label": isValidElement(trigger)
          ? (trigger.props as Record<string, string>)["aria-label"]
          : undefined,
        onChange: (event: React.ChangeEvent<HTMLSelectElement>) =>
          onValueChange(event.target.value),
      },
      children,
    );
  },
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => createElement(Fragment, null, children),
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) =>
    createElement("option", { value }, children),
}));
vi.mock("@/components/ui/switch", () => ({
  Switch: ({
    checked,
    onCheckedChange,
    id,
  }: {
    checked: boolean;
    onCheckedChange: (value: boolean) => void;
    id: string;
  }) =>
    createElement("button", {
      id,
      type: "button",
      role: "switch",
      "aria-checked": checked,
      onClick: () => onCheckedChange(!checked),
    }),
}));

import { NotificationPreferencesPanel } from "@/components/notifications/notification-preferences-panel";
import { normalizeNotificationPrefs } from "./notification-preferences";
import { normalizeCenterSettings, type CenterSettings } from "./notification-center-preferences";

let host: HTMLDivElement;
let root: Root;
const save = vi.fn<(patch: unknown, revision: number) => Promise<unknown>>();
let current: CenterSettings;
async function render(settings = current, revision = 7, identity = "user-a/workspace-a") {
  await act(async () =>
    root.render(
      createElement(NotificationPreferencesPanel, {
        key: identity,
        settings,
        revision,
        legacyPrefs: normalizeNotificationPrefs(null),
        onSave: save,
      }),
    ),
  );
}
function control(label: string): HTMLSelectElement {
  const input = host.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`);
  expect(input, label).not.toBeNull();
  return input!;
}
async function choose(label: string, value: string) {
  await act(async () => {
    const select = control(label);
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
async function click(text: string) {
  const button = [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);
  expect(button).toBeDefined();
  await act(async () => button!.click());
}
const saveButton = () =>
  [...host.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
    button.textContent?.includes("Salvar preferências do workspace"),
  )!;
async function submit() {
  await act(async () => {
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}
async function timezone(value: string) {
  const input = host.querySelector<HTMLInputElement>("#center-quiet-timezone")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  current = normalizeCenterSettings(null);
  save.mockReset();
  save.mockResolvedValue({ revision: 8 });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("personal workspace notification settings form", () => {
  it("opens inherited options without saving or materializing defaults", async () => {
    await render();
    expect(control("Menções: Som").value).toBe("inherit");
    expect(control("Menção ou revisão legada: No app").value).toBe("inherit");
    expect(saveButton().disabled).toBe(true);
    expect(save).not.toHaveBeenCalled();
    expect(host.textContent).toContain("nenhum opt-in de WhatsApp");
    expect(host.textContent).toContain("Não agenda nem envia resumo por e-mail ou WhatsApp");
  });
  it("saves just the edited channel and captured revision", async () => {
    await render();
    await choose("Menções: Som", "false");
    await submit();
    expect(save).toHaveBeenCalledExactlyOnceWith({ categories: { mention: { sound: false } } }, 7);
    expect(host.querySelector('[role="status"]')?.textContent).toContain("salvas");
    expect(saveButton().disabled).toBe(true);
  });
  it("restores single-channel inheritance without losing another saved channel", async () => {
    current = normalizeCenterSettings({
      categories: { mention: { sound: false, shake: true, email: false } },
    });
    await render();
    await choose("Menções: Som", "inherit");
    await submit();
    expect(save).toHaveBeenCalledExactlyOnceWith({ categories: { mention: { sound: null } } }, 7);
    expect(control("Menções: Tremor").value).toBe("true");
  });
  it("does not send anything when an edit returns to its inherited initial value", async () => {
    await render();
    await choose("Menções: Som", "false");
    await choose("Menções: Som", "inherit");
    expect(saveButton().disabled).toBe(true);
    await submit();
    expect(save).not.toHaveBeenCalled();
  });
  it("can restore an entire category to inherited preferences", async () => {
    current = normalizeCenterSettings({ categories: { mention: { sound: false, inapp: false } } });
    await render();
    await click("Herdar grupo");
    await submit();
    expect(save).toHaveBeenCalledExactlyOnceWith({ categories: { mention: null } }, 7);
  });
  it("saves an explicit event opt-out and preserves its group", async () => {
    await render();
    await choose("Evento da preferência", "legacy.message");
    await choose("Mensagem ou comentário legado: No app", "false");
    await submit();
    expect(save).toHaveBeenCalledExactlyOnceWith(
      { eventOverrides: { "legacy.message": { inapp: false } } },
      7,
    );
  });
  it("resets only the selected event to group inheritance", async () => {
    current = normalizeCenterSettings({
      eventOverrides: {
        "legacy.message": { inapp: false },
        "legacy.mention": { sound: false },
      },
    });
    await render();
    await choose("Evento da preferência", "legacy.message");
    await click("Herdar opções do evento");
    await submit();
    expect(save).toHaveBeenCalledExactlyOnceWith({ eventOverrides: { "legacy.message": null } }, 7);
  });
  it("lists operational legacy and module events without promising planned producers", async () => {
    await render();
    const options = [...control("Evento da preferência").options].map((item) => item.value);
    expect(options).toContain("legacy.sla.first_response_breach");
    expect(options).toContain("crm.deal.won");
    expect(options).toContain("contracts.contract.renewal_due");
    expect(options).not.toContain("projects.project.started");
  });
  it("saves only an explicit canonical-event sound choice without enabling email or creating a rule", async () => {
    await render();
    await choose("Evento da preferência", "contracts.contract.expiring");
    expect(control("Contrato próximo do vencimento: Som").value).toBe("inherit");
    await choose("Contrato próximo do vencimento: Som", "true");
    await submit();
    expect(save).toHaveBeenCalledExactlyOnceWith(
      { eventOverrides: { "contracts.contract.expiring": { sound: true } } },
      7,
    );
    expect(host.textContent).toContain("não cria avisos");
  });
  it("offers an optional event WhatsApp opt-out without granting consent or changing global channels", async () => {
    await render();
    await choose("Evento da preferência", "contracts.contract.expiring");
    expect(control("Contrato próximo do vencimento: WhatsApp oficial").value).toBe("inherit");
    await choose("Contrato próximo do vencimento: WhatsApp oficial", "false");
    expect(host.textContent).toContain("Preferência: bloquear este canal.");
    await submit();
    expect(save).toHaveBeenCalledExactlyOnceWith(
      { eventOverrides: { "contracts.contract.expiring": { whatsapp: false } } },
      7,
    );
    expect(host.textContent).toContain("não substitui a sua autorização pessoal");
  });
  it("permits restoring WhatsApp event inheritance without resending untouched channel settings", async () => {
    current = normalizeCenterSettings({
      eventOverrides: { "crm.deal.won": { whatsapp: false, sound: false } },
    });
    await render();
    await choose("Evento da preferência", "crm.deal.won");
    await choose("Negócio ganho: WhatsApp oficial", "inherit");
    await submit();
    expect(save).toHaveBeenCalledExactlyOnceWith(
      { eventOverrides: { "crm.deal.won": { whatsapp: null } } },
      7,
    );
  });
  it("saves central grouping separately without queuing an external digest", async () => {
    await render();
    await choose("Agrupamento da central", "weekly");
    await submit();
    expect(save).toHaveBeenCalledExactlyOnceWith({ summary: "weekly" }, 7);
    expect(host.textContent).toContain("os avisos carregados");
  });
  it("saves a complete quiet window and explains which interruptions are silenced", async () => {
    await render();
    await act(async () => host.querySelector<HTMLButtonElement>('[role="switch"]')!.click());
    await choose("Início do silêncio", "21:45");
    await submit();
    expect(save).toHaveBeenCalledExactlyOnceWith(
      {
        quiet: {
          enabled: true,
          timezone: "America/Sao_Paulo",
          start: "21:45",
          end: "08:00",
        },
      },
      7,
    );
    expect(host.textContent).toContain("os prazos continuam correndo");
  });
  it("shows validation failure without losing an invalid timezone draft", async () => {
    await render();
    await timezone("invalid");
    await submit();
    expect(save).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("fuso horário");
    expect(host.querySelector<HTMLInputElement>("#center-quiet-timezone")!.value).toBe("invalid");
  });
  it("rejects equal enabled boundaries before saving", async () => {
    await render();
    await act(async () => host.querySelector<HTMLButtonElement>('[role="switch"]')!.click());
    await choose("Fim do silêncio", "22:00");
    await submit();
    expect(save).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("diferentes");
  });
  it("keeps the draft and reports a server/CAS failure honestly", async () => {
    save.mockRejectedValue(new Error("Outra sessão alterou a revisão. Recarregue."));
    await render();
    await choose("Menções: Som", "false");
    await submit();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Outra sessão");
    expect(host.querySelector('[role="status"]')).toBeNull();
    expect(control("Menções: Som").value).toBe("false");
    expect(saveButton().disabled).toBe(false);
  });
  it("disables saving while the request is pending without a premature success message", async () => {
    let finish!: () => void;
    save.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ revision: 8 });
        }),
    );
    await render();
    await choose("Menções: Som", "false");
    await act(async () => {
      host
        .querySelector("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(saveButton().disabled).toBe(true);
    expect(host.querySelector('[role="status"]')).toBeNull();
    await act(async () => finish());
    expect(host.querySelector('[role="status"]')?.textContent).toContain("salvas");
  });
  it("replaces the draft only when the authoritative revision changes", async () => {
    await render();
    await choose("Menções: Som", "false");
    await render(structuredClone(current), 7);
    expect(control("Menções: Som").value).toBe("false");
    await render(normalizeCenterSettings({ categories: { mention: { sound: true } } }), 8);
    expect(control("Menções: Som").value).toBe("true");
    expect(saveButton().disabled).toBe(true);
  });
  it("discards identity-scoped draft/error when the parent workspace/user key changes", async () => {
    await render();
    await choose("Menções: Som", "false");
    await render(normalizeCenterSettings(null), 7, "user-a/workspace-b");
    expect(control("Menções: Som").value).toBe("inherit");
    expect(saveButton().disabled).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });
});
