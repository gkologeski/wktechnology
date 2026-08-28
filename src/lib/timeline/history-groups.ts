// Agrupamento das alterações de propriedade em eventos de timeline.
// Alterações gravadas pelo mesmo usuário na mesma janela de tempo (mesmo
// UPDATE) viram um único card, igual ao HubSpot.

import { MOVEMENT_PROPERTIES } from "@/lib/timeline/property-labels";

export type PropertyChangeRow = {
  id: string;
  entity: string;
  entity_id: string;
  property: string;
  old_value: unknown;
  new_value: unknown;
  changed_at: string;
  changed_by: string | null;
};

export type HistoryGroup = {
  id: string;
  changed_at: string;
  changed_by: string | null;
  changes: PropertyChangeRow[];
  /** Há mudança de etapa/pipeline/substatus/responsável no grupo. */
  hasMovement: boolean;
};

/** Janela (ms) usada para considerar alterações como parte do mesmo evento. */
const GROUP_WINDOW_MS = 2000;

export function groupPropertyChanges(rows: PropertyChangeRow[]): HistoryGroup[] {
  const sorted = [...rows].sort(
    (a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime(),
  );
  const groups: HistoryGroup[] = [];
  for (const row of sorted) {
    const t = new Date(row.changed_at).getTime();
    const last = groups[groups.length - 1];
    const sameActor = last && (last.changed_by ?? null) === (row.changed_by ?? null);
    const inWindow = last && Math.abs(new Date(last.changed_at).getTime() - t) <= GROUP_WINDOW_MS;
    if (last && sameActor && inWindow) {
      last.changes.push(row);
      if (MOVEMENT_PROPERTIES.has(row.property)) last.hasMovement = true;
      continue;
    }
    groups.push({
      id: `hist_${row.id}`,
      changed_at: row.changed_at,
      changed_by: row.changed_by ?? null,
      changes: [row],
      hasMovement: MOVEMENT_PROPERTIES.has(row.property),
    });
  }
  // Dentro do grupo, movimentações primeiro (mais relevantes).
  for (const g of groups) {
    g.changes.sort((a, b) => {
      const am = MOVEMENT_PROPERTIES.has(a.property) ? 0 : 1;
      const bm = MOVEMENT_PROPERTIES.has(b.property) ? 0 : 1;
      return am - bm;
    });
  }
  return groups;
}
