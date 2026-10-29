import { describe, expect, it } from "vitest";
import { isNearRepeat, textSimilarity } from "./repetition";

describe("retomada quase igual à última mensagem", () => {
  it("caso DSIN 29/10: retomada praticamente igual é repetição", () => {
    const prev =
      "Obrigado pelo retorno e pela informação, Rodrigo. Para entender melhor suas necessidades, poderia me dizer qual a principal dor que vocês enfrentam hoje na área de desenvolvimento?";
    const next =
      "Obrigado pelo retorno, Rodrigo. Para entender melhor suas necessidades, poderia me dizer qual a principal dor que vocês enfrentam hoje na área de desenvolvimento?";
    expect(textSimilarity(prev, next)).toBeGreaterThan(0.9);
    expect(isNearRepeat(next, prev)).toBe(true);
  });
  it("retomada com outra abordagem não é repetição", () => {
    expect(
      isNearRepeat(
        "Rodrigo, conseguiu ver a apresentação que mandei ontem?",
        "Obrigado pelo retorno, Rodrigo. Qual a principal dor hoje na área de desenvolvimento?",
      ),
    ).toBe(false);
  });
  it("mensagens curtas só contam se forem idênticas", () => {
    expect(isNearRepeat("Tudo bem?", "Tudo bem, Ana?")).toBe(false);
    expect(isNearRepeat("Tudo bem?", "tudo bem")).toBe(true);
  });
});
