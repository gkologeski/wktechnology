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
  for (const g of groups) {
    // `stage` e `stage_id` gravam a mesma movimentação: exibir uma única linha.
    g.changes = dedupeStageChanges(g.changes);
    // Dentro do grupo, movimentações primeiro (mais relevantes).
    g.changes.sort((a, b) => {
      const am = MOVEMENT_PROPERTIES.has(a.property) ? 0 : 1;
      const bm = MOVEMENT_PROPERTIES.has(b.property) ? 0 : 1;
      return am - bm;
    });
  }
  return groups;
}

const STAGE_PROPS = ["stage", "stage_id"] as const;

/**
 * Colapsa alterações redundantes de etapa dentro do mesmo grupo.
 *
 * O registro guarda `stage` (slug) e `stage_id` (slug ou id legado) para o
 * mesmo movimento. Mantemos apenas uma linha por par de valores.
 */
function dedupeStageChanges(changes: PropertyChangeRow[]): PropertyChangeRow[] {
  const stageRows = changes.filter((c) => STAGE_PROPS.includes(c.property as "stage"));
  if (stageRows.length <= 1) return changes;
  const kept: PropertyChangeRow[] = [];
  const seen = new Set<string>();
  for (const property of STAGE_PROPS) {
    for (const row of stageRows) {
      if (row.property !== property) continue;
      const key = `${String(row.old_value ?? "")}→${String(row.new_value ?? "")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      kept.push(row);
    }
  }
  return [...changes.filter((c) => !STAGE_PROPS.includes(c.property as "stage")), ...kept];
}
