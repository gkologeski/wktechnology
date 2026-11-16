const renderer = vi.hoisted(() => vi.fn());
vi.mock("@/lib/pdf/print-html.server", () => ({
  renderPdfViaBrowserless: renderer,
  wrapForPrint: (html: string) => html,
}));
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
