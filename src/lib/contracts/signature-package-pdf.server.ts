import { PDFDocument } from "pdf-lib";
import { createHash } from "node:crypto";
import { contractHtmlToPdf } from "@/lib/integrations/forsign/forsign-pdf";
import { renderPdfViaBrowserless, wrapForPrint } from "@/lib/pdf/print-html.server";

export type PackagePart = {
  id: string;
  name: string;
  kind: string;
  source_id: string | null;
  stamp: string;
  bytes: Uint8Array;
  mime: string;
};
export const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export async function attachmentAsPdf(
  part: PackagePart,
  browserlessToken?: string,
): Promise<Uint8Array> {
  if (part.bytes.length === 0 || part.bytes.length > 20 * 1024 * 1024)
    throw new Error(`Arquivo inválido: ${part.name}`);
  if (part.mime === "application/pdf") {
    const pdf = await PDFDocument.load(part.bytes);
    if (pdf.isEncrypted || pdf.getPageCount() === 0 || pdf.getPageCount() > 1000)
      throw new Error(`PDF protegido ou inválido: ${part.name}`);
    return part.bytes;
  }
  if (part.mime === "image/png" || part.mime === "image/jpeg") {
    const pdf = await PDFDocument.create();
    const image =
      part.mime === "image/png" ? await pdf.embedPng(part.bytes) : await pdf.embedJpg(part.bytes);
    const page = pdf.addPage([595.28, 841.89]);
    const size = image.scaleToFit(499, 746);
    page.drawImage(image, { x: (595.28 - size.width) / 2, y: (841.89 - size.height) / 2, ...size });
    return pdf.save();
  }
  if (part.mime === "text/plain") {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(part.bytes);
    const html = `<h1>${esc(part.name)}</h1><p>${esc(text).replace(/\n/g, "<br>")}</p>`;
    if (browserlessToken)
      return new Uint8Array(await renderPdfViaBrowserless(wrapForPrint(html), browserlessToken));
    if ([...text].some((c) => c.codePointAt(0)! > 0x024f))
      throw new Error("Configure a conversão Unicode ou envie o documento em PDF.");
    return contractHtmlToPdf(html, part.name);
  }
  if (!browserlessToken)
    throw new Error("O serviço de conversão para PDF precisa estar configurado para DOCX/XLSX.");
  let html = "";
  if (part.mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const mammoth = await import("mammoth");
    const result = await mammoth.convertToHtml({ buffer: Buffer.from(part.bytes) });
    html = result.value;
  } else if (part.mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    const xlsx = await import("xlsx");
    const book = xlsx.read(part.bytes, {
      type: "array",
      cellHTML: false,
      cellFormula: false,
      bookFiles: true,
    });
    const entries = (book as typeof book & { keys?: string[] }).keys ?? [];
    if (entries.some((name) => /^xl\/(?:charts|drawings|media|embeddings)\//.test(name)))
      throw new Error(
        "A planilha contém gráficos, imagens ou objetos. Envie a versão em PDF para preservá-los.",
      );
    if (book.SheetNames.length > 30)
      throw new Error("A planilha excede 30 abas. Envie a versão em PDF.");
    html = book.SheetNames.map(
      (name) => `<h2>${esc(name)}</h2>${xlsx.utils.sheet_to_html(book.Sheets[name])}`,
    ).join("");
  } else throw new Error(`Formato não suportado para assinatura: ${part.name}`);
  if (html.length > 2_000_000)
    throw new Error(`Documento muito extenso. Envie a versão em PDF: ${part.name}`);
  // Conversion never executes document scripts or loads external document resources.
  const { sanitizeTemplateHtml } = await import("@/lib/contracts/template-html-format");
  const images: string[] = [];
  html = html.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = /src=["'](data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+)["']/i.exec(tag)?.[1];
    if (!src)
      throw new Error(
        "O documento contém uma imagem externa ou não suportada. Envie a versão em PDF.",
      );
    const index = images.push(src) - 1;
    return `TEERP_SAFE_IMAGE_${index}_END`;
  });
  const safe = sanitizeTemplateHtml(html).replace(/TEERP_SAFE_IMAGE_(\d+)_END/g, (_m, index) =>
    images[Number(index)]
      ? `<img style="max-width:100%;height:auto" src="${images[Number(index)]}">`
      : "",
  );
  return new Uint8Array(await renderPdfViaBrowserless(wrapForPrint(safe), browserlessToken));
}

export async function assembleSignaturePackage(
  body: string,
  parts: PackagePart[],
  browserlessToken?: string,
) {
  if (parts.length < 1 || parts.length > 30) throw new Error("Selecione entre 1 e 30 anexos.");
  const result = await PDFDocument.load(await contractHtmlToPdf(body, "Contrato e anexos"));
  const manifest: Array<{
    id: string;
    name: string;
    kind: string;
    source_id: string | null;
    stamp: string;
    sha256: string;
    original_sha256: string;
    first_page: number;
    pages: number;
  }> = [];
  let total = 0;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    total += part.bytes.length;
    if (total > 50 * 1024 * 1024) throw new Error("Os anexos excedem 50 MB no total.");
    if (part.kind === "file" && sha256(part.bytes) !== part.stamp)
      throw new Error(
        `O arquivo ${part.name} não corresponde à versão registrada. Envie-o novamente.`,
      );
    const converted = await attachmentAsPdf(part, browserlessToken),
      doc = await PDFDocument.load(converted);
    const title = await PDFDocument.load(
      await contractHtmlToPdf(
        `<h1>Anexo ${i + 1}</h1><p>${esc(part.name)}</p><p>SHA-256: ${sha256(converted)}</p>`,
        "Anexo",
      ),
    );
    for (const page of await result.copyPages(title, title.getPageIndices())) result.addPage(page);
    const first_page = result.getPageCount() + 1;
    for (const page of await result.copyPages(doc, doc.getPageIndices())) result.addPage(page);
    manifest.push({
      id: part.id,
      name: part.name,
      kind: part.kind,
      source_id: part.source_id,
      stamp: part.stamp,
      sha256: sha256(converted),
      original_sha256: sha256(part.bytes),
      first_page,
      pages: doc.getPageCount(),
    });
    if (result.getPageCount() > 2000) throw new Error("O pacote excede 2.000 páginas.");
  }
  const bytes = await result.save();
  if (bytes.length > 50 * 1024 * 1024) throw new Error("O pacote PDF excede 50 MB.");
  return { bytes, sha256: sha256(bytes), manifest, pageCount: result.getPageCount() };
}
