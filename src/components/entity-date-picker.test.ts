// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { EntityDatePicker } from "./entity-date-picker";
import { coerceBulkValue } from "@/lib/grid/bulk-edit-fields";
import { fieldDateKind } from "@/lib/field-date-kind";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
});
let root: Root;
let host: HTMLDivElement;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});
function render(props: Parameters<typeof EntityDatePicker>[0], inForm = false) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  const field = createElement(EntityDatePicker, props);
  act(() => root.render(inForm ? createElement("form", null, field) : field));
}
function dayTrigger() {
  return host.querySelector("button") as HTMLButtonElement;
}
function preset(text: string) {
  return [...document.querySelectorAll("[aria-label='Atalhos de data'] button")].find(
    (b) => b.textContent === text,
  ) as HTMLButtonElement;
}

describe("SQL catalogue date editors", () => {
  it("uses SQL metadata, never the column name, and fails closed without metadata", () => {
    expect(fieldDateKind("date")).toBe("date");
    expect(fieldDateKind("timestamp with time zone")).toBe("timestamp");
    expect(fieldDateKind("timestamp without time zone")).toBe("timestamp");
    render({ field: { label: "Data" }, value: "2026-10-23T18:37:00Z", onChange: vi.fn() });
    expect(dayTrigger().disabled).toBe(true);
  });
  it("a date column stays a calendar day and submits YYYY-MM-DD", () => {
    render(
      {
        field: { label: "Dia", dataType: "date" },
        name: "day",
        value: "2026-10-23",
        onChange: vi.fn(),
      },
      true,
    );
    expect(dayTrigger().textContent).toContain("23/10/2026");
    expect(new FormData(host.querySelector("form")!).get("day")).toBe("2026-10-23");
    expect(coerceBulkValue("day", "date", "2026-10-23")).toBe("2026-10-23");
  });
  it("changing only the day preserves local hour/minute and serializes the same instant contract", () => {
    const original = "2026-10-23T18:37:00.000Z";
    const originalDate = new Date(original);
    const changed = vi.fn();
    render(
      {
        field: { label: "Prazo", dataType: "timestamp with time zone" },
        value: original,
        name: "due",
        onChange: changed,
      },
      true,
    );
    expect(new FormData(host.querySelector("form")!).get("due")).toBe(original);
    act(() => dayTrigger().click());
    const day = [...document.querySelectorAll<HTMLButtonElement>("button[data-day]")].find(
      (b) => b.getAttribute("data-day") === new Date(2026, 9, 24).toLocaleDateString(),
    )!;
    expect(day).toBeTruthy();
    act(() => day.click());
    const expected = new Date(
      2026,
      9,
      24,
      originalDate.getHours(),
      originalDate.getMinutes(),
    ).toISOString();
    expect(changed).toHaveBeenCalledWith(expected);
    expect(coerceBulkValue("due", "timestamp with time zone", expected)).toBe(expected);
  });
  it("keeps timestamp without time zone local", () => {
    const changed = vi.fn();
    render({
      field: { label: "Horário", dataType: "timestamp without time zone" },
      value: "2026-10-23T15:37",
      onChange: changed,
    });
    act(() => dayTrigger().click());
    const day = [...document.querySelectorAll<HTMLButtonElement>("button[data-day]")].find(
      (b) => b.getAttribute("data-day") === new Date(2026, 9, 24).toLocaleDateString(),
    )!;
    act(() => day.click());
    expect(changed).toHaveBeenCalledWith("2026-10-24T15:37");
    expect(coerceBulkValue("local", "timestamp without time zone", "2026-10-24T15:37")).toBe(
      "2026-10-24T15:37",
    );
  });
  it("rejects a day-only value for timestamps instead of inventing midnight", () => {
    expect(() => coerceBulkValue("due", "timestamp with time zone", "2026-10-23")).toThrow();
    expect(() => coerceBulkValue("due", "timestamp with time zone", "2026-10-23T15:37")).toThrow();
    expect(() => coerceBulkValue("day", "date", "2026-02-31")).toThrow();
  });
  it("required timestamp empty really invalidates the form", () => {
    render(
      {
        field: { label: "Prazo", dataType: "timestamp with time zone", required: true },
        value: null,
        onChange: vi.fn(),
      },
      true,
    );
    let valid = true;
    act(() => {
      valid = host.querySelector("form")!.checkValidity();
    });
    expect(valid).toBe(false);
  });
  it("clearing an optional timestamp emits null", () => {
    const changed = vi.fn();
    render({
      field: { label: "Prazo", dataType: "timestamp with time zone" },
      value: "2026-10-23T18:37:00Z",
      onChange: changed,
    });
    act(() => dayTrigger().click());
    act(() => preset("Limpar").click());
    expect(changed).toHaveBeenCalledWith(null);
    expect(coerceBulkValue("due", "timestamp with time zone", null)).toBeNull();
  });
});
