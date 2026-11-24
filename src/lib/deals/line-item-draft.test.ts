import { describe, expect, it } from "vitest";
import {
  clearItemDraft,
  draftStorageKey,
  hasDraftEntries,
  mergeItemWithDraft,
  readLineItemDrafts,
  reconcileDraftsWithItems,
  setItemDraftField,
  writeLineItemDrafts,
  type StorageLike,
} from "./line-item-draft";

function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe("rascunho local de itens de linha", () => {
  it("grava e restaura por usuário e negócio", () => {
    const storage = memoryStorage();
    let drafts = setItemDraftField({}, "item-1", { name: "Consultoria Sênior", quantity: 120 });
    drafts = setItemDraftField(drafts, "item-1", { unit_price: 250 });
    writeLineItemDrafts(storage, "user-a", "deal-1", drafts);

    expect(readLineItemDrafts(storage, "user-a", "deal-1")).toEqual({
      "item-1": { name: "Consultoria Sênior", quantity: 120, unit_price: 250 },
    });
    expect(readLineItemDrafts(storage, "user-b", "deal-1")).toEqual({});
    expect(readLineItemDrafts(storage, "user-a", "deal-2")).toEqual({});
  });

  it("limpa os campos gravados após sucesso e remove a chave quando fica vazia", () => {
    const storage = memoryStorage();
    const drafts = setItemDraftField({}, "item-1", { name: "Novo nome", quantity: 10 });
    writeLineItemDrafts(storage, "user-a", "deal-1", drafts);

    const partial = clearItemDraft(drafts, "item-1", { name: "Novo nome" });
    expect(partial).toEqual({ "item-1": { quantity: 10 } });

    const empty = clearItemDraft(partial, "item-1", { quantity: 10 });
    expect(hasDraftEntries(empty)).toBe(false);
    writeLineItemDrafts(storage, "user-a", "deal-1", empty);
    expect(storage.getItem(draftStorageKey("user-a", "deal-1"))).toBeNull();
  });

  it("mantém o rascunho quando a gravação falha (sem limpar) e mescla na exibição", () => {
    const storage = memoryStorage();
    const drafts = setItemDraftField({}, "item-1", { unit_price: 4500 });
    writeLineItemDrafts(storage, "user-a", "deal-1", drafts);

    const saved = { id: "item-1", name: "Item", unit_price: 3000 };
    const merged = mergeItemWithDraft(saved, readLineItemDrafts(storage, "user-a", "deal-1"));
    expect(merged.unit_price).toBe(4500);
  });

  it("reconcilia descartando itens removidos e valores já salvos no servidor", () => {
    const drafts = {
      "item-1": { name: "Já salvo", quantity: 5 },
      "item-removido": { name: "Órfão" },
    };
    const reconciled = reconcileDraftsWithItems(drafts, [
      { id: "item-1", name: "Já salvo", quantity: 1 },
    ]);
    expect(reconciled).toEqual({ "item-1": { quantity: 5 } });
  });
});
