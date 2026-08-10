import { describe, expect, it } from "vitest";
import { detectAmendmentSignals, extractAmendmentNumber } from "@/lib/contracts/doc-kind";

describe("extractAmendmentNumber", () => {
  it("lê numeração cardinal", () => {
    expect(extractAmendmentNumber("2º TERMO ADITIVO AO CONTRATO")).toBe("2");
    expect(extractAmendmentNumber("Aditivo nº 03")).toBe("3");
  });

  it("lê numeração ordinal escrita", () => {
    expect(extractAmendmentNumber("PRIMEIRO TERMO ADITIVO")).toBe("1");
    expect(extractAmendmentNumber("Terceira alteração via aditivo")).toBe("3");
  });

  it("retorna null sem numeração", () => {
    expect(extractAmendmentNumber("TERMO ADITIVO")).toBeNull();
    expect(extractAmendmentNumber("Contrato de prestação")).toBeNull();
  });
});

describe("detectAmendmentSignals", () => {
  it("detecta pelo título", () => {
    const r = detectAmendmentSignals({ title: "1º Termo Aditivo — GRALHA" });
    expect(r.isAmendment).toBe(true);
    expect(r.number).toBe("1");
    expect(r.reasons.length).toBeGreaterThan(0);
  });

  it("detecta prefixo ADT e nome de arquivo", () => {
    expect(detectAmendmentSignals({ title: "ADT CPS GRALHA X WK" }).isAmendment).toBe(true);
    expect(detectAmendmentSignals({ fileName: "aditivo-gralha.pdf" }).isAmendment).toBe(true);
  });

  it("detecta por aviso da importação", () => {
    const r = detectAmendmentSignals({
      title: "Contrato",
      warnings: ["Documento aparenta ser TERMO ADITIVO nº 2"],
    });
    expect(r.isAmendment).toBe(true);
    expect(r.number).toBe("2");
  });

  it("é conservadora sem evidência textual", () => {
    const r = detectAmendmentSignals({
      title: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS",
      fileName: "contrato.pdf",
      warnings: ["Valor mensal não identificado"],
    });
    expect(r.isAmendment).toBe(false);
    expect(r.number).toBeNull();
  });
});
