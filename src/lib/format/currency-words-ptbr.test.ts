import { describe, expect, it } from "vitest";
import { currencyToWordsPtBr as w } from "./currency-words-ptbr";

describe("currencyToWordsPtBr", () => {
  it("18.870,00", () => expect(w(18870)).toBe("dezoito mil, oitocentos e setenta reais"));
  it("1.000.001,50", () => expect(w(1000001.5)).toBe("um milhão e um reais e cinquenta centavos"));
  it("0,99", () => expect(w(0.99)).toBe("noventa e nove centavos"));
  it("100", () => expect(w(100)).toBe("cem reais"));
  it("21", () => expect(w(21)).toBe("vinte e um reais"));
  it("1.000.000", () => expect(w(1000000)).toBe("um milhão de reais"));
  it("texto formatado", () => expect(w("R$ 2.500,00")).toBe("dois mil e quinhentos reais"));
  it("vazio", () => expect(w(null)).toBe(""));
});
