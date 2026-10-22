import { describe, expect, it } from "vitest";
import { detectNotTarget, extractReferral, isAutoResponder } from "./third-party";

// Sinais usados como DADO (sugestão da Inbox e fato para a IA). A resposta da
// Lia nesses casos é coberta por turn.test.ts com o pipeline real.
describe("detectNotTarget", () => {
  it("reconhece quem saiu da empresa (Andre)", () => {
    expect(
      detectNotTarget(
        "boa tarde Lia, não sei te dizer, pois já faz uns 5 anos que saí da Opentech",
      ),
    ).toBe("left_company");
    expect(detectNotTarget("Não trabalho mais lá")).toBe("left_company");
  });
  it("reconhece número de outra pessoa (Rafael, Danilo)", () => {
    expect(detectNotTarget("Esse telefone não é de Rafael")).toBe("not_this_person");
    expect(
      detectNotTarget("Olá Lia! Esse não é o contato do Danilo. Vou te encaminhar o correto."),
    ).toBe("not_this_person");
  });
  it("não encerra conversas legítimas", () => {
    expect(detectNotTarget("Não é o momento")).toBeNull();
    expect(detectNotTarget("Não sou o Rafael, mas cuido da TI")).toBeNull();
    expect(detectNotTarget("sou eu quem cuida da área")).toBeNull();
  });
  it("frases comuns com 'saí/saiu' não são saída da empresa", () => {
    expect(detectNotTarget("nosso sistema saiu do ar ontem")).toBeNull();
    expect(detectNotTarget("Acabei de sair, saí da reunião agora")).toBeNull();
    expect(detectNotTarget("saí do Teams, pode ligar")).toBeNull();
    expect(detectNotTarget("o projeto saiu do papel")).toBeNull();
    expect(detectNotTarget("não estou mais na reunião")).toBeNull();
  });
  it("saída da empresa com contexto continua reconhecida", () => {
    expect(detectNotTarget("saí da empresa ano passado")).toBe("left_company");
    expect(detectNotTarget("Já saí da Opentech")).toBe("left_company");
    expect(detectNotTarget("fui desligado mês passado")).toBe("left_company");
    expect(detectNotTarget("mudei de empresa")).toBe("left_company");
  });
});

describe("extractReferral", () => {
  it("lê texto livre", () => {
    expect(extractReferral("fala com a Ana, 48 99999-0000")).toEqual({
      name: "Ana",
      phoneE164: "+5548999990000",
    });
  });
});

describe("isAutoResponder", () => {
  it("reconhece a URA do Rodrigo", () => {
    expect(
      isAutoResponder(
        "Olá, seja bem vindo!\nEscolha uma fila de atendimento para ser atendido:\n1 - Abertura de tickets\n2 - Cadastrar usuário ou tirar dúvidas\n3 - Falar com o comercial",
      ),
    ).toBe(true);
    expect(isAutoResponder("Esta é uma mensagem automática.")).toBe(true);
  });
  it("lista normal não é robô", () => {
    expect(isAutoResponder("Precisamos de:\n1) React\n2) Node")).toBe(false);
    expect(isAutoResponder("Oi, seja bem-vinda, Lia! Pode falar")).toBe(false);
  });
});
