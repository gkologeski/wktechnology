// Sprint 7 — Utilitário de exportação CSV client-side.
// Compatível com Excel (BOM UTF-8, separador ";" para PT-BR).

export type CsvColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
};

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = columns.map((c) => escape(c.header)).join(";");
  const body = rows
    .map((r) => columns.map((c) => escape(c.value(r))).join(";"))
    .join("\r\n");
  return `\uFEFF${header}\r\n${body}`;
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
