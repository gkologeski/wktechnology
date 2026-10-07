import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import {
  checkImportUrl,
  docxToText,
  htmlToText,
  normalizeImported,
  pdfIsEncrypted,
  sniff,
} from "./extract";

describe("importação: segurança e extração", () => {
  it("SSRF: bloqueia internos e aceita públicos", () => {
    for (const u of [
      "http://localhost/a",
      "http://127.0.0.1",
      "http://10.0.0.5/x",
      "http://192.168.1.1",
      "http://[::1]/",
      "http://169.254.169.254/latest",
      "file:///etc/passwd",
      "http://user:pw@site.com",
      "http://site.com:8080",
      "http://2130706433/",
      "http://intranet/",
    ])
      expect(checkImportUrl(u).ok, u).toBe(false);
    expect(checkImportUrl("https://forms.exemplo.com.br/pesquisa").ok).toBe(true);
  });
  it("MIME por assinatura, não por extensão", () => {
    expect(sniff(strToU8("%PDF-1.7 ..."))?.kind).toBe("pdf");
    expect(sniff(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))?.mime).toBe("image/png");
    expect(sniff(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe("image/jpeg");
    expect(sniff(strToU8("RIFF0000WEBPVP8 "))?.mime).toBe("image/webp");
    expect(sniff(strToU8("<html>"))).toBeNull();
  });
  it("PDF com senha é detectado", () => {
    expect(pdfIsEncrypted(strToU8("%PDF-1.4\ntrailer << /Root 1 0 R /Encrypt 5 0 R >>"))).toBe(
      true,
    );
    expect(pdfIsEncrypted(strToU8("%PDF-1.4\ntrailer << /Root 1 0 R >>"))).toBe(false);
  });
  it("HTML de formulário estático vira texto com opções e ignora scripts", () => {
    const html = `<form><script>ignore()</script><label>Qual seu cargo?</label><select><option>Diretor</option><option>Analista</option></select><label>E-mail</label><input type="email" required></form>`;
    const r = htmlToText(html);
    expect(r.hasForm).toBe(true);
    expect(r.text).toContain("Qual seu cargo?");
    expect(r.text).toContain("( ) Diretor");
    expect(r.text).not.toContain("ignore()");
  });
  it("DOCX: extrai parágrafos e barra arquivo sem documento", () => {
    const doc = `<w:document><w:body><w:p><w:r><w:t>1. Você recomendaria?</w:t></w:r></w:p><w:p><w:r><w:t>Sim</w:t></w:r></w:p></w:body></w:document>`;
    const bytes = zipSync({
      "word/document.xml": strToU8(doc),
      "[Content_Types].xml": strToU8("<x/>"),
    });
    expect(docxToText(bytes)).toBe("1. Você recomendaria?\nSim");
    expect(() => docxToText(zipSync({ "x.txt": strToU8("a") }))).toThrow(/sem conteúdo/);
  });
  it("normalização: não inventa opções/obrigatoriedade e pontuação fica desligada", () => {
    const r = normalizeImported(
      {
        title: "Satisfação",
        fields: [
          { type: "single_choice", label: "Nota", options: [] },
          {
            type: "multi_choice",
            label: "Canais",
            options: [{ label: "WhatsApp", points: 2 }, "E-mail"],
            required: null,
            confidence: "baixa",
          },
          { type: "inexistente", label: "Comentário", required: true },
          { type: "short_text", label: "" },
        ],
      },
      "Importada",
    );
    expect(r.schema.scoringEnabled).toBe(false);
    expect(r.schema.fields.map((f) => f.type)).toEqual([
      "short_text",
      "multi_choice",
      "short_text",
    ]);
    expect(r.schema.fields[1]!.options!.map((o) => o.points)).toEqual([2, null]);
    expect(r.schema.fields[1]!.source?.confidence).toBe("baixa");
    expect(r.schema.fields.every((f) => !f.scored)).toBe(true);
    expect(r.schema.fields[2]!.required).toBe(true);
    expect(r.requiredUnknown).toBe(2);
  });
});
