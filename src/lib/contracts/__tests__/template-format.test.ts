import { describe, expect, it } from "vitest";
import { docxXmlToHtml } from "../docx-formatted-html";
import { applyTokenSuggestions, sanitizeTemplateHtml } from "../template-html-format";

const doc = (body: string) => `<w:document><w:body>${body}<w:sectPr/></w:body></w:document>`;

describe("docxXmlToHtml", () => {
  it("preserva alinhamento centralizado, justificado e negrito", () => {
    const html = docxXmlToHtml({
      document: doc(
        `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>CONTRATO</w:t></w:r></w:p>` +
          `<w:p><w:pPr><w:jc w:val="both"/><w:ind w:firstLine="720"/></w:pPr><w:r><w:t>Corpo</w:t></w:r></w:p>`,
      ),
    });
    expect(html).toContain('<p style="text-align: center"><strong>CONTRATO</strong></p>');
    expect(html).toContain('<p style="text-align: justify; text-indent: 36pt">Corpo</p>');
  });

  it("gera a numeração original das cláusulas", () => {
    const numbering = `<w:numbering><w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="CLÁUSULA %1ª"/></w:lvl></w:abstractNum><w:num w:numId="5"><w:abstractNumId w:val="1"/></w:num></w:numbering>`;
    const p = `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="5"/></w:numPr></w:pPr><w:r><w:t>Objeto</w:t></w:r></w:p>`;
    const html = docxXmlToHtml({ document: doc(p + p), numbering });
    expect(html).toContain("CLÁUSULA 1ª&ensp;Objeto");
    expect(html).toContain("CLÁUSULA 2ª&ensp;Objeto");
  });

  it("converte tabelas com bordas", () => {
    const html = docxXmlToHtml({
      document: doc(`<w:tbl><w:tr><w:tc><w:p><w:r><w:t>A</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`),
    });
    expect(html).toContain("<table");
    expect(html).toContain("border: 1px solid");
  });
});

describe("sanitizeTemplateHtml", () => {
  it("mantém alinhamento e remove scripts e eventos", () => {
    const out = sanitizeTemplateHtml(
      `<p style="text-align: center; background: url(x)" onclick="x()">Oi</p><script>alert(1)</script>`,
    );
    expect(out).toBe('<p style="text-align: center">Oi</p>');
  });
});

describe("applyTokenSuggestions", () => {
  it("troca só o texto, sem tocar na formatação", () => {
    const r = applyTokenSuggestions('<p style="text-align: justify">ACME LTDA, CNPJ 12</p>', [
      { original: "ACME LTDA", token: "{{counterparty.name}}" },
      { original: "Inexistente", token: "{{contract.monthly_value}}" },
    ]);
    expect(r.html).toBe('<p style="text-align: justify">{{counterparty.name}}, CNPJ 12</p>');
    expect(r.unmatched).toEqual(["Inexistente"]);
  });
});
