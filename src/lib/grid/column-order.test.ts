import { describe, expect, it } from "vitest";
import { moveColumn, reconcileColumnOrder } from "./column-order";

describe("ordem das colunas", () => {
  it("remove colunas antigas sem reexibir colunas novas opcionais", () => {
    expect(reconcileColumnOrder(["nome", "removida", "status"], ["nome", "status", "nova"])).toEqual([
      "nome",
      "status",
    ]);
  });

  it("usa o padrão quando não há preferência", () => {
    expect(reconcileColumnOrder(null, ["nome", "status", "extra"], ["status", "nome"])).toEqual([
      "status",
      "nome",
    ]);
  });

  it("move uma coluna para a posição de outra", () => {
    expect(moveColumn(["nome", "status", "valor"], "valor", "nome")).toEqual([
      "valor",
      "nome",
      "status",
    ]);
  });

  it("preserva a ordem quando uma chave é inválida", () => {
    const order = ["nome", "status"];
    expect(moveColumn(order, "inexistente", "nome")).toBe(order);
  });
});