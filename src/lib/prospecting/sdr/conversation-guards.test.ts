import { describe, expect, it } from "vitest";
import {
  asksDecisionMaker,
  claimsMaterialSent,
  correctedName,
  dedupeRepeatedWords,
  extractCorporatePhone,
  fixVocative,
  greetingName,
  isAiIdentityQuestion,
  notTheMoment,
  offersToKeepContact,
  refusedMeeting,
  repeatsIdenticalInbound,
  selfIdentifiedResponsible,
  showsBusinessInterest,
} from "./conversation-guards";
import { isAutoResponder } from "./third-party";

const out = (body: string) => ({ direction: "outbound", body });
const inn = (body: string) => ({ direction: "inbound", body });

describe("Pedro Lanna", () => {
  const h = [
    out("Olá, Pedro, tudo bem?  Aqui é Lia, da WK Technology."),
    inn("sou eu mesmo"),
    inn("Me chamo Pedro.  Acho que não é necessário uma reunião."),
    inn(
      "Não é necessário uma reunião. Qualquer informação necessária para o orçamento, pode me solicitar",
    ),
  ];
  it("corrige palavra duplicada", () => {
    expect(dedupeRepeatedWords("O custo varia conforme senioridade e senioridade, mas")).toBe(
      "O custo varia conforme senioridade, mas",
    );
  });
  it("troca vocativo errado pelo nome do cliente", () => {
    expect(
      fixVocative("José, entendo sua preocupação.", [
        correctedName(h) ?? "",
        greetingName(h) ?? "",
      ]),
    ).toBe("Pedro, entendo sua preocupação.");
    expect(fixVocative("Claro, entendo.", ["Pedro"])).toBe("Claro, entendo.");
  });
  it("reconhece recusa de reunião com interesse real", () => {
    expect(refusedMeeting(h)).toBe(true);
    expect(showsBusinessInterest(h)).toBe(true);
    expect(refusedMeeting([inn("Podemos fazer uma reunião na terça")])).toBe(false);
  });
  it("não pergunta decisor de quem já é responsável", () => {
    expect(selfIdentifiedResponsible(h)).toBe(true);
    expect(asksDecisionMaker("Qual seu cargo na RLM e quem será o decisor final?")).toBe(true);
    expect(selfIdentifiedResponsible([out("Essa área fica com você?"), inn("Sim")])).toBe(true);
    expect(selfIdentifiedResponsible([inn("Bom dia")])).toBe(false);
  });
});

describe("Rafael Acacio / Henrique", () => {
  it("'não é o momento' não oferece manter contato", () => {
    expect(notTheMoment("Não no momento. Nem para os próximos 2 anos")).toBe(true);
    expect(
      offersToKeepContact(
        "Posso anotar para não enviar mais mensagens, ou prefere receber novidades?",
      ),
    ).toBe(true);
    expect(notTheMoment("Sim, temos demanda agora")).toBe(false);
  });
});

describe("Luiz Feitosa / Wagner", () => {
  it("detecta promessa de material", () => {
    expect(claimsMaterialSent("Material enviado! Quando quiser...")).toBe(true);
    expect(claimsMaterialSent("Já estou enviando o material sobre a WK")).toBe(true);
    expect(claimsMaterialSent("Vou reenviar o material para você agora mesmo.")).toBe(true);
    expect(claimsMaterialSent("Qual a principal dificuldade de TI?")).toBe(false);
  });
});

describe("Renato / Will", () => {
  it("pergunta sobre IA", () => {
    expect(isAiIdentityQuestion("Você é uma IA?")).toBe(true);
    expect(isAiIdentityQuestion("vc é robô?")).toBe(true);
    expect(isAiIdentityQuestion("Estou falando com uma pessoa de verdade?")).toBe(true);
    expect(isAiIdentityQuestion("Vocês trabalham com IA generativa?")).toBe(false);
  });
});

describe("Renan Mantovanini", () => {
  it("extrai número corporativo", () => {
    expect(extractCorporatePhone("Renan Corporativo (14) 99729-7556")).toBe("+5514997297556");
    expect(extractCorporatePhone("Temos 14 desenvolvedores")).toBeNull();
  });
});

describe("Anderson (robô)", () => {
  const menu =
    " Você já possui uma rede de afiliados/revendedores ou está começando do zero?\n1️⃣ - Tenho Rede\n2️⃣ - Estou Começando";
  it("repetição idêntica indica robô", () => {
    expect(repeatsIdenticalInbound([inn(menu), out("x"), inn(menu)])).toBe(true);
    expect(repeatsIdenticalInbound([inn(menu)])).toBe(false);
  });
  it("frase de transferência do robô", () => {
    expect(
      isAutoResponder(
        "Olá! Você ainda está aí?👋 Gostaria de saber valores ou prefere que te transfira para um dos nossos especialistas?",
      ),
    ).toBe(true);
    expect(isAutoResponder("1) React 2) Node")).toBe(false);
  });
});
