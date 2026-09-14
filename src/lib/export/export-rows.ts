// Exportação de registros em CSV, JSON e XLSX (Excel).
// Usado pela barra flutuante de ações em massa e pelas toolbars de lista.
// O XLSX é carregado sob demanda para não pesar o bundle inicial.

export type ExportFormat = "csv" | "json" | "xlsx";

export const EXPORT_FORMAT_LABEL: Record<ExportFormat, string> = {
  csv: "CSV",
  json: "JSON",
  xlsx: "Excel (XLSX)",
};

export type ExportColumn<T> = {
  header: string;
  value: (row: T) => unknown;
};

export type ExportOptions<T> = {
  /** Nome do arquivo sem extensão. A data é acrescentada automaticamente. */
  filename: string;
  format: ExportFormat;
  /** Colunas/rótulos. Omitir exporta todas as chaves presentes nas linhas. */
  columns?: ExportColumn<T>[];
};

/** `negocios` -> `negocios-2026-09-14` */
export function datedFilename(base: string) {
  return `${base}-${new Date().toISOString().slice(0, 10)}`;
}

function normalizeCell(v: unknown): string | number | boolean | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  if (typeof v === "number" || typeof v === "boolean") return v;
  return String(v);
}

function inferColumns<T>(rows: T[]): ExportColumn<T>[] {
  const keys: string[] = [];
  for (const row of rows) {
    for (const k of Object.keys((row ?? {}) as Record<string, unknown>)) {
      if (!keys.includes(k)) keys.push(k);
    }
  }
  return keys.map((k) => ({
    header: k,
    value: (row: T) => (row as Record<string, unknown>)[k],
  }));
}

function toMatrix<T>(rows: T[], columns: ExportColumn<T>[]) {
  const header = columns.map((c) => c.header);
  const body = rows.map((r) => columns.map((c) => normalizeCell(c.value(r))));
  return { header, body };
}

function csvEscape(v: string | number | boolean | null) {
  if (v === null) return "";
  const s = String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildCsv<T>(rows: T[], columns: ExportColumn<T>[]) {
  const { header, body } = toMatrix(rows, columns);
  const lines = [header.map(csvEscape).join(";"), ...body.map((r) => r.map(csvEscape).join(";"))];
  // BOM para o Excel reconhecer UTF-8; separador ";" para o padrão PT-BR.
  return `\uFEFF${lines.join("\r\n")}`;
}

function buildJson<T>(rows: T[], columns: ExportColumn<T>[]) {
  const out = rows.map((r) => {
    const obj: Record<string, unknown> = {};
    for (const c of columns) obj[c.header] = normalizeCell(c.value(r));
    return obj;
  });
  return JSON.stringify(out, null, 2);
}

function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

/** Gera e baixa o arquivo no formato escolhido. Lança em caso de falha. */
export async function exportRows<T>(rows: T[], options: ExportOptions<T>) {
  const columns = options.columns?.length ? options.columns : inferColumns(rows);
  const base = datedFilename(options.filename);

  if (options.format === "csv") {
    download(
      `${base}.csv`,
      new Blob([buildCsv(rows, columns)], { type: "text/csv;charset=utf-8" }),
    );
    return;
  }
  if (options.format === "json") {
    download(
      `${base}.json`,
      new Blob([buildJson(rows, columns)], { type: "application/json;charset=utf-8" }),
    );
    return;
  }

  const XLSX = await import("xlsx");
  const { header, body } = toMatrix(rows, columns);
  const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Dados");
  const buffer = XLSX.write(book, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  download(
    `${base}.xlsx`,
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
}
