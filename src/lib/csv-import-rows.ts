// Prepara as linhas do CSV antes de enviar ao servidor: só colunas mapeadas
// saem do navegador, e valores longos são cortados no limite aceito pelo servidor.
export const CSV_CELL_MAX = 2000;

export type CsvRowIn = Record<string, string | null | undefined>;

export function pickMappedColumns(rows: CsvRowIn[], mapping: Record<string, string>) {
  const cols = Object.keys(mapping);
  const truncated: Record<string, number> = {};
  const out = rows.map((r) => {
    const o: Record<string, string | null> = {};
    for (const c of cols) {
      const v = r[c];
      if (v == null) {
        o[c] = null;
        continue;
      }
      const s = String(v);
      if (s.length > CSV_CELL_MAX) {
        truncated[c] = (truncated[c] ?? 0) + 1;
        o[c] = s.slice(0, CSV_CELL_MAX);
      } else o[c] = s;
    }
    return o;
  });
  return { rows: out, truncated };
}
