import { describe, expect, it } from "vitest";
import {
  CSV_IMPORT_CLIENT_BATCH,
  CSV_IMPORT_INSERT_CHUNK,
  EMPTY_BATCH_RESULT,
  chunkRows,
  mergeBatchResult,
  pickMappedColumns,
} from "./csv-import-rows";

describe("pickMappedColumns", () => {
  it("descarta colunas não mapeadas, mesmo com 5.000 caracteres", () => {
    const { rows } = pickMappedColumns([{ Email: "a@b.com", Keywords: "x".repeat(5000) }], {
      Email: "email",
    });
    expect(rows[0]).toEqual({ Email: "a@b.com" });
  });
  it("corta campo mapeado em 2.000 e conta", () => {
    const { rows, truncated } = pickMappedColumns([{ K: "y".repeat(2500) }], { K: "notes" });
    expect(rows[0].K).toHaveLength(2000);
    expect(truncated).toEqual({ K: 1 });
  });
});

describe("lotes da importação", () => {
  it("navegador envia 100 linhas por chamada e o servidor grava de 10 em 10", () => {
    expect(CSV_IMPORT_CLIENT_BATCH).toBe(100);
    expect(CSV_IMPORT_INSERT_CHUNK).toBe(10);
  });
  it("2.350 linhas viram 24 lotes, o último com 50", () => {
    const batches = chunkRows(Array.from({ length: 2350 }, (_, i) => i), 100);
    expect(batches).toHaveLength(24);
    expect(batches[23]).toHaveLength(50);
    expect(batches.flat()).toHaveLength(2350);
  });
  it("recusa tamanho de lote zero", () => {
    expect(() => chunkRows([1], 0)).toThrow();
  });
  it("soma os lotes e corrige a linha do e-mail inválido pela posição do lote", () => {
    const first = mergeBatchResult(
      EMPTY_BATCH_RESULT,
      { inserted: 90, updated: 0, skipped: 9, invalid: 1, emailErrors: [{ row: 5, message: "x" }] },
      0,
    );
    const total = mergeBatchResult(
      first,
      { inserted: 40, updated: 2, skipped: 0, invalid: 1, emailErrors: [{ row: 2, message: "y" }] },
      100,
    );
    expect(total).toMatchObject({ inserted: 130, updated: 2, skipped: 9, invalid: 2 });
    expect(total.emailErrors.map((e) => e.row)).toEqual([5, 102]);
  });
});
