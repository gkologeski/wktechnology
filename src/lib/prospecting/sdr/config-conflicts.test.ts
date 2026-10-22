import { describe, expect, it } from "vitest";
import { parseAgentConfig } from "./agent-config";
import { configConflicts } from "./config-conflicts";
import { parsePersona } from "./persona";

describe("conflitos de configuração (só aponta, não corrige)", () => {
  it("material ligado nas ferramentas e desligado nos controles é crítico", () => {
    const c = configConflicts({
      persona: parsePersona({}),
      config: parseAgentConfig({ guardrails: { attach_materials: false } }),
      tools: {
        enabled_tools: ["materials.send"],
        scheduling: null,
        allowed_tags: [],
        automations: { ai_question_silence_handoff: { enabled: false, minutes: 30 } },
      },
      extraInstructions: null,
      directBookingReady: false,
    });
    expect(c.some((x) => x.severity === "critical" && /material/.test(x.message))).toBe(true);
  });
  it("persona sem valores e controle permitindo vira aviso", () => {
    const c = configConflicts({
      persona: parsePersona({ instructions: "Não informe valores." }),
      config: parseAgentConfig({ guardrails: { no_pricing: false } }),
      tools: null,
      extraInstructions: null,
      directBookingReady: true,
    });
    expect(c.map((x) => x.message)).toContain(
      "A persona proíbe informar valores, mas o controle comercial permite.",
    );
  });
  it("configuração coerente não aponta nada", () => {
    expect(
      configConflicts({
        persona: parsePersona({}),
        config: parseAgentConfig({}),
        tools: null,
        extraInstructions: null,
        directBookingReady: true,
      }),
    ).toEqual([]);
  });
});
