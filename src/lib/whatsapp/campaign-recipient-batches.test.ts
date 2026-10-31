import { describe, expect, it } from "vitest";
import { RECIPIENT_INSERT_BATCH, recipientBatches } from "./campaign-recipient-batches";

describe("recipientBatches", () => {
  it("grava 1.240 destinatários em 2 lotes (1.000 + 240)", () => {
    const rows = Array.from({ length: 1240 }, (_, i) => i);
    const batches = recipientBatches(rows);
    expect(RECIPIENT_INSERT_BATCH).toBe(1000);
    expect(batches.map((b) => b.length)).toEqual([1000, 240]);
    expect(batches.flat()).toEqual(rows);
  });

  it("lista vazia não gera lote", () => {
    expect(recipientBatches([])).toEqual([]);
  });

  it("recusa tamanho de lote inválido", () => {
    expect(() => recipientBatches([1], 0)).toThrow();
  });
});
