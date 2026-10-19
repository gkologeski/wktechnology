import { describe, expect, it } from "vitest";
import { detectCompanyLeft, extractNewCompany } from "./third-party";

describe("saiu da empresa → sugestão de troca", () => {
  it("Juliano: frase real", () => {
    expect(detectCompanyLeft("Nao trabalho mais na Alumisoft")).toEqual({ newCompany: null });
  });
  it("com nova empresa", () => {
    expect(detectCompanyLeft("Saí da Alumisoft e agora estou na Xpto Sistemas.")?.newCompany).toBe(
      "Xpto Sistemas",
    );
    expect(extractNewCompany("Não trabalho mais lá, fui para a Totvs")).toBe("Totvs");
  });
  it("controles", () => {
    expect(detectCompanyLeft("saí da reunião agora")).toBeNull();
    expect(detectCompanyLeft("o sistema saiu do ar")).toBeNull();
    expect(detectCompanyLeft("Sou eu mesmo, como posso ajudar?")).toBeNull();
    expect(extractNewCompany("não estou na empresa hoje")).toBeNull();
  });
});
