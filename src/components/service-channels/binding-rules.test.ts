import { describe, expect, it } from "vitest";
import { bindingIssues, campaignsLabel } from "./binding-rules";

const ok = { accountEnabled: true, agentId: "a1", inbound: true, campaigns: true, agentEnabled: true };

describe("bindingIssues", () => {
  it("aceita agente automático com conta ativa, agente e modo", () => {
    expect(bindingIssues(ok)).toEqual([]);
  });
  it("não exige nada quando o agente automático está desligado", () => {
    expect(bindingIssues({ ...ok, agentEnabled: false, agentId: null, accountEnabled: false })).toEqual([]);
  });
  it("exige agente escolhido", () => {
    expect(bindingIssues({ ...ok, agentId: null })).toEqual(["Escolha o agente responsável."]);
  });
  it("exige conta com automação permitida", () => {
    expect(bindingIssues({ ...ok, accountEnabled: false })).toHaveLength(1);
  });
  it("exige ao menos um modo de atendimento", () => {
    expect(bindingIssues({ ...ok, inbound: false, campaigns: false })).toHaveLength(1);
    expect(bindingIssues({ ...ok, inbound: false })).toEqual([]);
  });
});

describe("campaignsLabel", () => {
  it("nomeia a opção conforme o canal", () => {
    expect(campaignsLabel("email")).toBe("Após sequências e campanhas por e-mail");
    expect(campaignsLabel("whatsapp")).toBe("Após campanhas WhatsApp");
  });
});
