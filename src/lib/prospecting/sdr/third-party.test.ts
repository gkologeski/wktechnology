import { describe, expect, it } from "vitest";
import {
  REFERRAL_QUESTION,
  decideThirdParty,
  detectNotTarget,
  extractReferral,
  isAutoResponder,
  isQualificationQuestion,
} from "./third-party";

const out = (body: string) => ({ direction: "outbound", body });
const inn = (body: string) => ({ direction: "inbound", body });

describe("detectNotTarget", () => {
  it("reconhece quem saiu da empresa (Andre)", () => {
    expect(
      detectNotTarget("boa tarde Lia, não sei te dizer, pois já faz uns 5 anos que saí da Opentech"),
    ).toBe("left_company");
    expect(detectNotTarget("Não trabalho mais lá")).toBe("left_company");
  });
  it("reconhece número de outra pessoa (Rafael, Danilo)", () => {
    expect(detectNotTarget("Esse telefone não é de Rafael")).toBe("not_this_person");
    expect(detectNotTarget("Olá Lia! Esse não é o contato do Danilo. Vou te encaminhar o correto.")).toBe(
      "not_this_person",
    );
  });
  it("não encerra conversas legítimas", () => {
    expect(detectNotTarget("Não é o momento")).toBeNull();
    expect(detectNotTarget("Não sou o Rafael, mas cuido da TI")).toBeNull();
    expect(detectNotTarget("sou eu quem cuida da área")).toBeNull();
  });
});

describe("decideThirdParty", () => {
  it("Andre: recusa já na mesma mensagem encerra sem pedir indicação", () => {
    const d = decideThirdParty([
      out("Seria você?"),
      inn("não sei te dizer, pois já faz uns 5 anos que saí da Opentech"),
    ]);
    expect(d.action).toBe("close");
  });
  it("Andre: após a pergunta, 'perdi o contato' encerra", () => {
    const d = decideThirdParty([
      inn("faz uns 5 anos que saí da Opentech"),
      out(REFERRAL_QUESTION),
      inn("realmente não sei te dizer, perdi o contato do pessoal de lá"),
    ]);
    expect(d.action).toBe("close");
  });
  it("Rafael: pergunta UMA vez pela indicação", () => {
    const d = decideThirdParty([out("Seria você?"), inn("Esse telefone não é de Rafael")]);
    expect(d.action).toBe("ask_referral");
  });
  it("não pergunta duas vezes", () => {
    const d = decideThirdParty([
      inn("Esse telefone não é de Rafael"),
      out(REFERRAL_QUESTION),
      inn("hmm"),
    ]);
    expect(d.action).toBe("close");
  });
  it("Danilo: promessa aguarda, cartão salva", () => {
    const h = [inn("Esse não é o contato do Danilo. Vou te encaminhar o correto.")];
    expect(decideThirdParty(h).action).toBe("wait_referral");
    const d = decideThirdParty([
      ...h,
      out("Obrigada! Fico no aguardo do contato."),
      inn("👤 Contato compartilhado\nDanilo Aguiar: +55 15 98144-1500"),
    ]);
    expect(d.action).toBe("save_referral");
    if (d.action === "save_referral") {
      expect(d.referral).toEqual({ name: "Danilo Aguiar", phoneE164: "+5515981441500" });
    }
  });
  it("conversa normal não é afetada", () => {
    expect(decideThirdParty([inn("Tenho um projeto parado")]).action).toBe("none");
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

describe("isQualificationQuestion", () => {
  it("bloqueia as perguntas do caso Danilo", () => {
    expect(isQualificationQuestion("Posso saber qual a necessidade de TI do responsável?")).toBe(true);
    expect(
      isQualificationQuestion("Você gostaria de falar sobre algum desafio específico ou projeto que estejam planejando?"),
    ).toBe(true);
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
