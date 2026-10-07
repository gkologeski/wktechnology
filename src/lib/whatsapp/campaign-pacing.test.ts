import { describe, expect, it, vi } from "vitest";
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

import { runPacedLoop } from "./campaign-pacing";

function clock(start = 0) {
  let t = start;
  return {
    now: () => t,
    sleep: async (ms: number) => void (t += ms),
    advance: (ms: number) => (t += ms),
  };
}

describe("laço do disparo espaçado", () => {
  it("nenhum envio antes de next_send_at e intervalo entre X e Y entre envios", async () => {
    const c = clock(1_000);
    const sendTimes: number[] = [];
    let pending = 5;
    const r = await runPacedLoop({
      interval: { min: 10, max: 20 },
      nextAt: 6_000, // ainda faltam 5 s
      startedAt: 1_000,
      budgetMs: 45_000,
      now: c.now,
      sleep: c.sleep,
      rng: () => 0.5,
      sendOne: async () => {
        if (!pending) return { processed: 0 };
        pending--;
        sendTimes.push(c.now());
        return { processed: 1 };
      },
      persistNextAt: async () => {},
    });
    expect(sendTimes[0]).toBeGreaterThanOrEqual(6_000);
    for (let i = 1; i < sendTimes.length; i++) {
      const gap = sendTimes[i] - sendTimes[i - 1];
      expect(gap).toBeGreaterThanOrEqual(10_000);
      expect(gap).toBeLessThanOrEqual(20_000);
    }
    // 6s, +15s, +15s = 36s; o próximo (51s) passa do orçamento de 45s
    expect(r.processed).toBe(3);
  });
  it("próximo disparo além do orçamento: não espera nem envia", async () => {
    const c = clock(0);
    const sendOne = vi.fn(async () => ({ processed: 1 }));
    const r = await runPacedLoop({
      interval: { min: 30, max: 30 },
      nextAt: 120_000,
      startedAt: 0,
      now: c.now,
      sleep: c.sleep,
      sendOne,
      persistNextAt: async () => {},
    });
    expect(sendOne).not.toHaveBeenCalled();
    expect(r.nextAt).toBe(120_000);
  });
  it("falha conta como tentativa e o próximo também respeita o intervalo", async () => {
    const c = clock(0);
    const persisted: number[] = [];
    let n = 0;
    await runPacedLoop({
      interval: { min: 40, max: 40 },
      nextAt: 0,
      startedAt: 0,
      now: c.now,
      sleep: c.sleep,
      sendOne: async () => (n++ < 2 ? { processed: 1 } : { processed: 0 }),
      persistNextAt: async (ms) => void persisted.push(ms),
    });
    expect(persisted[0]).toBe(40_000);
  });
});
