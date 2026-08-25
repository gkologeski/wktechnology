import { describe, expect, it } from "vitest";
import {
  buildAssociationTextTokens,
  priorStepRefOptions,
  triggerRefOptions,
} from "./association-tokens";

describe("association-tokens", () => {
  it("gera pills de dados associados ao gatilho", () => {
    const t = buildAssociationTextTokens("deals").map((x) => x.token);
    expect(t).toContain("{{company.name}}");
    expect(t).toContain("{{primary_contact.email}}");
  });

  it("oferece IDs do gatilho compatíveis com o tipo do campo", () => {
    const company = triggerRefOptions("deals", "company").map((o) => o.token);
    expect(company).toContain("{{company_id}}");
    expect(company).not.toContain("{{primary_contact_id}}");

    const self = triggerRefOptions("companies", "company").map((o) => o.token);
    expect(self).toContain("{{id}}");
  });

  it("oferece saídas de passos anteriores do mesmo tipo", () => {
    const steps = [
      { index: 0, type: "create_company", label: "Criar empresa" },
      { index: 1, type: "send_email", label: "Enviar e-mail" },
    ];
    expect(priorStepRefOptions(steps, "company").map((o) => o.token)).toEqual(["{{steps.0.id}}"]);
    expect(priorStepRefOptions(steps, "contact")).toEqual([]);
  });
});
