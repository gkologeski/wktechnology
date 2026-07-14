import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

// html2canvas não parseia funções de cor modernas: oklch(), oklab(), lch(),
// lab() e color-mix(). Tailwind v4 emite tokens em oklch(), então qualquer
// utilitário dentro do subtree quebra a captura. Antes de rasterizar,
// convertemos as cores para rgb()/rgba() usando o próprio motor CSS do
// navegador (que já resolve oklch → rgb em getComputedStyle) e restauramos
// os estilos inline originais depois.

const CAPTURE_STYLE_ID = "__quote_pdf_capture_style__";

function injectCaptureStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(CAPTURE_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = CAPTURE_STYLE_ID;
  style.textContent = `
    [data-quote-capturing] .print\\:hidden,
    [data-quote-capturing] [data-pdf-hide] { display: none !important; }
  `;
  document.head.appendChild(style);
}

const MODERN_COLOR_RE = /oklch|oklab|lch\(|lab\(|color-mix|color\(/i;

const COLOR_PROPS = [
  "color",
  "background-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline-color",
  "text-decoration-color",
  "fill",
  "stroke",
  "caret-color",
  "column-rule-color",
  "-webkit-text-fill-color",
] as const;

let probeEl: HTMLDivElement | null = null;
let probeCanvas: HTMLCanvasElement | null = null;

function getProbe(): HTMLDivElement {
  if (probeEl && probeEl.isConnected) return probeEl;
  const div = document.createElement("div");
  div.style.cssText =
    "position:absolute;left:-9999px;top:-9999px;width:0;height:0;pointer-events:none;";
  document.body.appendChild(div);
  probeEl = div;
  return div;
}

function toRgb(value: string): string | null {
  if (!value) return null;
  if (!MODERN_COLOR_RE.test(value)) return value;
  try {
    const probe = getProbe();
    probe.style.color = "";
    probe.style.color = value;
    const resolved = getComputedStyle(probe).color;
    if (resolved && !MODERN_COLOR_RE.test(resolved)) return resolved;
  } catch {
    /* ignore */
  }
  // Fallback: canvas fillStyle
  try {
    if (!probeCanvas) probeCanvas = document.createElement("canvas");
    probeCanvas.width = 1;
    probeCanvas.height = 1;
    const ctx = probeCanvas.getContext("2d");
    if (!ctx) return null;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
  } catch {
    return null;
  }
}

function sanitizeGradient(value: string): string | null {
  if (!value || value === "none") return null;
  if (!MODERN_COLOR_RE.test(value)) return null;
  // Substitui cada função de cor moderna dentro de gradients por rgb().
  // Regex simples com contagem de parênteses para casar oklch(...), color-mix(...), etc.
  let out = "";
  let i = 0;
  while (i < value.length) {
    const rest = value.slice(i);
    const m = rest.match(/^(oklch|oklab|lch|lab|color-mix|color)\(/i);
    if (m) {
      // Encontra o fechamento correspondente
      let depth = 1;
      let j = i + m[0].length;
      while (j < value.length && depth > 0) {
        const ch = value[j];
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
        j++;
      }
      const fnExpr = value.slice(i, j);
      const rgb = toRgb(fnExpr);
      out += rgb ?? "rgb(0,0,0)";
      i = j;
    } else {
      out += value[i];
      i++;
    }
  }
  return out;
}

type Restore = { el: HTMLElement; prop: string; prev: string; prevPriority: string };

function sanitizeModernColors(root: HTMLElement): () => void {
  const restores: Restore[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  const elements: HTMLElement[] = [root];
  let node = walker.nextNode();
  while (node) {
    if (node instanceof HTMLElement) elements.push(node);
    node = walker.nextNode();
  }

  for (const el of elements) {
    const cs = getComputedStyle(el);
    for (const prop of COLOR_PROPS) {
      const value = cs.getPropertyValue(prop);
      if (!value || !MODERN_COLOR_RE.test(value)) continue;
      const rgb = toRgb(value);
      if (!rgb) continue;
      restores.push({
        el,
        prop,
        prev: el.style.getPropertyValue(prop),
        prevPriority: el.style.getPropertyPriority(prop),
      });
      el.style.setProperty(prop, rgb, "important");
    }
    const bgImage = cs.getPropertyValue("background-image");
    if (bgImage && MODERN_COLOR_RE.test(bgImage)) {
      const patched = sanitizeGradient(bgImage);
      if (patched) {
        restores.push({
          el,
          prop: "background-image",
          prev: el.style.getPropertyValue("background-image"),
          prevPriority: el.style.getPropertyPriority("background-image"),
        });
        el.style.setProperty("background-image", patched, "important");
      }
    }
  }

  return () => {
    for (const r of restores) {
      if (r.prev) {
        r.el.style.setProperty(r.prop, r.prev, r.prevPriority);
      } else {
        r.el.style.removeProperty(r.prop);
      }
    }
  };
}

export async function downloadQuotePdf(el: HTMLElement, filename: string) {
  injectCaptureStyles();
  el.setAttribute("data-quote-capturing", "true");

  try {
    const fonts = typeof document !== "undefined" ? (document as Document).fonts : undefined;
    if (fonts && typeof fonts.ready?.then === "function") {
      await fonts.ready;
    }
  } catch {
    /* ignore */
  }
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

  const restore = sanitizeModernColors(el);

  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: el.scrollWidth,
      foreignObjectRendering: false,
      imageTimeout: 15000,
      onclone: (doc: Document) => {
        try {
          if (doc.body) sanitizeModernColors(doc.body);
        } catch {
          /* ignore */
        }
      },
    });
  } finally {
    restore();
    el.removeAttribute("data-quote-capturing");
  }

  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidthMm = pdf.internal.pageSize.getWidth();
  const pageHeightMm = pdf.internal.pageSize.getHeight();

  const imgWidthMm = pageWidthMm;
  const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;

  const imgData = canvas.toDataURL("image/png");

  if (imgHeightMm <= pageHeightMm) {
    pdf.addImage(imgData, "PNG", 0, 0, imgWidthMm, imgHeightMm, undefined, "FAST");
  } else {
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
