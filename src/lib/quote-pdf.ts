import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

// Tokens shadcn baseados em oklch() quebram o parser CSS do html2canvas.
// Durante a captura, injetamos overrides seguros com cores sRGB e escondemos
// elementos marcados como print:hidden / [data-pdf-hide].
const CAPTURE_STYLE_ID = "__quote_pdf_capture_style__";

function injectCaptureStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(CAPTURE_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = CAPTURE_STYLE_ID;
  style.textContent = `
    [data-quote-capturing] .print\\:hidden,
    [data-quote-capturing] [data-pdf-hide] { display: none !important; }
    [data-quote-capturing] {
      --background: #ffffff;
      --foreground: #111111;
      --card: #ffffff;
      --card-foreground: #111111;
      --popover: #ffffff;
      --popover-foreground: #111111;
      --muted: #f3f4f6;
      --muted-foreground: #6b7280;
      --border: #e5e7eb;
      --input: #e5e7eb;
      --ring: #d1d5db;
      --primary: #111111;
      --primary-foreground: #ffffff;
      --secondary: #f3f4f6;
      --secondary-foreground: #111111;
      --accent: #f3f4f6;
      --accent-foreground: #111111;
      --destructive: #dc2626;
      --destructive-foreground: #ffffff;
    }
  `;
  document.head.appendChild(style);
}

export async function downloadQuotePdf(el: HTMLElement, filename: string) {
  injectCaptureStyles();
  el.setAttribute("data-quote-capturing", "true");

  // Aguarda fontes e um frame para garantir layout estável antes de rasterizar.
  try {
    const fonts = typeof document !== "undefined" ? (document as Document).fonts : undefined;
    if (fonts && typeof fonts.ready?.then === "function") {
      await fonts.ready;
    }
  } catch {
    /* ignore */
  }
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: el.scrollWidth,
    });
  } finally {
    el.removeAttribute("data-quote-capturing");
  }

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidthMm = pdf.internal.pageSize.getWidth();
  const pageHeightMm = pdf.internal.pageSize.getHeight();

  const imgWidthMm = pageWidthMm;
  const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;

  const imgData = canvas.toDataURL("image/png");

  if (imgHeightMm <= pageHeightMm) {
    pdf.addImage(imgData, "PNG", 0, 0, imgWidthMm, imgHeightMm, undefined, "FAST");
  } else {
    // Pagina verticalmente: desloca a imagem para cima a cada página.
    let heightLeft = imgHeightMm;
    let position = 0;
    pdf.addImage(imgData, "PNG", 0, position, imgWidthMm, imgHeightMm, undefined, "FAST");
    heightLeft -= pageHeightMm;
    while (heightLeft > 0) {
      position -= pageHeightMm;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidthMm, imgHeightMm, undefined, "FAST");
      heightLeft -= pageHeightMm;
    }
  }

  pdf.save(filename);
}
