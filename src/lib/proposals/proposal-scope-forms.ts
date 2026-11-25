import {
  pageSizeMm,
  parseVisualDesign,
  uid,
  type VisualDesign,
  type VisualElement,
  type VisualPage,
} from "./visual-design";
import type { GeneratedScopeSection } from "./proposal-scope-catalog";
export * from "./proposal-scope-catalog";

/** Remove tags e atributos perigosos mantendo apenas HTML semântico seguro para o editor. */
export function sanitizeScopeHtml(raw: string): string {
  let html = raw
    .replace(/^\s*```(?:html)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  html = html
    .replace(/<(script|style|iframe|object|embed|form|input|button)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|style|iframe|object|embed|form|input|button)\b[^>]*\/?>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript\s*:/gi, "");
  return html.trim();
}

const SCOPE_HEADING = "Escopo Técnico Detalhado";
const SCOPE_SECTION_RE =
  /<h2[^>]*>\s*Escopo\s+T[eé]cnico\s+Detalhado\s*<\/h2>[\s\S]*?(?=<h3[^>]*>\s*Condições comerciais\s*<\/h3>|$)/i;
const TERMS_BLOCK_RE = /<h3[^>]*>\s*Condições comerciais\s*<\/h3>\s*<ul[^>]*>[\s\S]*?<\/ul>/i;

export function wrapScopeHtml(generatedHtml: string): string {
  const clean = sanitizeScopeHtml(generatedHtml);
  if (!clean) return "";
  if (/^<h2[^>]*>\s*Escopo\s+T[eé]cnico\s+Detalhado\s*<\/h2>/i.test(clean)) return clean;
  return `<h2>${SCOPE_HEADING}</h2>\n${clean}`;
}

/**
 * Mescla o escopo gerado pela IA no HTML da proposta sem destruir o bloco
 * "Condições comerciais" e sem duplicar blocos quando regenerado.
 */
export function mergeScopeIntoProposalHtml(
  currentBody: string,
  generatedHtml: string,
  mode: "insert" | "replace",
): string {
  const wrapped = wrapScopeHtml(generatedHtml);
  if (!wrapped) return currentBody;
  const existingTerms = currentBody.match(TERMS_BLOCK_RE)?.[0] ?? null;

  if (mode === "replace") {
    if (existingTerms && !TERMS_BLOCK_RE.test(wrapped)) {
      return `${wrapped}\n${existingTerms}`;
    }
    return wrapped;
  }

  if (!currentBody.trim()) return wrapped;
  if (SCOPE_SECTION_RE.test(currentBody)) {
    return currentBody.replace(SCOPE_SECTION_RE, `${wrapped}\n`);
  }
  if (TERMS_BLOCK_RE.test(currentBody)) {
    return currentBody.replace(TERMS_BLOCK_RE, (match) => `${wrapped}\n${match}`);
  }
  return `${currentBody.trim()}\n${wrapped}`;
}

/** Converte HTML simples de escopo em seções planas caso o modelo não devolva o array sections. */
export function extractSectionsFromScopeHtml(html: string): GeneratedScopeSection[] {
  const clean = sanitizeScopeHtml(html);
  if (!clean) return [];
  const parts = clean.split(/(?=<h[23][^>]*>)/i).filter((p) => p.trim().length > 0);
  const out: GeneratedScopeSection[] = [];
  for (const part of parts) {
    const headingMatch = part.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/i);
    const title = headingMatch ? headingMatch[1]!.replace(/<[^>]+>/g, "").trim() : SCOPE_HEADING;
    const bodyPart = headingMatch ? part.slice(headingMatch[0].length) : part;
    const text = bodyPart
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<\/(p|li|h[1-6]|tr|div)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (title || text) out.push({ title: title || SCOPE_HEADING, content: text });
  }
  return out;
}

/**
 * Adiciona (ou substitui) páginas formatadas de Escopo Técnico no VisualDesign
 * respeitando o Kit da Marca (cores/fontes) e orientação A4 do modelo.
 */
export function appendScopePagesToVisualDesign(
  design: VisualDesign,
  sections: readonly GeneratedScopeSection[],
): VisualDesign {
  const validSections = sections.filter((s) => s.title.trim() || s.content.trim());
  if (validSections.length === 0) return design;

  const basePages = design.pages.filter((p) => !p.id.startsWith("scope-ai-"));
  const { width, height } = pageSizeMm(design.orientation);
  const marginX = 16;
  const topY = design.master.enabled ? Math.max(design.master.headerHeightMm + 8, 28) : 18;
  const bottomLimit = height - (design.master.enabled ? design.master.footerHeightMm + 12 : 18);
  const contentW = width - marginX * 2;
  const brand = design.brandKit;

  const generatedPages: VisualPage[] = [];
  let currentElements: VisualElement[] = [];
  let cursorY = topY;
  let pageIdx = 1;

  const flushPage = () => {
    if (currentElements.length === 0) return;
    generatedPages.push({
      id: `scope-ai-${pageIdx}-${uid("p")}`,
      name: pageIdx === 1 ? "Escopo Técnico" : `Escopo Técnico (${pageIdx})`,
      backgroundColor: "#FFFFFF",
      useMaster: true,
      elements: currentElements,
    });
    pageIdx += 1;
    currentElements = [];
    cursorY = topY;
  };

  // Cabeçalho da primeira página de escopo
  currentElements.push({
    id: uid("hd"),
    name: "Título Escopo Técnico",
    type: "heading",
    x: marginX,
    y: cursorY,
    w: contentW,
    h: 12,
    rotation: 0,
    z: 2,
    style: {
      fontFamily: brand.headingFont,
      fontSize: 20,
      fontWeight: "700",
      textColor: brand.primaryColor,
      lineHeight: 1.2,
    },
    props: { text: SCOPE_HEADING },
  });
  cursorY += 15;

  for (const sec of validSections) {
    const lines = Math.max(
      2,
      sec.content.split("\n").reduce((acc, l) => acc + Math.max(1, Math.ceil(l.length / 82)), 0),
    );
    const bodyH = Math.min(Math.max(lines * 4.8 + 4, 14), bottomLimit - topY - 18);
    const neededH = 10 + bodyH + 6;

    if (cursorY + neededH > bottomLimit && currentElements.length > 0) {
      flushPage();
    }

    currentElements.push({
      id: uid("sh"),
      name: sec.title.slice(0, 100) || "Seção",
      type: "heading",
      x: marginX,
      y: cursorY,
      w: contentW,
      h: 8,
      rotation: 0,
      z: 2,
      style: {
        fontFamily: brand.headingFont,
        fontSize: 13,
        fontWeight: "700",
        textColor: brand.secondaryColor,
        lineHeight: 1.25,
      },
      props: { text: sec.title.slice(0, 300) },
    });
    cursorY += 9;

    currentElements.push({
      id: uid("st"),
      name: `Texto — ${sec.title.slice(0, 80)}`,
      type: "text",
      x: marginX,
      y: cursorY,
      w: contentW,
      h: bodyH,
      rotation: 0,
      z: 2,
      style: {
        fontFamily: brand.bodyFont,
        fontSize: 10,
        fontWeight: "400",
        textColor: brand.textColor,
        lineHeight: 1.45,
      },
      props: { text: sec.content.slice(0, 19_000) },
    });
    cursorY += bodyH + 6;
  }
  flushPage();

  return parseVisualDesign({
    ...design,
    pages: [...basePages, ...generatedPages].slice(0, 40),
  });
}
