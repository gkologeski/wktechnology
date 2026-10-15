import { describe, expect, it } from "vitest";
import { customerWaitSeconds, parseAgentConfig } from "./agent-config";
import { blockingWarnings, mentionsPrice, PRICE_WARNING } from "./policy";

describe("tempo de aguardo do cliente", () => {
  it("padrão é 5 segundos", () => {
    expect(customerWaitSeconds({})).toBe(5);
    expect(parseAgentConfig({}).guardrails.customer_wait_seconds).toBe(5);
  });
  it("aceita 0 (responde na hora) e até 300", () => {
    expect(customerWaitSeconds({ customer_wait_seconds: 0 })).toBe(0);
    expect(customerWaitSeconds({ customer_wait_seconds: 300 })).toBe(300);
  });
  it("valor fora da faixa volta ao padrão", () => {
    expect(customerWaitSeconds({ customer_wait_seconds: 301 })).toBe(5);
    expect(customerWaitSeconds({ customer_wait_seconds: -1 })).toBe(5);
  });
});

describe("autonomia: avisos que travam envio", () => {
  it("só menção a preço exige humano", () => {
    expect(blockingWarnings(["Oferta descartada: x", "Opt-out ignorado"])).toEqual([]);
    expect(blockingWarnings([PRICE_WARNING, "Oferta descartada: x"])).toEqual([PRICE_WARNING]);
  });
  it("detecta valores em reais", () => {
    expect(mentionsPrice("custa R$ 5.000")).toBe(true);
    expect(mentionsPrice("os valores ficam para a reunião")).toBe(false);
  });
});
