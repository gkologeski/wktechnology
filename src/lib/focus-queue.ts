// Ephemeral "focus queue" — percorre uma lista de registros (empresas, contatos,
// leads, deals) um a um, igual ao "Start queue" do HubSpot.
// Estado fica em sessionStorage; sobrevive a recarregar a aba, some ao fechar.

export type FocusEntity = "companies" | "contacts" | "leads" | "deals";

const KEY = "focus-queue:v1";

export type FocusQueue = {
  entity: FocusEntity;
  ids: string[];
  index: number;
  label: string;
  startedAt: number;
};

const ROUTE_BY_ENTITY: Record<FocusEntity, string> = {
  companies: "/companies",
  contacts: "/contacts",
  leads: "/leads",
  deals: "/deals",
};

export function getFocusQueue(): FocusQueue | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const q = JSON.parse(raw) as FocusQueue;
    if (!q?.ids?.length || q.index >= q.ids.length) return null;
    return q;
  } catch {
    return null;
  }
}

export function startFocusQueue(
  entity: FocusEntity,
  ids: string[],
  label = "Fila",
): FocusQueue | null {
  if (typeof window === "undefined" || ids.length === 0) return null;
  const q: FocusQueue = { entity, ids, index: 0, label, startedAt: Date.now() };
  sessionStorage.setItem(KEY, JSON.stringify(q));
  return q;
}

export function clearFocusQueue() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
}

export function advanceFocusQueue(): FocusQueue | null {
  const q = getFocusQueue();
  if (!q) return null;
  const next = { ...q, index: q.index + 1 };
  if (next.index >= next.ids.length) {
    clearFocusQueue();
    return null;
  }
  sessionStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function previousFocusQueue(): FocusQueue | null {
  const q = getFocusQueue();
  if (!q || q.index === 0) return q;
  const prev = { ...q, index: q.index - 1 };
  sessionStorage.setItem(KEY, JSON.stringify(prev));
  return prev;
}

export function routeForEntity(entity: FocusEntity): string {
  return ROUTE_BY_ENTITY[entity];
}
