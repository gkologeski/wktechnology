import { describe, expect, it } from "vitest";
import { parseAgentConfig, shouldAttachMaterials, stripUrls } from "./agent-config";
import { buildSystemPrompt } from "./agent.server";
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
  it("intenção configurada aparece como rótulo, sem estratégia escondida", () => {
    const s = buildSystemPrompt({
      offers: [],
      materials: [],
      questions: [],
      persona: parsePersona({ intent: "service" }),
    });
    expect(s).toContain("Intenção configurada: atendimento");
    expect(s).not.toMatch(/Seja ativa e persuasiva/);
  });
});
