import { describe, expect, it } from "vitest";
import { hasBodyText, plainTextToBodyHtml } from "./import-body";

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
