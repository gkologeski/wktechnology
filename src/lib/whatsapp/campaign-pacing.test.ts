import { describe, expect, it } from "vitest";
import {
  estimateRemainingMs,
  pacingEnabled,
  randomIntervalSeconds,
  resolveInterval,
  validateInterval,
} from "./campaign-pacing";

describe("sorteio do intervalo", () => {
  it("fica sempre entre X e Y, incluindo os extremos", () => {
    expect(randomIntervalSeconds(30, 120, () => 0)).toBe(30);
    expect(randomIntervalSeconds(30, 120, () => 0.999999)).toBe(120);
    for (let k = 0; k < 2000; k++) {
      const v = randomIntervalSeconds(30, 120);
      expect(v).toBeGreaterThanOrEqual(30);
      expect(v).toBeLessThanOrEqual(120);
    }
  });
  it("X = Y devolve o valor fixo", () => {
    expect(randomIntervalSeconds(45, 45)).toBe(45);
  });
});

describe("intervalo efetivo", () => {
  const ws = { template_interval_min_s: 30, template_interval_max_s: 120 };
  it("campanha sem valores usa o padrão do workspace", () => {
    expect(resolveInterval({ send_interval_min_s: null, send_interval_max_s: null }, ws)).toEqual({
      min: 30,
      max: 120,
    });
  });
  it("campanha com valores próprios prevalece", () => {
    expect(resolveInterval({ send_interval_min_s: 5, send_interval_max_s: 10 }, ws)).toEqual({
      min: 5,
      max: 10,
    });
  });
  it("0–0 desliga o espaçamento (comportamento atual em lotes)", () => {
    const i = resolveInterval({ send_interval_min_s: 0, send_interval_max_s: 0 }, ws);
    expect(pacingEnabled(i)).toBe(false);
    expect(
      pacingEnabled(
        resolveInterval({ send_interval_min_s: null, send_interval_max_s: null }, null),
      ),
    ).toBe(false);
  });
});

describe("validação e previsão", () => {
  it("bloqueia valores inválidos", () => {
    expect(validateInterval(10, 5)).toMatch(/mínimo/);
    expect(validateInterval(-1, 5)).toMatch(/negativos/);
    expect(validateInterval(0, 4000)).toMatch(/3600/);
    expect(validateInterval(30, 120)).toBeNull();
  });
  it("prevalece o mais lento entre intervalo e envios por minuto", () => {
    expect(estimateRemainingMs(10, { min: 30, max: 90 }, 60)).toBe(10 * 60_000);
    expect(estimateRemainingMs(10, { min: 0, max: 0 }, 10)).toBe(10 * 6_000);
  });
});
