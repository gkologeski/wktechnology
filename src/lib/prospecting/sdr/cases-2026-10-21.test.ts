import { describe, expect, it } from "vitest";
import { detectCompanyLeft } from "./third-party";
import { detectOptOut } from "./policy";

// Casos reais 20–21/10. Respostas e encerramentos agora vêm da persona
// publicada + estado estruturado (turn.test.ts); aqui ficam os detectores de dado.
describe("casos 20–21/10", () => {
  it.each([
    "Eu não trabalho na F360",
    "Olá ja nao faço parte do redação online a 2 anos",
    "Não estou mais na Envolti.  Posso te passar o contaro",
    "Não sou mais",
    "Boa noite, não. Nao sei que empresa é essa.",
  ])("saiu da empresa: %s", (t) => {
    expect(detectCompanyLeft(t)).not.toBeNull();
  });

  it.each([
    "saí da reunião agora",
    "o sistema saiu do ar",
    "não trabalho na área de TI, sou do financeiro",
    "não faço parte do comitê",
    "Não sou mais o responsável? Sou sim",
  ])("controle (não é saída): %s", (t) => {
    expect(detectCompanyLeft(t)).toBeNull();
  });

  it("Ricardo Oliveira: 'não entre mais em contato' é opt-out", () => {
    expect(detectOptOut("por favor não entre mais em contato, não temos interesse")).toBe(true);
    expect(detectOptOut("Obrigado Lia")).toBe(false);
  });
});
