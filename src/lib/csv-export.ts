// Utilitário de exportação CSV client-side.
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
  const body = rows.map((r) => columns.map((c) => escape(c.value(r))).join(";")).join("\r\n");
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

// Legacy API preservada: usada em listas de CRM (empresas, contatos, leads, tarefas).
export type LegacyColumn = { key: string; label: string };

export function exportRowsToCsv(
  filename: string,
  rows: Record<string, unknown>[],
  columns: LegacyColumn[],
) {
  const csv = toCsv(
    rows,
    columns.map((c) => ({
      header: c.label,
      value: (row: Record<string, unknown>) => {
        const v = row[c.key];
        if (v === null || v === undefined) return "";
        if (v instanceof Date) return v.toISOString();
        if (typeof v === "object") return JSON.stringify(v);
        return v as string | number;
      },
    })),
  );
  downloadCsv(filename, csv);
}
