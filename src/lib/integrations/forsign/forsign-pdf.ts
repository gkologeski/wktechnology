// Gera o PDF do contrato (A4) a partir do HTML formatado; pdf-lib roda no servidor edge.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { htmlToBlocks, toWinAnsi, type SignerInput, type SignerPlacement } from "./forsign-core";

export type ForsignPdfSigner = SignerInput & {
  placement: SignerPlacement;
};

export type ForsignPdfTagging = {
  signers: readonly ForsignPdfSigner[];
};

type AnchorCoord = { pageIndex: number; x: number; y: number };

const W = 595.28;
const H = 841.89;
const M = 56;
const MAX_W = W - 2 * M;
const TAG_COLOR = rgb(1, 1, 1);
const TAG_FONT_SIZE = 6;

function computeTagX(
  lineText: string,
  column: "full" | "left" | "right",
  prefixBeforeUnderline: string | undefined,
  font: PDFFont,
  fontSize: number,
): number {
  if (column === "right") return M + MAX_W * 0.54;
  if (column === "left") return M + 16;
  if (prefixBeforeUnderline) {
    const prefixW = font.widthOfTextAtSize(toWinAnsi(prefixBeforeUnderline), fontSize);
    return Math.min(M + prefixW + 8, W - M - 80);
  }
  const lineW = font.widthOfTextAtSize(toWinAnsi(lineText), fontSize);
  return Math.min(M + Math.min(16, Math.max(0, lineW * 0.1)), W - M - 80);
}

function drawInvisibleTag(page: PDFPage, tag: string, x: number, y: number, font: PDFFont) {
  page.drawText(tag, { x, y, size: TAG_FONT_SIZE, font, color: TAG_COLOR });
}

function stampRubricsOnAllPages(
  doc: PDFDocument,
  font: PDFFont,
  signers: readonly ForsignPdfSigner[],
) {
  if (signers.length === 0) return;
  for (const p of doc.getPages()) {
    const box = p.getMediaBox();
    const marginX = 16;
    const usableW = Math.max(box.width - marginX * 2, 60);
    const slotW = Math.min(60, usableW / signers.length);
    const totalW = slotW * signers.length;
    const startX = Math.max(box.x + marginX, box.x + box.width - marginX - totalW);
    const y = box.y + 12;
    signers.forEach((s, idx) => {
      const tag = s.placement.rubricTag;
      let size = 5.5;
      const measured = font.widthOfTextAtSize(tag, size);
      if (measured > slotW - 4) size = Math.max(4, (size * (slotW - 4)) / measured);
      p.drawText(tag, {
        x: startX + idx * slotW,
        y,
        size,
        font,
        color: TAG_COLOR,
      });
    });
  }
}

function appendSignaturePage(
  doc: PDFDocument,
  regular: PDFFont,
  bold: PDFFont,
  title: string,
  fallbackSigners: readonly ForsignPdfSigner[],
) {
  if (fallbackSigners.length === 0) return;
  let page = doc.addPage([W, H]);
  let y = H - M;
  const writeHeader = () => {
    page.drawText("Página de Assinaturas", {
      x: M,
      y: y - 14,
      size: 14,
      font: bold,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= 24;
    page.drawText(toWinAnsi(title).slice(0, 95), {
      x: M,
      y: y - 10,
      size: 10,
      font: regular,
      color: rgb(0.35, 0.35, 0.35),
    });
    y -= 20;
    page.drawText(
      toWinAnsi(
        "Assinaturas eletrônicas dos signatários vinculados integralmente a este instrumento.",
      ),
      { x: M, y: y - 9.5, size: 9.5, font: regular, color: rgb(0.3, 0.3, 0.3) },
    );
    y -= 32;
  };
  writeHeader();
  const blockHeight = 96;
  for (const s of fallbackSigners) {
    if (y - blockHeight < M + 20) {
      page = doc.addPage([W, H]);
      y = H - M;
      writeHeader();
    }
    // Reserva espaço limpo acima da linha para a assinatura visual do ForSign.
    y -= 26;
    drawInvisibleTag(page, s.placement.signatureTag, M + 16, y + 10, regular);
    page.drawText("____________________________________________________", {
      x: M,
      y,
      size: 10.5,
      font: regular,
      color: rgb(0.15, 0.15, 0.15),
    });
    y -= 15;
    page.drawText(toWinAnsi(`${s.name} — ${s.role}`), {
      x: M,
      y,
      size: 10.5,
      font: bold,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= 13;
    const cpfDigits = (s.cpf ?? "").replace(/\D/g, "");
    const details = cpfDigits.length === 11 ? `${s.email} · CPF ${s.cpf}` : s.email;
    page.drawText(toWinAnsi(details), {
      x: M,
      y,
      size: 9,
      font: regular,
      color: rgb(0.35, 0.35, 0.35),
    });
    y -= 28;
  }
}

async function renderContractDoc(
  html: string,
  title: string,
  tagging?: ForsignPdfTagging,
  opts?: { reserveUnderlineSpace?: boolean },
) {
  const doc = await PDFDocument.create();
  doc.setTitle(toWinAnsi(title));
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const bySlotKey = new Map<string, ForsignPdfSigner[]>();
  if (tagging) {
    for (const s of tagging.signers) {
      if (s.placement.source === "identified" && s.placement.slot) {
        const key = `${s.placement.slot.blockIndex}:${s.placement.slot.lineIndex}`;
        const list = bySlotKey.get(key) ?? [];
        list.push(s);
        bySlotKey.set(key, list);
      }
    }
  }

  const anchors = new Map<string, AnchorCoord>();
  let pageIndex = 0;
  let page = doc.addPage([W, H]);
  let y = H - M;
  const newPage = () => {
    page = doc.addPage([W, H]);
    pageIndex++;
    y = H - M;
  };

  const reserveSpace = opts?.reserveUnderlineSpace ?? Boolean(tagging);
  const write = (
    blockIndex: number,
    text: string,
    font: PDFFont,
    size: number,
    indent = 0,
    gap = 6,
  ) => {
    const lh = size * 1.4;
    const paragraphs = toWinAnsi(text).split("\n");
    for (let lineIdx = 0; lineIdx < paragraphs.length; lineIdx++) {
      const para = paragraphs[lineIdx] ?? "";
      const matchedSigners = bySlotKey.get(`${blockIndex}:${lineIdx}`);
      if (reserveSpace && matchedSigners?.some((s) => s.placement.slot?.kind === "underline")) {
        if (y - lh - 22 < M) newPage();
        else y -= 18;
      }
      const words = para.split(/\s+/).filter(Boolean);
      let line = "";
      let isFirstWrappedLine = true;
      const flush = () => {
        if (y - lh < M) newPage();
        const drawY = y - size;
        if (isFirstWrappedLine && matchedSigners && matchedSigners.length > 0) {
          for (const s of matchedSigners) {
            const slot = s.placement.slot;
            if (!slot) continue;
            const tagX = computeTagX(para, slot.column, slot.prefixBeforeUnderline, font, size);
            const tagY = slot.kind === "underline" ? drawY + 12 : drawY + 2;
            anchors.set(s.placement.signatureTag, { pageIndex, x: tagX, y: tagY });
            drawInvisibleTag(page, s.placement.signatureTag, tagX, tagY, regular);
          }
        }
        isFirstWrappedLine = false;
        page.drawText(line, { x: M + indent, y: drawY, size, font, color: rgb(0.1, 0.1, 0.1) });
        y -= lh;
        line = "";
      };
      for (const w of words) {
        const next = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(next, size) > MAX_W - indent && line) {
          flush();
          line = w;
        } else line = next;
      }
      if (line) flush();
    }
    y -= gap;
  };

  const blocks = htmlToBlocks(html);
  for (let bIdx = 0; bIdx < blocks.length; bIdx++) {
    const b = blocks[bIdx];
    if (!b) continue;
    if (b.kind === "h1") write(bIdx, b.text, bold, 15, 0, 10);
    else if (b.kind === "h2") write(bIdx, b.text, bold, 12, 0, 6);
    else if (b.kind === "li") write(bIdx, `•  ${b.text}`, regular, 10.5, 12, 3);
    else write(bIdx, b.text, b.bold ? bold : regular, 10.5, 0, 6);
  }

  return { doc, regular, bold, anchors };
}

export async function contractHtmlToPdf(
  html: string,
  title: string,
  tagging?: ForsignPdfTagging,
): Promise<Uint8Array> {
  const { doc, regular, bold, anchors } = await renderContractDoc(html, title, tagging);
  if (tagging) {
    const fallbackSigners = tagging.signers.filter(
      (s) => s.placement.source === "signature_page" || !anchors.has(s.placement.signatureTag),
    );
    appendSignaturePage(doc, regular, bold, title, fallbackSigners);
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
  if (tagging) stampRubricsOnAllPages(doc, regular, tagging.signers);
  return doc.save();
}

/**
 * Carimba tags de assinatura e rubrica sobre uma cópia do pacote congelado (contrato + anexos)
 * sem reconstruir os anexos e sem alterar o arquivo imutável salvo no storage.
 */
export async function applyForsignTagsToPackagePdf(
  packageBytes: Uint8Array,
  baseHtml: string,
  title: string,
  tagging: ForsignPdfTagging,
): Promise<Uint8Array> {
  const { anchors } = await renderContractDoc(baseHtml, "Contrato e anexos", tagging, {
    reserveUnderlineSpace: false,
  });
  const doc = await PDFDocument.load(packageBytes);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();
  const fallbackSigners: ForsignPdfSigner[] = [];

  for (const s of tagging.signers) {
    const coord =
      s.placement.source === "identified" ? anchors.get(s.placement.signatureTag) : undefined;
    const targetPage = coord ? pages[coord.pageIndex] : undefined;
    if (coord && targetPage) {
      drawInvisibleTag(targetPage, s.placement.signatureTag, coord.x, coord.y, regular);
    } else {
      fallbackSigners.push(s);
    }
  }

  if (fallbackSigners.length > 0) {
    appendSignaturePage(doc, regular, bold, title, fallbackSigners);
  }
  stampRubricsOnAllPages(doc, regular, tagging.signers);
  return doc.save();
}
