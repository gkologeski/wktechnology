import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./agent.server";

describe("indicação já completa", () => {
  it("instrui a não pedir nome completo quando nome e telefone já vieram", () => {
    const text = buildSystemPrompt({} as Parameters<typeof buildSystemPrompt>[0]);
    expect(text).toContain("Indicação já completa");
    expect(text).toContain('nunca peça "nome completo"');
    expect(text).toContain("peça apenas o contato");
  });
});
