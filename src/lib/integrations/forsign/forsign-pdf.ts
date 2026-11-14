// Gera o PDF do contrato (A4) a partir do HTML formatado; pdf-lib roda no servidor edge.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { htmlToBlocks, toWinAnsi } from "./forsign-core";

export async function contractHtmlToPdf(html: string, title: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(toWinAnsi(title));
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28,
    H = 841.89,
    M = 56,
    maxW = W - 2 * M;
  let page = doc.addPage([W, H]);
  let y = H - M;
  const newPage = () => {
    page = doc.addPage([W, H]);
    y = H - M;
  };
  const write = (text: string, font: typeof regular, size: number, indent = 0, gap = 6) => {
    const lh = size * 1.4;
    for (const para of toWinAnsi(text).split("\n")) {
      const words = para.split(/\s+/).filter(Boolean);
      let line = "";
      const flush = () => {
        if (y - lh < M) newPage();
        page.drawText(line, { x: M + indent, y: y - size, size, font, color: rgb(0.1, 0.1, 0.1) });
        y -= lh;
        line = "";
      };
      for (const w of words) {
        const next = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(next, size) > maxW - indent && line) {
          flush();
          line = w;
        } else line = next;
      }
      if (line) flush();
    }
    y -= gap;
  };
  for (const b of htmlToBlocks(html)) {
    if (b.kind === "h1") write(b.text, bold, 15, 0, 10);
    else if (b.kind === "h2") write(b.text, bold, 12, 0, 6);
    else if (b.kind === "li") write(`•  ${b.text}`, regular, 10.5, 12, 3);
    else write(b.text, b.bold ? bold : regular, 10.5, 0, 6);
  }
  const pages = doc.getPages();
  pages.forEach((p, i) =>
    p.drawText(`${toWinAnsi(title)} - página ${i + 1} de ${pages.length}`, {
      x: M,
      y: 28,
      size: 8,
      font: regular,
      color: rgb(0.45, 0.45, 0.45),
    }),
  );
  return doc.save();
}
