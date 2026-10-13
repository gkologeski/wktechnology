import { describe, expect, it } from "vitest";
import { collectWhatsAppSteps, validateWhatsAppStep, whatsAppIdempotencyKey } from "./whatsapp-step";

const tpl = {
  name: "mensagem001",
  language: "pt_BR",
  components: [{ type: "BODY", text: "Olá {{1}}, sou {{2}} da {{3}}" }],
};

describe("passo WhatsApp do fluxo", () => {
  it("texto livre não é publicável", () => {
    expect(validateWhatsAppStep({ body: "oi" }, [tpl])?.code).toBe("TEMPLATE_REQUIRED");
  });
  it("modelo fora do catálogo aprovado é recusado", () => {
    expect(validateWhatsAppStep({ template_name: "x" }, [tpl])?.code).toBe("TEMPLATE_NOT_APPROVED");
  });
  it("exige as 3 variáveis do modelo", () => {
    const step = { template_name: "mensagem001", template_variables: ["a", "b"] };
    expect(validateWhatsAppStep(step, [tpl])?.code).toBe("TEMPLATE_VARIABLES_INCOMPLETE");
    expect(validateWhatsAppStep({ ...step, template_variables: ["a", "b", "c"] }, [tpl])).toBeNull();
  });
  it("encontra passos dentro de ramos", () => {
    const steps = collectWhatsAppSteps([
      { type: "branch_if", filters: [], then: [{ type: "send_whatsapp" }], else: [] },
      { type: "branch_multi", branches: [{ actions: [{ type: "send_whatsapp" }] }], else: [] },
    ]);
    expect(steps).toHaveLength(2);
  });
  it("chave de idempotência só existe com run", () => {
    const base = { workspaceId: "w", entityId: "e", template: "t", to: "+55 48 9" };
    expect(whatsAppIdempotencyKey(base)).toBeNull();
    expect(whatsAppIdempotencyKey({ ...base, runId: "r" })).toBe("wf:w:r:e:t:55489");
  });
});
