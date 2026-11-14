import { describe, expect, it } from "vitest";
import { extractPdfBodyHtml } from "./pdf-body.server";
import { canReloadBodyFromSource } from "./import-body";

/** PDF mínimo sintético (Helvetica, uma linha por Tj). */
function makePdf(lines: string[]): Uint8Array {
  const content =
    "BT /F1 12 Tf 50 780 Td 14 TL " +
    lines.map((l) => `(${l.replace(/[()\\]/g, "")}) Tj T*`).join(" ") +
    " ET";
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(out);
}

describe("extractPdfBodyHtml", () => {
  it("transforma o texto do PDF em parágrafos do corpo", async () => {
    const r = await extractPdfBodyHtml(
      makePdf([
        "CONTRATO DE PRESTACAO DE SERVICOS",
        "CLAUSULA 1 - OBJETO",
        "1.1. O presente instrumento tem por objeto a prestacao de servicos de consultoria.",
      ]),
    );
    expect(r.error).toBeNull();
    expect(r.html).toContain("<p>CLAUSULA 1 - OBJETO</p>");
    expect(r.html).toContain("1.1. O presente instrumento");
  });

  it("PDF sem texto devolve erro no_text", async () => {
    const r = await extractPdfBodyHtml(makePdf([]));
    expect(r).toEqual({ html: null, truncated: false, error: "no_text" });
  });

  it("arquivo que não é PDF devolve erro read_failed", async () => {
    const r = await extractPdfBodyHtml(new TextEncoder().encode("não é um pdf"));
    expect(r.error).toBe("read_failed");
  });
});

describe("canReloadBodyFromSource", () => {
  const base = { status: "draft", body_html: "", source_file_path: "u/1-a.pdf" };
  it("permite rascunho sem corpo com arquivo original", () => {
    expect(canReloadBodyFromSource(base)).toBe(true);
  });
  it("bloqueia contrato fora de rascunho", () => {
    expect(canReloadBodyFromSource({ ...base, status: "active" })).toBe(false);
  });
  it("bloqueia quando já existe corpo", () => {
    expect(
      canReloadBodyFromSource({
        ...base,
        body_html: "<p>" + "texto do contrato ".repeat(5) + "</p>",
      }),
    ).toBe(false);
  });
  it("bloqueia sem arquivo original", () => {
    expect(canReloadBodyFromSource({ ...base, source_file_path: null })).toBe(false);
  });
});
