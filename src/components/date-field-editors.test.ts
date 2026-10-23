// @vitest-environment jsdom
/**
 * Editores dinâmicos que antes caíam em `<input type="date">` por metadado
 * (lacunas da revisão de a0056dbb8): filtro avançado, edição em massa e o
 * auxiliar `nativeInputType`. Renderização real, sem banco (cliente
 * simulado): nenhum dado é gravado.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { formatIsoDate } from "@/lib/iso-date";
import { nativeInputType } from "@/lib/native-input-type";

const updates: Record<string, unknown>[] = [];
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      update: (payload: Record<string, unknown>) => {
        updates.push(payload);
        return { in: () => ({ select: async () => ({ data: [{ id: "a" }], error: null }) }) };
      },
    }),
  },
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import { FilterBuilderDialog } from "./filter-builder-dialog";
import { BulkEditDialog } from "./bulk-edit-dialog";

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
  updates.length = 0;
});
function render(el: ReturnType<typeof createElement>) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(el));
}
const byLabel = (prefix: string) =>
  [...document.querySelectorAll("button[aria-label]")].find((b) =>
    b.getAttribute("aria-label")!.startsWith(prefix),
  ) as HTMLButtonElement | undefined;
const preset = (label: string) =>
  [...document.querySelectorAll("[role=group][aria-label='Atalhos de data'] button")].find(
    (b) => b.textContent?.trim() === label,
  ) as HTMLButtonElement;
const buttonText = (t: string) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === t)!;

describe("FilterBuilderDialog", () => {
  it("condição de campo data usa o seletor padrão e devolve YYYY-MM-DD", () => {
    const onApply = vi.fn();
    render(
      createElement(FilterBuilderDialog, {
        open: true,
        setOpen: () => {},
        fields: [{ name: "created_at", label: "Criado em", type: "date" }],
        value: {
          type: "group",
          op: "and",
          conditions: [{ type: "condition", field: "created_at", op: "gte", value: "" }],
        },
        onApply,
      }),
    );
    expect(document.querySelector("input[type=date]")).toBeNull();
    const picker = byLabel("Criado em: data")!;
    expect(picker).toBeTruthy();
    act(() => picker.click());
    act(() => preset("Hoje").click());
    act(() => buttonText("Aplicar").click());
    const g = onApply.mock.calls[0][0];
    expect(g.conditions[0].value).toBe(formatIsoDate(new Date()));
  });
});

describe("BulkEditDialog", () => {
  it("campo data usa o seletor padrão e grava YYYY-MM-DD local", async () => {
    render(
      createElement(BulkEditDialog, {
        open: true,
        setOpen: () => {},
        table: "customer_invoices",
        ids: ["a"],
        fields: [{ name: "due_date", label: "Vencimento", type: "date" }],
        onDone: () => {},
      }),
    );
    const enable = document.getElementById("en-due_date") as HTMLButtonElement;
    act(() => enable.click());
    expect(document.querySelector("input[type=date]")).toBeNull();
    const picker = byLabel("Vencimento")!;
    act(() => picker.click());
    act(() => preset("Amanhã").click());
    await act(async () => {
      buttonText("Aplicar").click();
      await new Promise((r) => setTimeout(r, 5));
    });
    const d = new Date();
    d.setDate(d.getDate() + 1);
    expect(updates).toEqual([{ due_date: formatIsoDate(d) }]);
  });
});

describe("nativeInputType", () => {
  it("nunca devolve tipo de data e preserva tipos de texto", () => {
    expect(nativeInputType("email")).toBe("email");
    expect(nativeInputType("number")).toBe("number");
    expect(nativeInputType("tel")).toBe("tel");
    expect(nativeInputType(undefined)).toBe("text");
    expect(nativeInputType("textarea")).toBe("text");
    const wide: string = "date";
    expect(nativeInputType(wide)).toBe("text");
    const wide2: string = "datetime-local";
    expect(nativeInputType(wide2)).toBe("text");
  });

  it("no tipo, exige tratar a data antes", () => {
    const t = "date" as "date" | "text";
    // @ts-expect-error — a união ainda contém "date": falta o ramo IsoDatePicker.
    nativeInputType(t);
    if (t !== "date") expect(nativeInputType(t)).toBe("text");
  });
});

/* ---------------- Formulário público (fixture local, nada enviado) ---------------- */

import { FormRenderer } from "./surveys/form/form-renderer";
import type { FormSchema } from "@/lib/surveys/form-schema";

describe("FormRenderer (formulário público) com data e data-hora", () => {
  it("usa os seletores padrão, sem input nativo, e grava YYYY-MM-DD", () => {
    const schema: FormSchema = {
      version: 1,
      title: "Fixture",
      scoringEnabled: false,
      fields: [
        { id: "nasc", type: "date", label: "Nascimento", required: true },
        { id: "quando", type: "datetime", label: "Quando" },
      ],
    };
    let answers: Record<string, unknown> = {};
    const onChange = vi.fn((a: Record<string, unknown>) => (answers = a));
    render(
      createElement(FormRenderer, {
        schema,
        answers,
        onChange,
        paginate: false,
      }),
    );
    expect(document.querySelector("input[type=date],input[type=datetime-local]")).toBeNull();
    const triggers = [...document.querySelectorAll("button[aria-haspopup=dialog]")];
    const trigger = triggers[0] as HTMLButtonElement;
    expect(trigger.disabled).toBe(false);
    act(() => (trigger as HTMLButtonElement).click());
    act(() => preset("Hoje").click());
    expect(answers.nasc).toBe(formatIsoDate(new Date()));
    // Data-hora: botão de dia do ActivityDateTimePicker (mesmo painel).
    expect(document.querySelector("[aria-label$=': data']")).toBeTruthy();
  });
});
