import { describe, expect, it } from "vitest";
import {
  classifyBlock,
  mergeSteps,
  step,
  stepConversion,
  summarizeBlocks,
} from "./campaign-funnel.logic";

describe("campaign funnel logic", () => {
  it("classifica motivos reais de bloqueio", () => {
    expect(classifyBlock("skipped", "Não é celular do Brasil")).toBe("invalid");
    expect(classifyBlock("skipped", "Já é cliente")).toBe("commercial");
    expect(classifyBlock("skipped", "Negociação em aberto")).toBe("commercial");
    expect(classifyBlock("failed", "[400] body")).toBe("failed");
    expect(classifyBlock("unsubscribed", null)).toBe("unsubscribed");
  });

  it("agrupa bloqueios por motivo", () => {
    const r = summarizeBlocks([
      { status: "skipped", error: "Já é cliente" },
      { status: "skipped", error: "Negociação em aberto" },
      { status: "failed", error: "x" },
    ]);
    expect(r).toEqual([
      { key: "failed", label: "Falha de envio", value: 1 },
      { key: "commercial", label: "Cliente ou negociação aberta", value: 2 },
    ]);
  });

  it("conversão entre etapas", () => {
    expect(stepConversion(200, 50)).toBe(25);
    expect(stepConversion(0, 0)).toBeNull();
    expect(stepConversion(10, null)).toBeNull();
  });

  it("etapa não rastreada nunca vira zero", () => {
    expect(step("read", "Lido", null).coverage).toBe("none");
    const m = mergeSteps([step("a", "A", 10)], [step("a", "A", null)]);
    expect(m[0]).toMatchObject({ value: 10, coverage: "partial" });
    const n = mergeSteps([step("a", "A", null)], [step("a", "A", null)]);
    expect(n[0]!.value).toBeNull();
  });
});
