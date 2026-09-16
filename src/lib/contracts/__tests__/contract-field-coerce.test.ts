import { describe, expect, it } from "vitest";
import {
  coerceContractFields,
  parseBrNumber,
  parseDateValue,
} from "@/lib/contracts/contract-field-coerce";

describe("parseBrNumber", () => {
  it("aceita formato pt-BR e simples", () => {
    expect(parseBrNumber("R$ 3.200,50")).toBe(3200.5);
    expect(parseBrNumber("3200.5")).toBe(3200.5);
    expect(parseBrNumber("1.234")).toBe(1234);
    expect(parseBrNumber("12,5")).toBe(12.5);
    expect(parseBrNumber(42)).toBe(42);
  });

  it("devolve null para valores não numéricos", () => {
    expect(parseBrNumber("")).toBeNull();
    expect(parseBrNumber("abc")).toBeNull();
    expect(parseBrNumber(null)).toBeNull();
  });
});

describe("parseDateValue", () => {
  it("aceita ISO, data-only e dd/MM/yyyy", () => {
    expect(parseDateValue("2026-01-15")).toBe("2026-01-15");
    expect(parseDateValue("15/01/2026")).toMatch(/^2026-01-15/);
    expect(parseDateValue("2026-01-15T10:00:00Z")).toBe("2026-01-15T10:00:00.000Z");
  });

  it("devolve null para data inválida", () => {
    expect(parseDateValue("não-é-data")).toBeNull();
    expect(parseDateValue("")).toBeNull();
  });
});

describe("coerceContractFields", () => {
  it("converte valores e dias, preservando os demais campos", () => {
    const { values, warnings } = coerceContractFields({
      total_value: "R$ 3.200,00",
      payment_day: "10,4",
      currency: "BRL",
      starts_at: "15/01/2026",
      service_location: "Remoto",
      monthly_value: null,
    });
    expect(values["total_value"]).toBe(3200);
    expect(values["payment_day"]).toBe(10);
    expect(values["currency"]).toBe("BRL");
    expect(values["starts_at"]).toMatch(/^2026-01-15/);
    expect(values["service_location"]).toBe("Remoto");
    expect("monthly_value" in values).toBe(false);
    expect(warnings).toHaveLength(0);
  });

  it("descarta valores inválidos e avisa", () => {
    const { values, warnings } = coerceContractFields({
      total_value: "{{valor}}",
      ends_at: "sem data",
    });
    expect(values).toEqual({});
    expect(warnings).toHaveLength(2);
  });
});
