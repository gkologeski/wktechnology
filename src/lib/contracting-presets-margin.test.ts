import { describe, expect, it } from "vitest";
import { marginPercent } from "./contracting-presets-shared";

describe("marginPercent", () => {
  it("calcula a margem bruta quando há preço e custo", () => {
    expect(marginPercent(20000, 14000)).toBeCloseTo(30);
  });

  it("aceita margem negativa quando o custo passa do preço", () => {
    expect(marginPercent(10000, 12000)).toBeCloseTo(-20);
  });

  it("não calcula sem preço ou sem custo", () => {
    expect(marginPercent(0, 5000)).toBeNull();
    expect(marginPercent(5000, 0)).toBeNull();
  });
});
