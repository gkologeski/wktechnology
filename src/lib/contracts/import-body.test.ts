import { describe, expect, it } from "vitest";
import { fitBodyHtml, hasBodyText, plainTextToBodyHtml } from "./import-body";

describe("plainTextToBodyHtml", () => {
  it("junta linhas quebradas e separa cláusulas", () => {
    const html = plainTextToBodyHtml(
      "CLÁUSULA PRIMEIRA – DO OBJETO\nO presente contrato tem por\nobjeto a prestação de serviços.\nCLÁUSULA SEGUNDA – DO VALOR\nR$ 18.870,00",
    );
    expect(html).toBe(
      "<p>CLÁUSULA PRIMEIRA – DO OBJETO</p><p>O presente contrato tem por objeto a prestação de serviços.</p><p>CLÁUSULA SEGUNDA – DO VALOR</p><p>R$ 18.870,00</p>",
    );
  });
  it("escapa HTML do texto", () => {
    expect(plainTextToBodyHtml("a <b> & c")).toBe("<p>a &lt;b&gt; &amp; c</p>");
  });
  it("considera vazio o corpo sem texto", () => {
    expect(hasBodyText("<p> </p>")).toBe(false);
  });
});

describe("caracteres de controle do PDF", () => {
  it("remove NUL que o banco recusa e mantém o texto", () => {
    const html = plainTextToBodyHtml(
      "CLÁUSULA 1\u0000 – OBJETO\nTexto do contrato com\u0000 serviços de consultoria.",
    );
    expect(html.includes("\u0000")).toBe(false);
    expect(html).toContain("CLÁUSULA 1 – OBJETO");
  });
  it("fitBodyHtml limpa NUL vindo de qualquer leitor", () => {
    const r = fitBodyHtml("<p>" + "Texto do contrato\u0000 ".repeat(5) + "</p>");
    expect(r.html?.includes("\u0000")).toBe(false);
  });
});
