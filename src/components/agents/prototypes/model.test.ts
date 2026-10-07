import { describe, expect, it } from "vitest";
import { demoReply, makeAgents, validateStep } from "./model";

describe("protótipos multiagente locais", () => {
  it("mantém persona, fontes, fluxo e anfitrião independentes", () => {
    const [sales, technical] = makeAgents();
    sales!.nodes[0]!.title = "Entrada comercial";
    sales!.nodes.find((n) => n.type === "schedule")!.config.host = "Outro";
    sales!.sources[0]!.text = "Novo conteúdo local";
    sales!.persona = "Outra persona";
    expect(technical!.nodes[0]!.title).toBe("Início");
    expect(technical!.persona).toBe("Alex");
    expect(technical!.host).not.toBe(sales!.host);
    expect(technical!.nodes.find((n) => n.type === "schedule")!.config.host).toBe(technical!.host);
    expect(makeAgents()[0]!.sources[0]!.text).not.toBe("Novo conteúdo local");
  });
  it("valida identidade, persona, conhecimento, agenda e canal", () => {
    const agent = makeAgents()[0]!;
    for (let step = 0; step < 8; step++) expect(validateStep(agent, step)).toBeNull();
    expect(validateStep({ ...agent, name: " " }, 0)).toBeTruthy();
    expect(validateStep({ ...agent, instructions: "" }, 1)).toBeTruthy();
    expect(validateStep({ ...agent, sources: [] }, 2)).toBeTruthy();
    expect(validateStep({ ...agent, nodes: [] }, 3)).toBeTruthy();
    expect(validateStep({ ...agent, host: "" }, 4)).toBeTruthy();
    expect(validateStep({ ...agent, channel: "Nenhum canal" }, 5)).toBeTruthy();
  });
  it("simula agendas e fontes do agente escolhido, sem efeitos externos", () => {
    const [sales, technical] = makeAgents();
    expect(demoReply(sales!, "Quero uma reunião")).toContain("Closer");
    expect(demoReply(technical!, "Quero uma reunião")).toContain("P.O.");
    expect(demoReply(technical!, "Dúvida técnica")).toContain("Guia do Projeto Aurora");
    expect(demoReply(sales!, "Quero falar com uma pessoa")).toContain("não precisa repetir");
  });
});
