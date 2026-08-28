import { describe, it, expect } from "vitest";
import { normalizeLinkedinUrl, linkedinUrlOrNull, sameLinkedinUrl } from "./linkedin-url";

describe("normalizeLinkedinUrl", () => {
  it("canoniza variações de host, esquema e barra final", () => {
    for (const input of [
      "linkedin.com/in/joao-silva",
      "www.linkedin.com/in/joao-silva/",
      "http://br.linkedin.com/in/joao-silva",
      "  https://www.linkedin.com/in/joao-silva  ",
    ]) {
      const result = normalizeLinkedinUrl(input);
      expect(result.ok && result.url).toBe("https://www.linkedin.com/in/joao-silva");
    }
  });

  it("remove parâmetros de rastreio", () => {
    const result = normalizeLinkedinUrl(
      "https://www.linkedin.com/in/joao-silva?originalSubdomain=br&utm_source=x",
    );
    expect(result.ok && result.url).toBe("https://www.linkedin.com/in/joao-silva");
  });

  it("recusa páginas que não são perfil pessoal", () => {
    for (const input of [
      "https://www.linkedin.com/company/acme",
      "https://www.linkedin.com/posts/joao_algo-123",
      "https://www.linkedin.com/search/results/all/?keywords=joao",
      "https://example.com/in/joao-silva",
      "não é url",
      "",
    ]) {
      expect(normalizeLinkedinUrl(input).ok).toBe(false);
    }
  });

  it("dá mensagens específicas por tipo de link recusado", () => {
    const msg = (input: string) => {
      const r = normalizeLinkedinUrl(input);
      return r.ok ? "" : r.error;
    };
    expect(msg("")).toContain("Informe o link do LinkedIn");
    expect(msg("https://www.linkedin.com/company/acme")).toContain("página de empresa");
    expect(msg("https://www.linkedin.com/school/usp")).toContain("instituição");
    expect(msg("https://www.linkedin.com/posts/joao_algo-123")).toContain("publicação");
    expect(msg("https://www.linkedin.com/search/results/all/?keywords=joao")).toContain("busca");
    expect(msg("https://www.linkedin.com/sales/lead/123")).toContain("Sales Navigator");
    expect(msg("https://example.com/in/joao-silva")).toContain("não é do LinkedIn");
    expect(msg("não é url")).toContain("Link inválido");
  });

  it("linkedinUrlOrNull devolve null em entrada inválida", () => {
    expect(linkedinUrlOrNull("https://www.linkedin.com/company/acme")).toBeNull();
    expect(linkedinUrlOrNull(null)).toBeNull();
    expect(linkedinUrlOrNull("linkedin.com/in/ana")).toBe("https://www.linkedin.com/in/ana");
  });

  it("sameLinkedinUrl compara ignorando formato", () => {
    expect(sameLinkedinUrl("linkedin.com/in/ana/", "https://www.linkedin.com/in/ana")).toBe(true);
    expect(sameLinkedinUrl("linkedin.com/in/ana", "linkedin.com/in/bia")).toBe(false);
  });
});
