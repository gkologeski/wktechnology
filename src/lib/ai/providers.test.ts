import { describe, expect, it } from "vitest";
import { adaptBody, buildExternalRoute } from "./providers";

describe("provedores de IA", () => {
  it("monta URL e cabeçalhos da OpenRouter", () => {
    const r = buildExternalRoute("openrouter", "k", "");
    expect(r.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(r.headers.Authorization).toBe("Bearer k");
    expect(r.headers["X-Title"]).toBe("TechERP");
    expect(r.model).toBe("openrouter/auto");
  });
  it("usa endpoint compatível do Gemini", () => {
    expect(buildExternalRoute("google", "k", "gemini-2.5-pro").url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    );
  });
  it("troca o modelo só em provedor externo", () => {
    const body = { model: "google/gemini-3-flash-preview", reasoning: {}, messages: [] };
    expect(adaptBody(body, { provider: "lovable", url: "", headers: {}, model: null })).toBe(body);
    const out = adaptBody(body, buildExternalRoute("openai", "k", "gpt-4.1"));
    expect(out.model).toBe("gpt-4.1");
    expect(out.reasoning).toBeUndefined();
  });
  it("rejeita a Lovable como provedor externo", () => {
    expect(() => buildExternalRoute("lovable", "k", "")).toThrow();
  });
});
