import { describe, expect, it } from "vitest";
import { copyName, personaCopy, playbookCopyFields } from "./duplicate-agent";

const source = {
  id: "11111111-1111-1111-1111-111111111111",
  owner_id: "owner-a",
  workspace_id: "ws-a",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
  name: "Lia",
  enabled: true,
  channel: "whatsapp",
  mode: "auto",
  max_messages: 7,
  steps: [{ delay_hours: 0, template: "Oi" }],
  guardrails: { customer_wait_seconds: 5 },
  material_ids: ["m1"],
  offer_keys: ["o1"],
  allowed_tools: ["qualify", "schedule"],
  assigned_to: "host-1",
  questionnaire_id: "q1",
  kb_sources: [{ url: "https://exemplo.com.br" }],
};

describe("duplicar agente SDR", () => {
  it("copia todo o conteúdo do playbook", () => {
    const out = playbookCopyFields(source, ["Lia"]);
    expect(out).toMatchObject({
      channel: "whatsapp",
      mode: "auto",
      max_messages: 7,
      steps: [{ delay_hours: 0, template: "Oi" }],
      guardrails: { customer_wait_seconds: 5 },
      material_ids: ["m1"],
      offer_keys: ["o1"],
      allowed_tools: ["qualify", "schedule"],
      assigned_to: "host-1",
      questionnaire_id: "q1",
      kb_sources: [{ url: "https://exemplo.com.br" }],
    });
  });

  it("não copia identificação, dono, workspace nem datas", () => {
    const out = playbookCopyFields(source, []);
    for (const key of ["id", "owner_id", "workspace_id", "created_at", "updated_at"])
      expect(out).not.toHaveProperty(key);
  });

  it("a cópia nasce desativada", () => {
    expect(playbookCopyFields(source, []).enabled).toBe(false);
  });

  it("nome recebe (cópia) e numeração quando já existe", () => {
    expect(copyName("Lia", ["Lia"])).toBe("Lia (cópia)");
    expect(copyName("Lia", ["Lia", "lia (cópia)"])).toBe("Lia (cópia 2)");
  });

  it("nome da cópia nunca passa de 120 caracteres", () => {
    expect(copyName("x".repeat(120), []).length).toBeLessThanOrEqual(120);
    expect(copyName("x".repeat(120), [])).toMatch(/\(cópia\)$/);
  });

  it("persona vem do rascunho quando existe", () => {
    const out = personaCopy([
      { status: "published", persona: { name: "pub" }, tool_config: { a: 1 } },
      { status: "draft", persona: { name: "rascunho" }, tool_config: { a: 2 }, notes: "n" },
    ]);
    expect(out).toMatchObject({
      status: "draft",
      version: 1,
      persona: { name: "rascunho" },
      tool_config: { a: 2 },
      notes: "n",
      copiedFrom: "draft",
    });
  });

  it("sem rascunho, a publicada vira rascunho da cópia (nunca publicada)", () => {
    const out = personaCopy([{ status: "published", persona: { name: "pub" } }]);
    expect(out?.status).toBe("draft");
    expect(out?.persona).toEqual({ name: "pub" });
    expect(out?.copiedFrom).toBe("published");
  });

  it("versões arquivadas não são copiadas", () => {
    expect(personaCopy([{ status: "archived", persona: {} }])).toBeNull();
  });
});
