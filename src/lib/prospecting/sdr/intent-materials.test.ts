import { describe, expect, it } from "vitest";
import { parseAgentConfig, shouldAttachMaterials, stripUrls } from "./agent-config";
import { buildSystemPrompt, intentSection } from "./agent.server";
import { parsePersona } from "./persona";

describe("anexo de materiais", () => {
  it("não anexa ao só oferecer", () => {
    expect(shouldAttachMaterials({ intent: "reply", materialIds: ["a"] })).toBe(false);
  });
  it("anexa quando o cliente pediu e o agente permite", () => {
    expect(shouldAttachMaterials({ intent: "send_material", materialIds: ["a"] })).toBe(true);
  });
  it("não anexa com a opção desligada", () => {
    expect(
      shouldAttachMaterials({
        intent: "send_material",
        materialIds: ["a"],
        attachMaterials: false,
      }),
    ).toBe(false);
  });
  it("padrão da opção é ligado", () => {
    expect(parseAgentConfig({}).guardrails.attach_materials).toBe(true);
  });
  it("remove URLs escritas pela IA", () => {
    expect(stripUrls("Veja Hunting de TI: https://wktechnology.com.br/hunting.html")).toBe(
      "Veja Hunting de TI:",
    );
  });
});

describe("intenção do agente", () => {
  it("padrão é prospecção", () => {
    expect(parsePersona({}).intent).toBe("prospecting");
  });
  it("prospecção busca reunião e atendimento só informa", () => {
    expect(intentSection("prospecting")).toMatch(/reunião/);
    expect(intentSection("service")).toMatch(/informar/);
  });
  it("prompt pede desambiguação Hunting/Outsourcing", () => {
    const s = buildSystemPrompt({
      offers: [],
      materials: [],
      questions: [],
      bookingAvailable: false,
      persona: parsePersona({ intent: "service" }),
    });
    expect(s).toContain("INTENÇÃO: ATENDIMENTO");
    expect(s).toMatch(/outsourcing/);
  });
});
