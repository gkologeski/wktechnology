// Prepara as linhas do CSV antes de enviar ao servidor: só colunas mapeadas
// saem do navegador, e valores longos são cortados no limite aceito pelo servidor.
export const CSV_CELL_MAX = 2000;

// Lotes da importação. Cada contato/lead passa por várias regras automáticas no
// banco (~150 ms por linha), e cada gravação precisa terminar antes do limite de
// 8 s do banco: o navegador envia 100 linhas por chamada e o servidor grava de 10 em 10.
export const CSV_IMPORT_CLIENT_BATCH = 100;
export const CSV_IMPORT_INSERT_CHUNK = 10;
// Consulta de duplicados: quantidade de chaves por busca (evita URL longa demais).
export const CSV_IMPORT_LOOKUP_CHUNK = 200;

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

export function chunkRows<T>(items: T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new Error("Tamanho de lote inválido.");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export type CsvBatchResult = {
  inserted: number;
  updated: number;
  skipped: number;
  invalid: number;
  emailErrors: { row: number; message: string }[];
};

// Soma o resultado de um lote ao total; as linhas de erro do lote (numeradas a
// partir de 2, como no arquivo) são deslocadas pela posição do lote no arquivo.
export function mergeBatchResult(
  total: CsvBatchResult,
  batch: CsvBatchResult,
  batchStart: number,
): CsvBatchResult {
  return {
    inserted: total.inserted + batch.inserted,
    updated: total.updated + batch.updated,
    skipped: total.skipped + batch.skipped,
    invalid: total.invalid + batch.invalid,
    emailErrors: [
      ...total.emailErrors,
      ...batch.emailErrors.map((e) => ({ ...e, row: e.row + batchStart })),
    ],
  };
}

export const EMPTY_BATCH_RESULT: CsvBatchResult = {
  inserted: 0,
  updated: 0,
  skipped: 0,
  invalid: 0,
  emailErrors: [],
};
