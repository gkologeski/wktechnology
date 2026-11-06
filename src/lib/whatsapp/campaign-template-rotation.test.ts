import { describe, expect, it } from "vitest";
import { buildRotation, maxVariableCount, pickTemplate } from "./campaign-template-rotation";

const p = { name: "a", language: "pt_BR", body: "A", variableCount: 1 };
const list = buildRotation(p, [
  { name: "b", variableCount: 2 },
  { name: "c", variableCount: 0 },
]);

describe("rodízio de modelos", () => {
  it("sequencial alterna A, B, C e volta ao A", () => {
    expect([0, 1, 2, 3].map((s) => pickTemplate(list, "sequential", s, 0)?.name)).toEqual([
      "a",
      "b",
      "c",
      "a",
    ]);
  });
  it("mantém o modelo já fixado no destinatário", () => {
    expect(pickTemplate(list, "sequential", 0, 0, "c")?.name).toBe("c");
  });
  it("modelo fixado que saiu do rodízio é substituído", () => {
    expect(pickTemplate(list, "sequential", 1, 0, "zzz")?.name).toBe("b");
  });
  it("peso 50/30/20 respeita as faixas", () => {
    const w = buildRotation({ ...p, name: "a" }, [
      { name: "a", weight: 50 },
      { name: "b", weight: 30 },
      { name: "c", weight: 20 },
    ]);
    expect(pickTemplate(w, "weighted", 0, 0.49)?.name).toBe("a");
    expect(pickTemplate(w, "weighted", 0, 0.79)?.name).toBe("b");
    expect(pickTemplate(w, "weighted", 0, 0.81)?.name).toBe("c");
  });
  it("limita a 5 modelos e não duplica", () => {
    const many = buildRotation(
      p,
      ["a", "b", "c", "d", "e", "f"].map((name) => ({ name })),
    );
    expect(many.map((t) => t.name)).toEqual(["a", "b", "c", "d", "e"]);
  });
  it("exige mapear o maior número de variáveis", () => {
    expect(maxVariableCount(list)).toBe(2);
  });
});

import {
  missingRotationVariables as _missing,
  variablesForTemplate as _varsFor,
} from "./campaign-template-rotation";
import { describe as _d, expect as _e, it as _i } from "vitest";

_d("variáveis por modelo do rodízio", () => {
  const prim = { name: "a", language: "pt_BR", body: "", variableCount: 1, weight: 1 };
  const extra = { name: "b", language: "pt_BR", body: "", variableCount: 2, weight: 1 };
  _i("modelo adicional usa as próprias variáveis", () => {
    _e(_varsFor(extra, "a", { "1": "Ana", "b#1": "Empresa X", "b#2": "TI" })).toEqual({
      "1": "Empresa X",
      "2": "TI",
    });
  });
  _i("principal continua usando {{1}}", () => {
    _e(_varsFor(prim, "a", { "1": "Ana", "b#1": "X" })).toEqual({ "1": "Ana" });
  });
  _i("campanha antiga sem mapeamento próprio usa as do principal", () => {
    _e(_varsFor(extra, "a", { "1": "Ana", "2": "Y" })).toEqual({ "1": "Ana", "2": "Y" });
  });
  _i("aponta variável sem campo em modelo adicional", () => {
    _e(
      _missing([prim, extra], { "1": { field: "first_name" }, "b#1": { field: "company" } }),
    ).toEqual(["b {{2}}"]);
  });
});
