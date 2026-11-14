// Lê o texto integral de um PDF no servidor (runtime edge) e devolve o corpo do contrato.
// `unpdf` é o pdf.js empacotado para Workers, sem binários nativos.
import { pdfPagesToBodyHtml, type PdfBodyError } from "@/lib/contracts/import-body";

const MAX_PAGES = 300;

export type PdfBodyResult =
  | { html: string; truncated: boolean; error: null }
  | { html: null; truncated: false; error: PdfBodyError };

export async function extractPdfBodyHtml(bytes: Uint8Array): Promise<PdfBodyResult> {
  try {
    const { getDocumentProxy, extractText } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    if (pdf.numPages > MAX_PAGES) return { html: null, truncated: false, error: "too_many_pages" };
    const { text } = await extractText(pdf, { mergePages: false });
    const pages = Array.isArray(text) ? text : [text];
    const body = pdfPagesToBodyHtml(pages);
    if (!body.html) return { html: null, truncated: false, error: "no_text" };
    return { html: body.html, truncated: body.truncated, error: null };
  } catch (e) {
    console.warn("[contracts] leitura do PDF falhou:", e instanceof Error ? e.name : "erro");
    return { html: null, truncated: false, error: "read_failed" };
  }
}
