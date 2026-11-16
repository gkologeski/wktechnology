const renderer = vi.hoisted(() => vi.fn());
vi.mock("@/lib/pdf/print-html.server", () => ({
  renderPdfViaBrowserless: renderer,
  wrapForPrint: (html: string) => html,
}));
vi.mock("mammoth", async () => {
  const { createRequire } = await import("node:module");
  return { default: createRequire(import.meta.url)("mammoth/mammoth.browser.js") };
});
import { expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  assembleSignaturePackage,
  attachmentAsPdf,
  sha256,
  type PackagePart,
} from "./signature-package-pdf.server";
import { contractHtmlToPdf } from "@/lib/integrations/forsign/forsign-pdf";
async function sample(): Promise<PackagePart> {
  const bytes = await contractHtmlToPdf("<p>Escopo comercial aceito</p>", "Proposta");
  return {
    id: "a",
    kind: "file",
    source_id: null,
    name: "Proposta.pdf",
    stamp: sha256(bytes),
    bytes,
    mime: "application/pdf",
  };
}
it("signature package includes every annex and hashes exact original and converted bytes", async () => {
  const part = await sample();
  const result = await assembleSignaturePackage("<h1>Contrato</h1>", [
    part,
    { ...part, id: "b", name: "Outro.pdf" },
  ]);
  const pdf = await PDFDocument.load(result.bytes);
  expect(pdf.getPageCount()).toBe(5);
  expect(result.manifest).toHaveLength(2);
  expect(result.manifest.map((m) => m.first_page)).toEqual([3, 5]);
  expect(result.manifest[0].original_sha256).toBe(part.stamp);
  expect(result.sha256).toBe(sha256(result.bytes));
});
it("signature package never accepts altered original bytes", async () => {
  const part = await sample();
  await expect(
    assembleSignaturePackage("<p>Contrato</p>", [{ ...part, stamp: "0".repeat(64) }]),
  ).rejects.toThrow("versão registrada");
});
it("signature package rejects invalid PDFs instead of silently dropping the annex", async () => {
  const bytes = new TextEncoder().encode("not a PDF");
  const part = await sample();
  await expect(
    assembleSignaturePackage("C", [{ ...part, bytes, stamp: sha256(bytes) }]),
  ).rejects.toThrow();
});
it("signature package handles UTF-8 plain text as a PDF annex", async () => {
  const bytes = new TextEncoder().encode("Escopo técnico\nPrazo: a definir");
  const part = await sample();
  const result = await attachmentAsPdf({ ...part, bytes, mime: "text/plain", name: "Escopo.txt" });
  expect((await PDFDocument.load(result)).getPageCount()).toBeGreaterThan(0);
});
it("signature package fails closed when office conversion is unavailable", async () => {
  const part = await sample();
  await expect(
    attachmentAsPdf({
      ...part,
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
  ).rejects.toThrow("serviço de conversão");
});
it("signature package rejects empty and excessive attachment sets", async () => {
  await expect(assembleSignaturePackage("C", [])).rejects.toThrow("1 e 30");
  const part = await sample();
  await expect(assembleSignaturePackage("C", Array(31).fill(part))).rejects.toThrow("1 e 30");
});

it("signature package converts spreadsheet values without external network requests", async () => {
  const xlsx = await import("xlsx");
  const book = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(
    book,
    xlsx.utils.aoa_to_sheet([
      ["Atividade", "Horas"],
      ["Integração", 111],
    ]),
    "Escopo",
  );
  const bytes = new Uint8Array(xlsx.write(book, { type: "array", bookType: "xlsx" }));
  const expected = await contractHtmlToPdf("<p>Convertido</p>", "Planilha");
  renderer.mockResolvedValue(expected.buffer);
  const p = await sample();
  const pdf = await attachmentAsPdf(
    { ...p, bytes, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    "renderer-test",
  );
  expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThan(0);
  expect(renderer).toHaveBeenCalledWith(expect.stringContaining("Integração"), "renderer-test");
  expect(renderer.mock.calls.at(-1)?.[0]).toContain("111");
});

it("signature package converts DOCX with the default-only browser export selected by Cloudflare", async () => {
  const { createRequire } = await import("node:module");
  const { dirname } = await import("node:path");
  const require = createRequire(import.meta.url);
  const Zip = require(
    require.resolve("jszip", { paths: [dirname(require.resolve("mammoth/package.json"))] }),
  );
  const zip = new Zip();
  zip.file(
    "[Content_Types].xml",
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file(
    "_rels/.rels",
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  zip.file(
    "word/document.xml",
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Escopo técnico do serviço</w:t></w:r></w:p></w:body></w:document>',
  );
  const bytes = await zip.generateAsync({ type: "uint8array" });
  const expected = await contractHtmlToPdf("<p>Convertido</p>", "DOCX");
  renderer.mockResolvedValue(expected.buffer);
  const p = await sample();
  await attachmentAsPdf(
    {
      ...p,
      bytes,
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
    "renderer-test",
  );
  expect(renderer.mock.calls.at(-1)?.[0]).toContain("Escopo técnico do serviço");
});
