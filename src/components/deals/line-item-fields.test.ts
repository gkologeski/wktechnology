// @vitest-environment jsdom
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearItemDraft,
  hasDraftEntries,
  mergeItemWithDraft,
  readLineItemDrafts,
  setItemDraftField,
  writeLineItemDrafts,
  type LineItemDraftMap,
} from "@/lib/deals/line-item-draft";
import { DiscountField, LabeledNumber } from "./line-item-fields";

vi.mock("./use-line-items", () => ({
  n: (value: unknown) => Number(value) || 0,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
let host: HTMLDivElement | undefined;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  localStorage.clear();
});

function editor(field: "discount_pct" | "quantity" | "tax_rate" | "percent", initial = 10) {
  let saved = { id: "item-1", [field]: initial };
  let drafts: LineItemDraftMap = {};
  const persist = vi.fn((value: number) => {
    saved = { ...saved, [field]: value };
    drafts = clearItemDraft(drafts, saved.id, { [field]: value });
    writeLineItemDrafts(localStorage, "user-1", "deal-1", drafts);
  });
  function Harness() {
    const [, rerender] = useState(0);
    const changed = () => rerender((count) => count + 1);
    const onDraft = (value: number) => {
      drafts = setItemDraftField(drafts, saved.id, { [field]: value });
      writeLineItemDrafts(localStorage, "user-1", "deal-1", drafts);
      changed();
    };
    const commit = (value: number) => {
      persist(value);
      changed();
    };
    const value = Number(mergeItemWithDraft(saved, drafts)[field]);
    return createElement(
      "div",
      null,
      field === "discount_pct"
        ? createElement(DiscountField, {
            currency: "BRL",
            discountType: "pct",
            discountPct: value,
            discountAmount: 0,
            committedPct: Number(saved[field]),
            onChangeType: () => {},
            onCommitPct: commit,
            onCommitAmount: () => {},
            onDraftPct: onDraft,
          })
        : createElement(LabeledNumber, {
            label: field,
            value,
            committedValue: Number(saved[field]),
            onCommit: commit,
            onDraftChange: onDraft,
          }),
      createElement(
        "button",
        {
          onClick: () => {
            for (const patch of Object.values(drafts)) persist(Number(patch[field]));
            changed();
          },
        },
        "Concluído",
      ),
    );
  }
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root?.render(createElement(Harness)));
  const input = host.querySelector("input");
  const done = host.querySelector(":scope > div > button");
  if (!(input instanceof HTMLInputElement) || !(done instanceof HTMLButtonElement)) {
    throw new Error("Editor não renderizou os controles");
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("Setter nativo indisponível");
  const type = (value: string) => {
    act(() => {
      setter?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  return { input, done, type, persist, saved: () => saved, drafts: () => drafts };
}

describe("apagar números nos itens de linha", () => {
  it.each(["discount_pct", "quantity", "tax_rate", "percent"] as const)(
    "%s não restaura nem grava o dígito anterior após limpar e concluir",
    (field) => {
      const e = editor(field);
      act(() => e.input.focus());
      e.type("1");
      e.type("");
      expect(e.drafts()).toEqual({ "item-1": { [field]: 0 } });
      expect(readLineItemDrafts(localStorage, "user-1", "deal-1")).toEqual(e.drafts());
      act(() => e.input.blur());
      expect(e.input.value).toBe("0");
      act(() => e.done.click());
      expect(e.saved()[field]).toBe(0);
      expect(e.persist).toHaveBeenCalledExactlyOnceWith(0);
      expect(hasDraftEntries(e.drafts())).toBe(false);
      expect(readLineItemDrafts(localStorage, "user-1", "deal-1")).toEqual({});
    },
  );

  it("limpar após editar um desconto originalmente zero não grava o dígito intermediário", () => {
    const e = editor("discount_pct", 0);
    act(() => e.input.focus());
    e.type("10");
    e.type("1");
    e.type("");
    act(() => e.input.blur());
    act(() => e.done.click());
    expect(e.saved()["discount_pct"]).toBe(0);
    expect(e.persist).toHaveBeenCalledExactlyOnceWith(0);
    expect(e.drafts()).toEqual({});
  });
});
