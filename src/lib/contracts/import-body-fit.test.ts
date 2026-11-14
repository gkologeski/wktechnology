import { describe, expect, it } from "vitest";
import { fitBodyHtml, IMPORT_BODY_MAX } from "./import-body";

describe("fitBodyHtml", () => {
  it("mantém corpo dentro do limite", () => {
    const html = "<p>" + "a".repeat(100) + "</p>";
    expect(fitBodyHtml(html)).toEqual({ html, truncated: false });
  });
  it("trunca corpo acima de 400 mil caracteres no fim de um parágrafo", () => {
    const html = ("<p>" + "x".repeat(995) + "</p>").repeat(500);
    const r = fitBodyHtml(html);
    expect(r.truncated).toBe(true);
    expect(r.html!.length).toBeLessThanOrEqual(IMPORT_BODY_MAX);
    expect(r.html!.endsWith("</em></p>")).toBe(true);
  });
  it("corpo vazio vira null", () => {
    expect(fitBodyHtml("<p></p>").html).toBeNull();
  });
});
