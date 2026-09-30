import { describe, expect, it } from "vitest";
import {
  activeCount,
  applyGridFilters,
  chipText,
  sanitizeState,
  type GridFilterField,
} from "./grid-filters";

type R = { status: string; amount: number | null; due: string | null; owner: string | null };
const rows: R[] = [
  { status: "open", amount: 100, due: "2026-09-10T12:00:00Z", owner: "u1" },
  { status: "paid", amount: 500, due: "2026-09-20", owner: null },
  { status: "open", amount: null, due: null, owner: "u2" },
];
const fields: GridFilterField<R>[] = [
  {
    key: "status",
    label: "Status",
    type: "multi",
    get: (r) => r.status,
    options: [
      { value: "open", label: "Em aberto" },
      { value: "paid", label: "Paga" },
    ],
  },
  { key: "amount", label: "Valor", type: "number", get: (r) => r.amount },
  { key: "due", label: "Vencimento", type: "date", get: (r) => r.due },
  { key: "owner", label: "Responsável", type: "owner", get: (r) => r.owner },
];

describe("grid-filters", () => {
  it("aplica múltipla escolha, faixa numérica e datas inclusivas", () => {
    expect(
      applyGridFilters(rows, fields, { status: { kind: "in", values: ["open"] } }),
    ).toHaveLength(2);
    expect(applyGridFilters(rows, fields, { amount: { kind: "range", from: "200" } })).toEqual([
      rows[1],
    ]);
    expect(
      applyGridFilters(rows, fields, {
        due: { kind: "range", from: "2026-09-10", to: "2026-09-10" },
      }),
    ).toEqual([rows[0]]);
  });
  it("filtra responsável incluindo sem responsável", () => {
    const r = applyGridFilters(rows, fields, {
      owner: { kind: "owner", ownerIds: ["u2"], includeUnassigned: true },
    });
    expect(r).toEqual([rows[1], rows[2]]);
  });
  it("sem filtros ativos devolve tudo e conta zero", () => {
    const s = { status: { kind: "in" as const, values: [] } };
    expect(applyGridFilters(rows, fields, s)).toHaveLength(3);
    expect(activeCount(s)).toBe(0);
  });
  it("gera etiqueta legível", () => {
    expect(chipText(fields[0]!, { kind: "in", values: ["open", "paid"] }, rows)).toBe(
      "Status: Em aberto, Paga",
    );
    expect(
      chipText(fields[2]!, { kind: "range", from: "2026-09-01", to: "2026-09-30" }, rows),
    ).toBe("Vencimento: 01/09/2026 – 30/09/2026");
  });
  it("descarta chaves desconhecidas da visão salva", () => {
    expect(
      sanitizeState(
        { x: { kind: "in", values: ["a"] }, status: { kind: "in", values: ["open"] } },
        fields,
      ),
    ).toEqual({ status: { kind: "in", values: ["open"] } });
  });
});
