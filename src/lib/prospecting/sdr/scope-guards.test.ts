import { describe, expect, it } from "vitest";
import { asksContactSource, isOffTopic, outOfIcpRole } from "./conversation-guards";
import { decideThirdParty, REFERRAL_THANKS } from "./third-party";

describe("casos 19/10", () => {
  it("Thiago Debs: cartão compartilhado vira indicação e encerra", () => {
    const d = decideThirdParty([
      { direction: "outbound", body: "Olá, Thiago... Essa área fica com você?" },
      { direction: "inbound", body: "tudo bem e com voce?" },
      { direction: "outbound", body: "Qual a maior dificuldade?" },
      {
        direction: "inbound",
        body: "👤 Contato compartilhado\nRafael Montini (Zhaz): +55 11 91717-7728",
      },
    ]);
    expect(d.action).toBe("save_referral");
    if (d.action === "save_referral") {
      expect(d.reply).toBe(REFERRAL_THANKS);
      expect(d.referral.phoneE164).toBe("+5511917177728");
    }
  });

  it("Otávio: mensagem para outra pessoa é fora de contexto", () => {
    expect(
      isOffTopic(
        "Amor, hoje acordei sentindo o cheiro de todas as coisas e com a sensação de presença real.",
      ),
    ).toBe(true);
    expect(isOffTopic("Atualmente não, mas posso ficar com o seu contato.")).toBe(false);
    expect(isOffTopic("Sim")).toBe(false);
  });

  it("Jhoni: desenvolvedor fica fora do público", () => {
    expect(
      outOfIcpRole(
        "Olá, tudo bem. E você? Sou desenvolvedor da antiga Bluway, agora chamada Blulojas Sistemas. Como eu poderia ajudar?",
      ),
    ).toBe(true);
    expect(outOfIcpRole("Sou desenvolvedor e gestor da equipe de TI")).toBe(false);
    expect(outOfIcpRole("Sou o responsável pela TI")).toBe(false);
  });

  it("Luiz Cezar: pergunta sobre origem do contato", () => {
    expect(asksContactSource("quem foi a indicação ?")).toBe(true);
    expect(asksContactSource("não sei como vc chegou a meu contato")).toBe(true);
    expect(asksContactSource("preciso montar um setor comercial")).toBe(false);
  });
});
