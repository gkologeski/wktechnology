import { describe, expect, it } from "vitest";
import { parseOptOutPhrases } from "./sdr-opt-out-text";

describe("frases de saída da Configuração do agente", () => {
  it("separa por vírgula ou linha, apara e mantém a ordem", () => {
    expect(parseOptOutPhrases(" pare, sair \n não quero mais ")).toEqual([
      "pare",
      "sair",
      "não quero mais",
    ]);
  });
  it("descarta vazias e repetidas sem diferenciar maiúsculas", () => {
    expect(parseOptOutPhrases("Pare,, pare ,STOP,stop,")).toEqual(["Pare", "STOP"]);
  });
  it("texto vazio vira lista vazia", () => {
    expect(parseOptOutPhrases("  ,  ")).toEqual([]);
  });
  it("limita a 50 frases de até 80 caracteres", () => {
    const many = Array.from({ length: 60 }, (_, i) => `frase ${i}`).join(",");
    expect(parseOptOutPhrases(many)).toHaveLength(50);
    expect(parseOptOutPhrases("x".repeat(100))[0]).toHaveLength(80);
  });
});
