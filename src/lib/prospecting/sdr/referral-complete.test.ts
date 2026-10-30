import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./agent.server";

describe("indicação já completa", () => {
  it("instrui a não pedir nome completo quando nome e telefone já vieram", () => {
    const text = buildSystemPrompt({ offers: [], materials: [], questions: [], bookingAvailable: false } as unknown as Parameters<typeof buildSystemPrompt>[0]);
    expect(text).toContain("Indicação já completa");
    expect(text).toContain("não pode conter pergunta sobre a pessoa indicada");
    expect(text).toContain("peça apenas o contato");
  });

  it("cartão com nome nunca é tratado como telefone solto", () => {
    const text = buildSystemPrompt({ offers: [], materials: [], questions: [], bookingAvailable: false } as unknown as Parameters<typeof buildSystemPrompt>[0]);
    expect(text).toContain("PRIORIDADE sobre a regra do telefone solto");
    expect(text).toContain('Cartão "Contato compartilhado" com nome NUNCA é telefone solto');
  });
});
