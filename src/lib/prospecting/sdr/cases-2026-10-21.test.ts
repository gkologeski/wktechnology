import { describe, expect, it } from "vitest";
import {
  decideThirdParty,
  detectCompanyLeft,
  isPostCloseQuestion,
  POST_CLOSE_REPLY,
  PRIVATE_NUMBER_CLOSE,
  CLOSE_THANKS,
} from "./third-party";
import {
  asksDecisionMaker,
  selfIdentifiedResponsible,
  OUT_OF_ICP_CLOSE,
} from "./conversation-guards";
import { detectOptOut, isUnavailabilityHandoff } from "./policy";

const out = (body: string) => ({ direction: "outbound", body });
const inb = (body: string) => ({ direction: "inbound", body });
const OPEN =
  "Só para eu direcionar meu contato corretamente: Na X, você é a pessoa responsável por TI?";

describe("casos 20–21/10", () => {
  it("Luciano: 'Sou uma das' após 'Bom dia' é responsável; 'decisora' é pergunta de decisor", () => {
    expect(selfIdentifiedResponsible([out(OPEN), inb("Bom dia"), inb("Sou uma das")])).toBe(true);
    expect(
      asksDecisionMaker("Você poderia confirmar se atua como decisora na área de TI da empresa?"),
    ).toBe(true);
  });

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

  it("Ricardo Silveira: número particular → desculpa e encerra", () => {
    const d = decideThirdParty([
      out(OPEN),
      inb("Este número não pertence mais a Ricardo"),
      inb("Não"),
      inb("Este número é particular"),
    ]);
    expect(d).toMatchObject({ action: "close", reply: PRIVATE_NUMBER_CLOSE });
  });

  it("Diana: 'não sei que empresa é essa' encerra sem pedir indicação", () => {
    const d = decideThirdParty([out(OPEN), inb("Boa noite, não. Nao sei que empresa é essa.")]);
    expect(d).toMatchObject({ action: "close", reply: CLOSE_THANKS });
  });

  it("Wiltomar: pergunta depois do encerramento recebe 'não' e despedida", () => {
    const h = [
      out(OPEN),
      inb("Sou desenvolvedor full stack"),
      out(OUT_OF_ICP_CLOSE),
      inb("Não precisa desculpar-se, mas precisa de algo em infra de TI?"),
    ];
    expect(isPostCloseQuestion(h)).toBe(true);
    expect(POST_CLOSE_REPLY).toMatch(/^Não/);
    expect(isPostCloseQuestion([out("Qual a maior dificuldade?"), inb("Como assim?")])).toBe(false);
  });

  it("Ricardo Oliveira: 'não entre mais em contato' é opt-out", () => {
    expect(detectOptOut("por favor não entre mais em contato, não temos interesse")).toBe(true);
    expect(detectOptOut("Obrigado Lia")).toBe(false);
  });

  it("Gilzon: handoff só por indisponibilidade de horário é reconhecido", () => {
    expect(isUnavailabilityHandoff("Sem disponibilidade no horário solicitado pelo cliente.")).toBe(
      true,
    );
    expect(isUnavailabilityHandoff("Cliente pediu para falar com um humano")).toBe(false);
  });
});
