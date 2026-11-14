import { describe, expect, it } from "vitest";
import { esignBodyHtml, isHtmlEsignBody } from "./body-format";

describe("esign body format", () => {
  it("texto antigo continua como texto", () => {
    expect(isHtmlEsignBody("Aditivo\n\nContrato: X")).toBe(false);
    expect(esignBodyHtml("Aditivo")).toBeNull();
  });
  it("documento formatado mantém marcações e remove script", () => {
    const html = esignBodyHtml(
      "<!--techerp:html--><h1>Aditivo</h1><p><strong>A</strong></p><script>x()</script>",
    );
    expect(html).toContain("<h1>Aditivo</h1>");
    expect(html).toContain("<strong>A</strong>");
    expect(html).not.toContain("script");
  });
});
