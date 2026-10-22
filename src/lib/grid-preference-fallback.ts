export type GridPreferenceValue = {
  visibleColumns: string[] | null;
  sortKey: string | null;
  sortDir: "asc" | "desc" | null;
};

export const EMPTY_GRID_PREFERENCE: GridPreferenceValue = {
  visibleColumns: null,
  sortKey: null,
  sortDir: null,
};

/** Preferências de colunas são opcionais: falha no servidor volta ao padrão da tela. */
export async function loadGridPreferenceSafe(
  load: () => Promise<GridPreferenceValue>,
): Promise<GridPreferenceValue> {
  try {
    return await load();
  } catch (err) {
    console.warn("[grid-pref] usando colunas padrão:", err instanceof Error ? err.message : err);
    return EMPTY_GRID_PREFERENCE;
  }
}
