import { describe, expect, it } from "vitest";
import { renderWorkflowTokens } from "./render-tokens";

describe("renderWorkflowTokens", () => {
  const after = { first_name: "Ana", company_id: "c-1", owner: { name: "Bruno" } };

  it("resolve campos da entidade do gatilho", () => {
    expect(renderWorkflowTokens("Olá {{first_name}}", after, {})).toBe("Olá Ana");
  });

  it("resolve caminho aninhado", () => {
    expect(renderWorkflowTokens("{{owner.name}}", after, {})).toBe("Bruno");
  });

  it("resolve {{vars.X}} e {{steps.N.campo}}", () => {
    const vars = { plano: "Pro", steps: { 2: { id: "abc" } } };
    expect(renderWorkflowTokens("{{vars.plano}} / {{steps.2.id}}", after, vars)).toBe("Pro / abc");
  });

  it("token ausente vira vazio e não-string passa direto", () => {
    expect(renderWorkflowTokens("[{{inexistente}}]", after, {})).toBe("[]");
    expect(renderWorkflowTokens(42, after, {})).toBe(42);
  });
});
