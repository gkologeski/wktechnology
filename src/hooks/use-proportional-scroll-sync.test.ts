import { describe, expect, it } from "vitest";
import { proportionalScrollTop } from "./use-proportional-scroll-sync";

describe("proportionalScrollTop", () => {
  it("leva o painel lateral ao fim junto com a timeline", () => {
    expect(proportionalScrollTop(800, 1200, 400, 700, 400)).toBe(300);
  });

  it("mantém metade do progresso entre alturas diferentes", () => {
    expect(proportionalScrollTop(400, 1200, 400, 1000, 400)).toBe(300);
  });

  it("não cria rolagem quando uma coluna não transborda", () => {
    expect(proportionalScrollTop(400, 1200, 400, 300, 400)).toBe(0);
  });

  it("limita posições fora do intervalo", () => {
    expect(proportionalScrollTop(2000, 1200, 400, 1000, 400)).toBe(600);
    expect(proportionalScrollTop(-100, 1200, 400, 1000, 400)).toBe(0);
  });
});
