// Utilitários de PDF compartilhados (cotação e proposta): achatamento de cores
// modernas, documento A4 para impressão e renderização via Browserless.

// --- Conversão oklch/oklab/color-mix → rgb ---------------------------------
// PDFium (Chrome) renderiza como transparente cores em espaços modernos que o
// Chromium escreve como DeviceN no PDF. Achatar para rgb() antes de imprimir.

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function oklabToRgb(L: number, a: number, b: number): [number, number, number] {
  // https://bottosson.github.io/posts/oklab/
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  let r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const toSRGB = (v: number) => {
    v = clamp01(v);
    return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  };
  r = Math.round(toSRGB(r) * 255);
  g = Math.round(toSRGB(g) * 255);
  bl = Math.round(toSRGB(bl) * 255);
  return [r, g, bl];
}

function parseNumberMaybePct(tok: string, base = 1): number {
  const t = tok.trim();
  if (t.endsWith("%")) return (parseFloat(t) / 100) * base;
  return parseFloat(t);
}

function replaceOklch(html: string): string {
  // oklch( L[%] C H [/ A] ) e oklab( L[%] a b [/ A] )
  const oklchRe = /oklch\(\s*([^)]+)\s*\)/gi;
  const oklabRe = /oklab\(\s*([^)]+)\s*\)/gi;
  html = html.replace(oklchRe, (_m, inner: string) => {
    try {
      const [main, alpha] = inner.split("/").map((s) => s.trim());
      const parts = main.split(/\s+/);
      if (parts.length < 3) return "rgb(0,0,0)";
      const L = parseNumberMaybePct(parts[0]);
      const C = parseFloat(parts[1]);
      const H = (parseFloat(parts[2]) * Math.PI) / 180;
      const a = Math.cos(H) * C;
      const b = Math.sin(H) * C;
      const [r, g, bl] = oklabToRgb(L, a, b);
      const A = alpha ? parseNumberMaybePct(alpha) : 1;
      return A < 1 ? `rgba(${r},${g},${bl},${A})` : `rgb(${r},${g},${bl})`;
    } catch {
      return "rgb(0,0,0)";
    }
  });
  html = html.replace(oklabRe, (_m, inner: string) => {
    try {
      const [main, alpha] = inner.split("/").map((s) => s.trim());
      const parts = main.split(/\s+/);
      if (parts.length < 3) return "rgb(0,0,0)";
      const L = parseNumberMaybePct(parts[0]);
      const a = parseFloat(parts[1]);
      const b = parseFloat(parts[2]);
      const [r, g, bl] = oklabToRgb(L, a, b);
      const A = alpha ? parseNumberMaybePct(alpha) : 1;
      return A < 1 ? `rgba(${r},${g},${bl},${A})` : `rgb(${r},${g},${bl})`;
    } catch {
      return "rgb(0,0,0)";
    }
  });
  // color-mix(...) — fallback simples: usa a primeira cor citada quando possível.
  html = html.replace(/color-mix\(\s*[^)]*\)/gi, (m) => {
    const inner = m.slice(m.indexOf("(") + 1, -1);
    const hexMatch = inner.match(/#[0-9a-fA-F]{3,8}/);
    if (hexMatch) return hexMatch[0];
    const rgbMatch = inner.match(/rgba?\([^)]+\)/i);
    if (rgbMatch) return rgbMatch[0];
    return "rgb(128,128,128)";
  });
  return html;
}

export function wrapForPrint(inner: string): string {
  // Envolve o HTML do template em um documento completo, injetando @page para
  // que o Chromium respeite A4 paisagem sem margens.
  //
  // Estratégia (Chrome/PDFium-safe):
  //  - NADA de `transform: scale()` no wrapper (gera Form XObject que PDFium
  //    clipa fora do MediaBox).
  //  - Usar `zoom` (via document.body.style.zoom) como fallback quando o
  //    conteúdo estourar 1 página. Zoom faz reflow antes da impressão e
  //    não gera Form XObject.
  //  - Achatar CSS que gera transparency groups/soft masks no PDF
  //    (mix-blend-mode, backdrop-filter, filter, mask) — esses recursos
  //    fazem o Chrome renderizar como página em branco.
  //  - Sem `overflow:hidden` no body para não clipar fora do MediaBox.
  inner = replaceOklch(inner);
  const hasHtmlTag = /<html[\s>]/i.test(inner);
  const pageStyle = `<style>@page { size: A4 landscape; margin: 0 } html, body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }</style>`;
  const overrideStyle = `<style id="__pdf_overrides__">
@page { size: A4 landscape; margin: 0; }
*, *::before, *::after {
  animation: none !important;
  transition: none !important;
  mix-blend-mode: normal !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  filter: none !important;
  mask: none !important;
  -webkit-mask: none !important;
  mask-image: none !important;
  -webkit-mask-image: none !important;
}
html, body { margin: 0 !important; padding: 0 !important; background: #fff; }
.stage { min-height: 0 !important; padding: 24px 16px !important; }
table { page-break-inside: auto; }
tr, td, th { page-break-inside: avoid; }
</style>`;
  const fitScript = `<script id="__pdf_single_page_fit__">
(function () {
  var PAGE_WIDTH = 1122;   // 297mm @ 96dpi
  var PAGE_HEIGHT = 794;   // 210mm @ 96dpi

  function measure() {
    var doc = document.documentElement;
    var body = document.body;
    return {
      w: Math.max(doc.scrollWidth, body.scrollWidth),
      h: Math.max(doc.scrollHeight, body.scrollHeight),
    };
  }

  function fit() {
    // Reset possíveis zooms anteriores
    document.body.style.zoom = "1";
    var size = measure();
    var ratio = Math.min(PAGE_WIDTH / size.w, PAGE_HEIGHT / size.h, 1);
    if (ratio < 1) {
      // 'zoom' faz reflow antes da impressão e não gera Form XObject no PDF.
      // Chromium suporta em contexto de impressão.
      document.body.style.zoom = String(ratio);
    }
    window.__pdfReady = true;
  }

  function schedule() {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(fit).catch(fit);
    } else {
      fit();
    }
  }

  if (document.readyState === "complete") {
    schedule();
  } else {
    window.addEventListener("load", schedule, { once: true });
  }
})();
</script>`;
  if (hasHtmlTag) {
    let out = inner.replace(/<head(\s[^>]*)?>/i, (m) => `${m}${pageStyle}`);
    if (/<\/head>/i.test(out)) {
      out = out.replace(/<\/head>/i, `${overrideStyle}</head>`);
    } else {
      out = out.replace(/<body(\s[^>]*)?>/i, (m) => `${overrideStyle}${m}`);
    }
    if (/<\/body>/i.test(out)) {
      out = out.replace(/<\/body>/i, `${fitScript}</body>`);
    } else {
      out = `${out}${fitScript}`;
    }
    return out;
  }
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">${pageStyle}${overrideStyle}</head><body>${inner}${fitScript}</body></html>`;
}

export async function renderPdfViaBrowserless(html: string, token: string): Promise<ArrayBuffer> {
  const url = `https://production-sfo.browserless.io/pdf?token=${encodeURIComponent(token)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      html,
      options: {
        format: "A4",
        landscape: true,
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
      },
      viewport: { width: 1400, height: 900, deviceScaleFactor: 2 },
      emulateMediaType: "screen",
      gotoOptions: { waitUntil: "networkidle0", timeout: 30000 },
      // Aguarda o script de fit setar a flag; se demorar, o timeout do
      // Browserless (30s) protege contra travas.
      waitForFunction: {
        fn: "() => window.__pdfReady === true",
        timeout: 5000,
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Browserless ${res.status}: ${body.slice(0, 300)}`);
  }
  return await res.arrayBuffer();
}
