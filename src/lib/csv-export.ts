// Utilitário simples para exportar arrays de objetos como CSV no navegador.
function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  const s = String(value);
  if (/[",\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export type CsvColumn<T> = { key: string; label?: string; get?: (row: T) => unknown };

export function exportRowsToCsv<T extends Record<string, unknown>>(
  filename: string,
  rows: T[],
  columns?: CsvColumn<T>[],
) {
  if (!rows || rows.length === 0) {
    // ainda assim baixa um arquivo vazio com cabeçalho, se houver
    if (!columns || columns.length === 0) {
      throw new Error("Sem registros para exportar");
    }
  }

  const cols: CsvColumn<T>[] =
    columns ??
    Object.keys(rows[0] ?? {}).map((k) => ({ key: k }));

  const header = cols.map((c) => escapeCell(c.label ?? c.key)).join(",");
  const body = rows
    .map((row) =>
      cols
        .map((c) => escapeCell(c.get ? c.get(row) : (row as Record<string, unknown>)[c.key]))
        .join(","),
    )
    .join("\n");

  const csv = "\ufeff" + header + "\n" + body;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  a.href = url;
  a.download = `${filename}-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
