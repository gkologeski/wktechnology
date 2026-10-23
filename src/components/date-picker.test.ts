// @vitest-environment jsdom
/**
 * Comportamento do seletor de data única (skill date-picker-br), renderizado
 * de verdade: atalhos, "Personalizado" que não altera, limites, limpar,
 * required/disabled e adaptador "YYYY-MM-DD".
 */
import { createElement, useState } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { DatePicker } from "./date-picker";
import {
  calendarNavigationBounds,
  YEAR_WINDOW_AHEAD,
  YEAR_WINDOW_BACK,
} from "@/lib/date-picker-rules";
import { IsoDatePicker } from "./iso-date-picker";
import { formatIsoDate } from "@/lib/iso-date";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(() => {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
});

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

function render(el: ReturnType<typeof createElement>) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(el));
}
const trigger = () => host!.querySelector("button") as HTMLButtonElement;
const open = () => act(() => trigger().click());
const panelButton = (label: string) =>
  [...document.querySelectorAll("[role=group] button")].find(
    (b) => b.textContent?.trim() === label,
  ) as HTMLButtonElement | undefined;
const isOpen = () => !!document.querySelector("[role=group][aria-label='Atalhos de data']");

describe("DatePicker", () => {
  it("mostra dd/MM/yyyy e abre com os atalhos na ordem da skill", () => {
    render(createElement(DatePicker, { value: new Date(2026, 1, 5), onChange: () => {} }));
    expect(trigger().textContent).toContain("05/02/2026");
    open();
    const labels = [...document.querySelectorAll("[role=group] button")].map((b) =>
      b.textContent?.trim(),
    );
    expect(labels).toEqual(["Personalizado", "Ontem", "Hoje", "Amanhã"]);
  });

  it("Personalizado não altera o valor e mantém aberto; Hoje aplica e fecha", () => {
    const onChange = vi.fn();
    render(createElement(DatePicker, { onChange }));
    open();
    act(() => panelButton("Personalizado")!.click());
    expect(onChange).not.toHaveBeenCalled();
    expect(isOpen()).toBe(true);
    act(() => panelButton("Hoje")!.click());
    expect(onChange).toHaveBeenCalledTimes(1);
    const d = onChange.mock.calls[0][0] as Date;
    expect(d.getHours()).toBe(0);
    expect(formatIsoDate(d)).toBe(formatIsoDate(new Date()));
    expect(isOpen()).toBe(false);
  });

  it("um clique no calendário escolhe o dia e fecha", () => {
    const onChange = vi.fn();
    render(createElement(DatePicker, { value: new Date(2026, 1, 5), onChange }));
    open();
    const day = [...document.querySelectorAll("button[data-day]")].find(
      (b) =>
        (b as HTMLButtonElement).dataset.day?.includes("2026-02-10") ||
        b.getAttribute("data-day") === new Date(2026, 1, 10).toLocaleDateString(),
    ) as HTMLButtonElement | undefined;
    const fallback = [...document.querySelectorAll("button")].find(
      (b) => b.textContent === "10" && !b.closest("[role=group]"),
    ) as HTMLButtonElement;
    act(() => (day ?? fallback).click());
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(formatIsoDate(onChange.mock.calls[0][0] as Date)).toBe("2026-02-10");
    expect(isOpen()).toBe(false);
  });

  it("campo vazio não recebe Hoje sozinho e 'Limpar' só aparece com onClear", () => {
    const onChange = vi.fn();
    render(createElement(DatePicker, { onChange }));
    expect(onChange).not.toHaveBeenCalled();
    expect(trigger().textContent).toContain("Selecionar data");
    open();
    expect(panelButton("Limpar")).toBeUndefined();
  });

  it("atalhos fora de min/max ficam desativados", () => {
    const today = new Date();
    render(
      createElement(DatePicker, {
        onChange: () => {},
        min: today,
        max: today,
      }),
    );
    open();
    expect(panelButton("Ontem")!.disabled).toBe(true);
    expect(panelButton("Amanhã")!.disabled).toBe(true);
    expect(panelButton("Hoje")!.disabled).toBe(false);
    expect(panelButton("Personalizado")!.disabled).toBe(false);
  });

  it("disabled não abre; aria-required/aria-invalid no gatilho", () => {
    render(
      createElement(DatePicker, {
        onChange: () => {},
        disabled: true,
        required: true,
        invalid: true,
      }),
    );
    expect(trigger().disabled).toBe(true);
    expect(trigger().getAttribute("aria-required")).toBe("true");
    expect(trigger().getAttribute("aria-invalid")).toBe("true");
  });
});

describe("IsoDatePicker", () => {
  it("lê e devolve YYYY-MM-DD local", () => {
    const onChange = vi.fn();
    render(createElement(IsoDatePicker, { value: "2024-02-29", onChange }));
    expect(trigger().textContent).toContain("29/02/2024");
    open();
    act(() => panelButton("Hoje")!.click());
    expect(onChange).toHaveBeenCalledWith(formatIsoDate(new Date()));
  });

  it("data impossível aparece vazia (não vira 03/03)", () => {
    render(createElement(IsoDatePicker, { value: "2026-02-31", onChange: () => {} }));
    expect(trigger().textContent).toContain("Selecionar data");
  });

  it("opcional com valor oferece Limpar → null; obrigatório não", () => {
    const onChange = vi.fn();
    render(createElement(IsoDatePicker, { value: "2026-10-23", onChange }));
    open();
    act(() => panelButton("Limpar")!.click());
    expect(onChange).toHaveBeenCalledWith(null);
    act(() => root!.unmount());
    host!.remove();
    render(createElement(IsoDatePicker, { value: "2026-10-23", onChange, required: true }));
    open();
    expect(panelButton("Limpar")).toBeUndefined();
  });

  it("id para <Label htmlFor> fica no gatilho", () => {
    render(createElement(IsoDatePicker, { id: "venc", value: "", onChange: () => {} }));
    expect(trigger().id).toBe("venc");
  });
});

/* ---------------- Formulário (bloqueio nativo do obrigatório) ---------------- */

function FormFixture({
  initial = "",
  required = true,
  onSubmit,
}: {
  initial?: string;
  required?: boolean;
  onSubmit: (data: FormData) => void;
}) {
  const [v, setV] = useState<string | null>(initial);
  return createElement(
    "form",
    {
      onSubmit: (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      },
    },
    createElement(IsoDatePicker, { name: "venc", required, value: v, onChange: setV }),
    createElement("button", { type: "submit" }, "Enviar"),
  );
}
const flush = () => act(() => new Promise((r) => setTimeout(r, 10)));

describe("DatePicker em <form>", () => {
  it("obrigatório vazio não é válido, não envia, foca o campo e anuncia o erro", async () => {
    const onSubmit = vi.fn();
    render(createElement(FormFixture, { onSubmit }));
    await flush();
    const form = host!.querySelector("form")!;
    expect(form.checkValidity()).toBe(false);
    act(() => form.requestSubmit());
    await flush();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger());
    expect(trigger().getAttribute("aria-invalid")).toBe("true");
    const alert = document.querySelector("[role=alert]");
    expect(alert?.textContent).toBe("Informe a data.");
    expect(trigger().getAttribute("aria-describedby")).toContain(alert!.id);
    expect(trigger().textContent).toContain("Informe a data.");
  });

  it("após escolher, envia com o nome e 'YYYY-MM-DD' no FormData e limpa o erro", async () => {
    const onSubmit = vi.fn();
    render(createElement(FormFixture, { onSubmit }));
    await flush();
    const form = host!.querySelector("form")!;
    act(() => form.requestSubmit());
    await flush();
    open();
    act(() => panelButton("Hoje")!.click());
    await flush();
    expect(form.checkValidity()).toBe(true);
    expect(trigger().getAttribute("aria-invalid")).toBeNull();
    act(() => form.requestSubmit());
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect((onSubmit.mock.calls[0][0] as FormData).get("venc")).toBe(formatIsoDate(new Date()));
  });

  it("opcional vazio envia campo vazio (como o input nativo)", async () => {
    const onSubmit = vi.fn();
    render(createElement(FormFixture, { onSubmit, required: false }));
    await flush();
    act(() => host!.querySelector("form")!.requestSubmit());
    expect((onSubmit.mock.calls[0][0] as FormData).get("venc")).toBe("");
  });

  it("valor salvo fora de min/max bloqueia o envio, sem alterar o valor", async () => {
    const onSubmit = vi.fn();
    const onChange = vi.fn();
    render(
      createElement(
        "form",
        { onSubmit: (e: React.FormEvent) => (e.preventDefault(), onSubmit()) },
        createElement(IsoDatePicker, {
          name: "ate",
          value: "2020-01-01",
          min: "2026-01-01",
          onChange,
        }),
      ),
    );
    await flush();
    const form = host!.querySelector("form")!;
    act(() => form.requestSubmit());
    await flush();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(document.querySelector("[role=alert]")?.textContent).toBe(
      "Data fora do período permitido.",
    );
  });

  it("DatePicker obrigatório nunca oferece Limpar, mesmo com onClear", () => {
    render(
      createElement(DatePicker, {
        value: new Date(2026, 9, 23),
        onChange: () => {},
        onClear: () => {},
        required: true,
      }),
    );
    open();
    expect(panelButton("Limpar")).toBeUndefined();
  });

  it("data impossível salva não é apagada por efeito ao montar", async () => {
    const onChange = vi.fn();
    render(createElement(IsoDatePicker, { value: "2026-02-31", onChange }));
    await flush();
    expect(onChange).not.toHaveBeenCalled();
  });
});

/* ---------------- Datas distantes (sem limite global novo) ---------------- */

const yearSelect = () =>
  [...document.querySelectorAll("[role=dialog] select")].at(-1) as HTMLSelectElement;
const nextMonth = () =>
  document.querySelector("[role=dialog] .rdp-button_next") as HTMLButtonElement;
const prevMonth = () =>
  document.querySelector("[role=dialog] .rdp-button_previous") as HTMLButtonElement;

describe("DatePicker com datas distantes", () => {
  it("valor 1880 abre em 1880 e o ano atual continua na lista", () => {
    render(createElement(IsoDatePicker, { value: "1880-05-10", onChange: () => {} }));
    expect(trigger().textContent).toContain("10/05/1880");
    open();
    expect(yearSelect().value).toBe("1880");
    const years = [...yearSelect().options].map((o) => o.value);
    expect(years).toContain(String(new Date().getFullYear()));
    expect(prevMonth().getAttribute("aria-disabled")).not.toBe("true");
  });

  it("valor 2200 abre em 2200 e navega para 2201 (sem teto global)", () => {
    render(createElement(IsoDatePicker, { value: "2200-12-15", onChange: () => {} }));
    open();
    expect(yearSelect().value).toBe("2200");
    act(() => nextMonth().click());
    expect(yearSelect().value).toBe("2201");
    expect(nextMonth().getAttribute("aria-disabled")).not.toBe("true");
  });

  it("min/max reais limitam a navegação", () => {
    render(
      createElement(IsoDatePicker, {
        value: "2026-10-10",
        min: "2026-10-01",
        max: "2026-10-31",
        onChange: () => {},
      }),
    );
    open();
    const off = (b: HTMLButtonElement) => b.disabled || b.getAttribute("aria-disabled") === "true";
    expect(off(nextMonth())).toBe(true);
    expect(off(prevMonth())).toBe(true);
    act(() => nextMonth().click());
    expect(yearSelect().value).toBe("2026");
    expect([...yearSelect().options].map((o) => o.value)).toEqual(["2026"]);
  });

  it("janela de anos acompanha o mês exibido e o valor", () => {
    const now = new Date(2026, 9, 23);
    const b = calendarNavigationBounds(new Date(2200, 0, 1), { value: new Date(1880, 0, 1), now });
    expect(b.startMonth.getFullYear()).toBe(1880 - YEAR_WINDOW_BACK);
    expect(b.endMonth.getFullYear()).toBe(2200 + YEAR_WINDOW_AHEAD);
    const lim = calendarNavigationBounds(now, {
      min: new Date(2026, 0, 1),
      max: new Date(2026, 11, 31),
      now,
    });
    expect(lim.startMonth).toEqual(new Date(2026, 0, 1));
    expect(lim.endMonth).toEqual(new Date(2026, 11, 31));
  });
});
