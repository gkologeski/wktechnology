import { describe, expect, it } from "vitest";
import { renderTokens } from "./email-tokens";

describe("renderTokens", () => {
  it("resolve chaves simples", () => {
    expect(renderTokens("Olá {{first_name}}!", { first_name: "Ana" })).toBe("Olá Ana!");
  });

  it("resolve chaves com ponto em objetos aninhados", () => {
    const out = renderTokens("Att, {{agent.name}} ({{agent.email}})", {
      agent: { name: "Bruno", email: "bruno@wk.com" },
    });
    expect(out).toBe("Att, Bruno (bruno@wk.com)");
  });

  it("resolve chaves com ponto declaradas de forma plana", () => {
    expect(renderTokens("Vaga: {{job.title}}", { "job.title": "Dev" })).toBe("Vaga: Dev");
  });

  it("tolera espaços e substitui ausentes por vazio", () => {
    expect(renderTokens("[{{ company }}]", {})).toBe("[]");
  });
});
