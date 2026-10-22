import { describe, expect, it } from "vitest";
import {
  claimsMaterialSent,
  isAiIdentityQuestion,
  repeatsIdenticalInbound,
} from "./conversation-guards";

// Só validadores técnicos permanecem determinísticos: efeito falso de
// material, laço de robô e o gatilho da automação opcional sobre IA.
describe("validadores técnicos", () => {
  it("detecta afirmação de envio de material", () => {
    expect(claimsMaterialSent("Vou te enviar o material agora")).toBe(true);
    expect(claimsMaterialSent("Segue o material em anexo")).toBe(true);
    expect(claimsMaterialSent("Posso te mostrar um material sobre isso?")).toBe(false);
  });
  it("reconhece pergunta sobre IA", () => {
    expect(isAiIdentityQuestion("Você é uma IA?")).toBe(true);
    expect(isAiIdentityQuestion("estou falando com um robô?")).toBe(true);
    expect(isAiIdentityQuestion("Vocês trabalham com IA generativa?")).toBe(false);
  });
  it("mensagem longa idêntica repetida indica laço de robô", () => {
    const m = { direction: "inbound", body: "Escolha uma opção do menu para continuar o atendimento" };
    expect(repeatsIdenticalInbound([m, m])).toBe(true);
    expect(repeatsIdenticalInbound([m])).toBe(false);
    expect(
      repeatsIdenticalInbound([
        { direction: "inbound", body: "ok" },
        { direction: "inbound", body: "ok" },
      ]),
    ).toBe(false);
  });
});
