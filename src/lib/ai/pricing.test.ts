import { describe, expect, it } from "vitest";
import { estimateCostUsd, parseUsage } from "./pricing";

describe("custo de IA", () => {
  it("estima custo por modelo conhecido", () => {
    expect(
      estimateCostUsd("openai", "gpt-4o-mini", {
        prompt_tokens: 1_000_000,
        completion_tokens: 1_000_000,
      }),
    ).toBe(0.75);
  });
  it("não estima para Lovable ou modelo sem preço", () => {
    expect(estimateCostUsd("lovable", "x", { prompt_tokens: 10 })).toBeNull();
    expect(estimateCostUsd("openai", "desconhecido", { prompt_tokens: 10 })).toBeNull();
  });
  it("lê usage de JSON e de stream SSE", () => {
    expect(parseUsage('{"usage":{"prompt_tokens":3,"completion_tokens":4}}')).toEqual({
      prompt_tokens: 3,
      completion_tokens: 4,
    });
    const sse =
      'data: {"choices":[]}\n\ndata: {"usage":{"prompt_tokens":5,"completion_tokens":6}}\n\ndata: [DONE]\n';
    expect(parseUsage(sse)).toEqual({ prompt_tokens: 5, completion_tokens: 6 });
    expect(parseUsage("lixo")).toBeNull();
  });
});
