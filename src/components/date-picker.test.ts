// @vitest-environment jsdom
/**
 * Comportamento do seletor de data única (skill date-picker-br), renderizado
 * de verdade: atalhos, "Personalizado" que não altera, limites, limpar,
 * required/disabled e adaptador "YYYY-MM-DD".
 */
import { createElement } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { DatePicker } from "./date-picker";
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
