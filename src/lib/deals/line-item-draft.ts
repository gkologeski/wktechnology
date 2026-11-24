export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type LineItemDraftPatch = Record<string, unknown>;
export type LineItemDraftMap = Record<string, LineItemDraftPatch>;

export function draftStorageKey(userId: string, dealId: string): string {
  return `deal-line-items-draft:${userId}:${dealId}`;
}

export function getBrowserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readLineItemDrafts(
  storage: StorageLike | null,
  userId: string | null | undefined,
  dealId: string,
): LineItemDraftMap {
  if (!storage || !userId || !dealId) return {};
  try {
    const raw = storage.getItem(draftStorageKey(userId, dealId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: LineItemDraftMap = {};
    for (const [id, patch] of Object.entries(parsed as Record<string, unknown>)) {
      if (patch && typeof patch === "object" && !Array.isArray(patch)) {
        const entries = Object.entries(patch as Record<string, unknown>);
        if (entries.length > 0) out[id] = Object.fromEntries(entries);
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function writeLineItemDrafts(
  storage: StorageLike | null,
  userId: string | null | undefined,
  dealId: string,
  drafts: LineItemDraftMap,
): void {
  if (!storage || !userId || !dealId) return;
  const key = draftStorageKey(userId, dealId);
  try {
    if (!hasDraftEntries(drafts)) {
      storage.removeItem(key);
    } else {
      storage.setItem(key, JSON.stringify(drafts));
    }
  } catch {
    // Ignora quota/storage indisponível: o estado em memória segue funcionando.
  }
}

export function hasDraftEntries(drafts: LineItemDraftMap): boolean {
  return Object.values(drafts).some((p) => Object.keys(p).length > 0);
}

export function setItemDraftField(
  drafts: LineItemDraftMap,
  itemId: string,
  patch: LineItemDraftPatch,
): LineItemDraftMap {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return drafts;
  const prev = drafts[itemId] ?? {};
  return {
    ...drafts,
    [itemId]: { ...prev, ...Object.fromEntries(entries) },
  };
}

export function clearItemDraft(
  drafts: LineItemDraftMap,
  itemId: string,
  committedPatch?: LineItemDraftPatch,
): LineItemDraftMap {
  const current = drafts[itemId];
  if (!current) return drafts;
  const next: LineItemDraftMap = { ...drafts };
  if (!committedPatch) {
    delete next[itemId];
    return next;
  }
  const remaining: LineItemDraftPatch = {};
  for (const [k, v] of Object.entries(current)) {
    if (!(k in committedPatch) || committedPatch[k] !== v) {
      remaining[k] = v;
    }
  }
  if (Object.keys(remaining).length === 0) {
    delete next[itemId];
  } else {
    next[itemId] = remaining;
  }
  return next;
}

/** Remove rascunhos de itens apagados ou cujo valor já coincide com o salvo. */
export function reconcileDraftsWithItems<T extends { id: string }>(
  drafts: LineItemDraftMap,
  items: readonly T[],
): LineItemDraftMap {
  const byId = new Map(items.map((it) => [it.id, it as Record<string, unknown>]));
  const out: LineItemDraftMap = {};
  for (const [id, patch] of Object.entries(drafts)) {
    const saved = byId.get(id);
    if (!saved) continue;
    const diff: LineItemDraftPatch = {};
    for (const [k, v] of Object.entries(patch)) {
      if (saved[k] !== v) diff[k] = v;
    }
    if (Object.keys(diff).length > 0) out[id] = diff;
  }
  return out;
}

export function mergeItemWithDraft<T extends { id: string }>(item: T, drafts: LineItemDraftMap): T {
  const patch = drafts[item.id];
  if (!patch) return item;
  return { ...item, ...patch };
}
