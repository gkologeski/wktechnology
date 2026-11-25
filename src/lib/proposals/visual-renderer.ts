import {
  VISUAL_ICON_PATHS,
  pageSizeMm,
  type VisualDesign,
  type VisualElement,
  type VisualIconName,
  type VisualPage,
} from "./visual-design";
import {
  renderLogoImgTag,
  resolveProviderLogoUrl,
  sanitizeHttpsLogoUrl,
} from "@/lib/sales/company-logo-token";

export type VisualRenderItem = {
  id?: string;
  name: string;
  billing: string;
};

export type VisualRenderContext = {
  proposalTitle?: string | null;
  companyName?: string | null;
  clientLogoUrl?: string | null;
  counterpartyName?: string | null;
  companyLegalName?: string | null;
  companyCnpj?: string | null;
  contactName?: string | null;
  signerFullName?: string | null;
  contactEmail?: string | null;
  dealName?: string | null;
  total?: string | null;
  validUntil?: string | null;
  validityDays?: string | number | null;
  date?: string | null;
  contractingName?: string | null;
  contractingCnpj?: string | null;
  contractingLogoUrl?: string | null;
  workspaceLogoUrl?: string | null;
  agentName?: string | null;
  paymentMethod?: string | null;
  installmentsCount?: string | number | null;
  installmentValue?: string | null;
  installmentsSummary?: string | null;
  paymentTermsSummary?: string | null;
  items?: VisualRenderItem[];
  /** Mapa de storagePath -> URL assinada temporária para imagens privadas. */
  signedUrls?: Record<string, string>;
};

function escHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeUrl(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (
    /^https?:\/\//i.test(trimmed) ||
    /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(trimmed)
  ) {
    return trimmed;
  }
  return "";
}

function shadowCss(shadow: VisualElement["style"]["shadow"]): string {
  switch (shadow) {
    case "sm":
      return "0 2px 8px rgba(15,23,42,0.08)";
    case "md":
      return "0 6px 18px rgba(15,23,42,0.12)";
    case "lg":
      return "0 12px 28px rgba(15,23,42,0.18)";
    default:
      return "none";
  }
}

export function buildTokenMap(
  ctx: VisualRenderContext,
  pageIndex: number,
  totalPages: number,
): Record<string, string> {
  const pageNum = pageIndex + 1;
  const padded = String(pageNum).padStart(2, "0");
  return {
    "company.name": ctx.companyName ?? "",
    "counterparty.name": ctx.counterpartyName || ctx.companyName || "",
    company_legal_name: ctx.companyLegalName || ctx.companyName || "",
    company_cnpj: ctx.companyCnpj ?? "",
    "contact.name": ctx.contactName ?? "",
    "signer.full_name": ctx.signerFullName || ctx.contactName || "",
    "contact.email": ctx.contactEmail ?? "",
    "deal.name": ctx.dealName || ctx.proposalTitle || "",
    "proposal.title": ctx.proposalTitle ?? "",
    total: ctx.total ?? "",
    valid_until: ctx.validUntil ?? "",
    validity_days: ctx.validityDays != null ? String(ctx.validityDays) : "",
    date: ctx.date ?? new Date().toLocaleDateString("pt-BR"),
    "contracting.name": ctx.contractingName ?? "",
    "contracting.cnpj": ctx.contractingCnpj ?? "",
    "agent.name": ctx.agentName ?? "",
    payment_method: ctx.paymentMethod ?? "",
    installments_count: ctx.installmentsCount != null ? String(ctx.installmentsCount) : "",
    installment_value: ctx.installmentValue ?? "",
    installments_summary: ctx.installmentsSummary ?? "",
    payment_terms_summary: ctx.paymentTermsSummary ?? "",
    "page.number": String(pageNum),
    "page.number_padded": padded,
    "page.total": String(totalPages),
  };
}

export function resolveTokens(text: string, tokens: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (match, key: string) => {
    return key in tokens ? (tokens[key] ?? "") : match;
  });
}

/** Sanitização fechada para texto inline: escapa tudo e converte **negrito** e quebras. */
function formatSafeText(raw: string): string {
  const escaped = escHtml(raw);
  const withBold = escaped.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  return withBold.replace(/\n/g, "<br/>");
}

function renderIconSvg(icon: VisualIconName, color: string, strokeWidth: number): string {
  const paths = VISUAL_ICON_PATHS[icon] ?? VISUAL_ICON_PATHS.sparkles;
  const pathTags = paths.map((d) => `<path d="${escHtml(d)}" />`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="${escHtml(color)}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${pathTags}</svg>`;
}

function resolveImageSrc(
  el: Extract<VisualElement, { type: "image" }>,
  design: VisualDesign,
  ctx: VisualRenderContext,
): string {
  if (el.props.bindLogo === "client") {
    return sanitizeHttpsLogoUrl(ctx.clientLogoUrl) ?? "";
  }
  if (el.props.bindLogo === "contracting") {
    if (ctx.contractingLogoUrl) return safeUrl(ctx.contractingLogoUrl);
    if (design.brandKit.logoStoragePath && ctx.signedUrls?.[design.brandKit.logoStoragePath]) {
      return safeUrl(ctx.signedUrls[design.brandKit.logoStoragePath]);
    }
    if (design.brandKit.logoUrl) return safeUrl(design.brandKit.logoUrl);
    if (ctx.workspaceLogoUrl) return safeUrl(ctx.workspaceLogoUrl);
  }
  if (el.props.bindLogo === "workspace") {
    if (ctx.workspaceLogoUrl) return safeUrl(ctx.workspaceLogoUrl);
    if (design.brandKit.logoUrl) return safeUrl(design.brandKit.logoUrl);
  }
  if (el.props.storagePath && ctx.signedUrls?.[el.props.storagePath]) {
    return safeUrl(ctx.signedUrls[el.props.storagePath]);
  }
  return safeUrl(el.props.src);
}

function resolveProviderLogoForVisual(
  design: VisualDesign,
  ctx: VisualRenderContext,
): string | null {
  const signedBrand =
    design.brandKit.logoStoragePath && ctx.signedUrls?.[design.brandKit.logoStoragePath]
      ? ctx.signedUrls[design.brandKit.logoStoragePath]
      : null;
  return resolveProviderLogoUrl(
    ctx.contractingLogoUrl || signedBrand || design.brandKit.logoUrl,
    ctx.workspaceLogoUrl,
  );
}

function formatTextWithInlineLogos(
  raw: string,
  design: VisualDesign,
  ctx: VisualRenderContext,
): string {
  let formatted = formatSafeText(raw);
  if (formatted.includes("company.logo")) {
    const alt = ctx.companyName?.trim()
      ? `Logo de ${ctx.companyName.trim()}`
      : "Logo da empresa cliente";
    formatted = formatted.replace(
      /\{\{\s*company\.logo\s*\}\}/g,
      renderLogoImgTag(ctx.clientLogoUrl, alt),
    );
  }
  if (formatted.includes("provider.logo")) {
    const providerName = ctx.contractingName || design.brandKit.legalEntityName || "";
    const alt = providerName.trim()
      ? `Logo de ${providerName.trim()}`
      : "Logo da empresa prestadora";
    const providerUrl = resolveProviderLogoForVisual(design, ctx);
    formatted = formatted.replace(
      /\{\{\s*provider\.logo\s*\}\}/g,
      renderLogoImgTag(providerUrl, alt),
    );
  }
  return formatted;
}

function boxStyle(el: VisualElement, yOverride?: number): string {
  const s = el.style;
  const y = yOverride ?? el.y;
  const parts = [
    "position:absolute",
    `left:${el.x}mm`,
    `top:${y}mm`,
    `width:${el.w}mm`,
    `height:${el.h}mm`,
    `z-index:${el.z}`,
    "box-sizing:border-box",
  ];
  if (el.rotation)
    parts.push(`transform:rotate(${el.rotation}deg)`, "transform-origin:center center");
  if (s.opacity != null && s.opacity < 1) parts.push(`opacity:${s.opacity}`);
  if (s.bgColor) parts.push(`background:${s.bgColor}`);
  if (s.borderWidth && s.borderWidth > 0) {
    parts.push(`border:${s.borderWidth}px solid ${s.borderColor ?? "#CBD5E1"}`);
  }
  if (s.borderRadius != null && s.borderRadius > 0) {
    parts.push(`border-radius:${s.borderRadius}mm`);
  }
  if (s.shadow && s.shadow !== "none") parts.push(`box-shadow:${shadowCss(s.shadow)}`);
  if (s.paddingMm != null && s.paddingMm > 0) parts.push(`padding:${s.paddingMm}mm`);
  return parts.join(";");
}

function renderElementHtml(
  el: VisualElement,
  design: VisualDesign,
  ctx: VisualRenderContext,
  tokens: Record<string, string>,
): string {
  if (el.hidden) return "";
  const s = el.style;
  const font =
    s.fontFamily ??
    (el.type === "heading" ? design.brandKit.headingFont : design.brandKit.bodyFont);

  switch (el.type) {
    case "heading":
    case "text": {
      const resolved = resolveTokens(el.props.text, tokens);
      const typo = [
        `font-family:'${escHtml(font)}',system-ui,-apple-system,sans-serif`,
        `font-size:${s.fontSize ?? (el.type === "heading" ? 22 : 11)}pt`,
        `font-weight:${s.fontWeight ?? (el.type === "heading" ? "800" : "400")}`,
        `color:${s.textColor ?? design.brandKit.textColor}`,
        `text-align:${s.textAlign ?? "left"}`,
        `line-height:${s.lineHeight ?? (el.type === "heading" ? 1.18 : 1.5)}`,
        s.letterSpacing ? `letter-spacing:${s.letterSpacing}px` : "",
        s.uppercase ? "text-transform:uppercase" : "",
        "overflow:hidden",
        "word-break:break-word",
      ]
        .filter(Boolean)
        .join(";");
      return `<div class="vp-el" data-el-id="${escHtml(el.id)}" style="${boxStyle(el)};${typo}">${formatTextWithInlineLogos(resolved, design, ctx)}</div>`;
    }

    case "rect": {
      const stripe =
        el.props.accentStripe === "left"
          ? `border-left:3px solid ${el.props.accentColor ?? design.brandKit.primaryColor}`
          : el.props.accentStripe === "top"
            ? `border-top:3px solid ${el.props.accentColor ?? design.brandKit.primaryColor}`
            : "";
      return `<div class="vp-el" data-el-id="${escHtml(el.id)}" style="${boxStyle(el)};${stripe}"></div>`;
    }

    case "circle": {
      return `<div class="vp-el" data-el-id="${escHtml(el.id)}" style="${boxStyle(el)};border-radius:9999px"></div>`;
    }

    case "line":
    case "divider": {
      const color = s.bgColor ?? design.brandKit.primaryColor;
      const stroke = el.props.strokeStyle ?? "solid";
      const borderRule =
        stroke === "solid"
          ? `background:${color}`
          : `background:transparent;border-top:${Math.max(1, el.h * 3.78).toFixed(1)}px ${stroke} ${color}`;
      return `<div class="vp-el" data-el-id="${escHtml(el.id)}" style="${boxStyle(el)};${borderRule}"></div>`;
    }

    case "icon": {
      const color = s.textColor ?? design.brandKit.primaryColor;
      return `<div class="vp-el" data-el-id="${escHtml(el.id)}" style="${boxStyle(el)};display:flex;align-items:center;justify-content:center">${renderIconSvg(el.props.icon, color, el.props.strokeWidth)}</div>`;
    }

    case "image": {
      const src = resolveImageSrc(el, design, ctx);
      if (!src) {
        if (el.props.bindLogo === "client") {
          return `<div class="vp-el" data-el-id="${escHtml(el.id)}" style="${boxStyle(el)}" aria-hidden="true"></div>`;
        }
        const fallbackLabel =
          el.props.bindLogo !== "none"
            ? escHtml(ctx.contractingName || design.brandKit.legalEntityName || "LOGO")
            : "";
        if (!fallbackLabel) return "";
        return `<div class="vp-el" data-el-id="${escHtml(el.id)}" style="${boxStyle(el)};display:flex;align-items:center;font-family:'${escHtml(design.brandKit.headingFont)}',system-ui,sans-serif;font-weight:800;font-size:13pt;color:${escHtml(design.brandKit.primaryColor)};letter-spacing:-0.3px">${fallbackLabel}</div>`;
      }
      const radius = s.borderRadius ? `border-radius:${s.borderRadius}mm;` : "";
      return `<div class="vp-el" data-el-id="${escHtml(el.id)}" style="${boxStyle(el)};overflow:hidden"><img src="${escHtml(src)}" alt="${escHtml(el.props.alt)}" style="width:100%;height:100%;object-fit:${el.props.fit};object-position:left center;display:block;${radius}" /></div>`;
    }

    case "table": {
      const isBound = el.binding === "items" && ctx.items && ctx.items.length > 0;
      const headers = isBound ? ["Item / Serviço", "Cobrança"] : el.props.headers;
      const rows = isBound
        ? ctx.items!.map((it) => [it.name, it.billing])
        : el.props.rows.map((r) => r.map((cell) => resolveTokens(cell, tokens)));
      const hBg = el.props.headerBg ?? design.brandKit.darkSurfaceColor;
      const hCol = el.props.headerColor ?? "#FFFFFF";
      const stripe = el.props.stripeBg ?? design.brandKit.lightSurfaceColor;
      const bCol = el.props.borderColor ?? "#E5E7EB";
      const ths = headers
        .map(
          (h) =>
            `<th style="text-align:left;padding:2.5mm 3mm;background:${hBg};color:${hCol};font-weight:700;font-size:${s.fontSize ?? 9.5}pt">${escHtml(resolveTokens(h, tokens))}</th>`,
        )
        .join("");
      const trs = rows
        .map((r, idx) => {
          const bg = idx % 2 === 1 ? `background:${stripe};` : "background:#FFFFFF;";
          const tds = r
            .map(
              (cell) =>
                `<td style="padding:2.5mm 3mm;border-top:1px solid ${bCol};color:${s.textColor ?? design.brandKit.textColor};font-size:${s.fontSize ?? 9.5}pt">${formatSafeText(cell)}</td>`,
            )
            .join("");
          return `<tr style="${bg}">${tds}</tr>`;
        })
        .join("");
      return `<div class="vp-el" data-el-id="${escHtml(el.id)}" style="${boxStyle(el)};overflow:hidden;font-family:'${escHtml(font)}',system-ui,sans-serif"><table style="width:100%;border-collapse:collapse;border:1px solid ${bCol}"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`;
    }

    case "price_card": {
      const renderCard = (
        eyebrow: string,
        title: string,
        price: string,
        subtitle: string,
        yPos: number,
      ) => {
        const isDark = el.props.variant === "dark";
        const isAccent = el.props.variant === "accent";
        const bg =
          s.bgColor ??
          (isDark
            ? design.brandKit.darkSurfaceColor
            : isAccent
              ? design.brandKit.primaryColor
              : design.brandKit.lightSurfaceColor);
        const fg = s.textColor ?? (isDark || isAccent ? "#FFFFFF" : design.brandKit.textColor);
        const mutedFg = isDark || isAccent ? "rgba(255,255,255,0.82)" : design.brandKit.mutedColor;
        const eyebrowCol =
          el.props.eyebrowColor ??
          (isAccent ? "rgba(255,255,255,0.88)" : design.brandKit.accentColor);
        const pad = s.paddingMm ?? 6;
        return `<div class="vp-el" data-el-id="${escHtml(el.id)}" style="${boxStyle(el, yPos)};background:${bg};color:${fg};padding:${pad}mm;font-family:'${escHtml(font)}',system-ui,sans-serif;display:flex;flex-direction:column;justify-content:center;gap:1.5mm;overflow:hidden">
          ${eyebrow ? `<div style="font-size:8.5pt;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;color:${eyebrowCol}">${escHtml(eyebrow)}</div>` : ""}
          ${title ? `<div style="font-size:16pt;font-weight:800;line-height:1.15;color:${fg}">${escHtml(title)}</div>` : ""}
          ${price ? `<div style="font-size:22pt;font-weight:800;line-height:1.1;color:${fg}">${escHtml(price)}</div>` : ""}
          ${subtitle ? `<div style="font-size:9.5pt;line-height:1.4;color:${mutedFg}">${formatSafeText(subtitle)}</div>` : ""}
        </div>`;
      };

      if (el.binding === "items_repeat" && ctx.items && ctx.items.length > 0) {
        const gap = el.props.repeatGapMm ?? 4;
        return ctx.items
          .map((item, idx) =>
            renderCard(
              `OPÇÃO ${String(idx + 1).padStart(2, "0")}`,
              item.name,
              item.billing,
              resolveTokens(el.props.subtitle, tokens),
              el.y + idx * (el.h + gap),
            ),
          )
          .join("");
      }

      return renderCard(
        resolveTokens(el.props.eyebrow, tokens),
        resolveTokens(el.props.title, tokens),
        resolveTokens(el.props.price, tokens),
        resolveTokens(el.props.subtitle, tokens),
        el.y,
      );
    }
  }
}

function renderPageHtml(
  page: VisualPage,
  pageIndex: number,
  totalPages: number,
  design: VisualDesign,
  ctx: VisualRenderContext,
): string {
  const dims = pageSizeMm(design.orientation);
  const tokens = buildTokenMap(ctx, pageIndex, totalPages);
  const useMaster =
    design.master.enabled && page.useMaster && !(design.master.skipFirstPage && pageIndex === 0);

  const masterHeader = useMaster
    ? [...design.master.headerElements]
        .sort((a, b) => a.z - b.z)
        .map((el) => renderElementHtml(el, design, ctx, tokens))
        .join("")
    : "";
  const masterFooter = useMaster
    ? [...design.master.footerElements]
        .sort((a, b) => a.z - b.z)
        .map((el) => renderElementHtml(el, design, ctx, tokens))
        .join("")
    : "";
  const pageBody = [...page.elements]
    .sort((a, b) => a.z - b.z)
    .map((el) => renderElementHtml(el, design, ctx, tokens))
    .join("");

  return `<section class="vp-page" data-page-index="${pageIndex}" style="position:relative;width:${dims.width}mm;height:${dims.height}mm;background:${page.backgroundColor};overflow:hidden;box-sizing:border-box">${masterHeader}${pageBody}${masterFooter}</section>`;
}

function googleFontsLink(design: VisualDesign): string {
  const used = new Set<string>([design.brandKit.headingFont, design.brandKit.bodyFont]);
  const scan = (els: VisualElement[]) => {
    for (const el of els) {
      if (el.style.fontFamily) used.add(el.style.fontFamily);
    }
  };
  scan(design.master.headerElements);
  scan(design.master.footerElements);
  for (const p of design.pages) scan(p.elements);
  const googleFamilies = [...used]
    .filter((f) => f && f !== "system-ui")
    .map((f) => `family=${encodeURIComponent(f)}:wght@400;500;600;700;800`);
  if (!googleFamilies.length) return "";
  return `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${googleFamilies.join("&")}&display=swap" />`;
}

/** Fragmento HTML das páginas visuais (usado na ficha, link público e prévia). */
export function renderVisualDesignPagesHtml(
  design: VisualDesign,
  ctx: VisualRenderContext,
): string {
  const total = design.pages.length;
  const pages = design.pages.map((page, i) => renderPageHtml(page, i, total, design, ctx)).join("");
  return `${googleFontsLink(design)}<div class="vp-deck">${pages}</div>`;
}

/** Documento HTML completo pronto para PDF (Browserless / window.print), página a página. */
export function renderVisualDesignPrintDocument(
  design: VisualDesign,
  ctx: VisualRenderContext,
): string {
  const dims = pageSizeMm(design.orientation);
  const inner = renderVisualDesignPagesHtml(design, ctx);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<style>
@page { size: ${dims.width}mm ${dims.height}mm; margin: 0; }
html, body { margin: 0; padding: 0; background: #ffffff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.vp-deck { display: block; margin: 0; padding: 0; }
.vp-page { page-break-after: always; break-after: page; margin: 0; }
.vp-page:last-child { page-break-after: auto; break-after: auto; }
* { box-sizing: border-box; }
</style>
</head>
<body>${inner}</body>
</html>`;
}

/** Gera um resumo textual limpo do modelo visual para fallback de busca/histórico em proposals.body. */
export function extractPlainSummaryFromDesign(
  design: VisualDesign,
  ctx: VisualRenderContext = {},
): string {
  const parts: string[] = [];
  const total = design.pages.length;
  design.pages.forEach((page, i) => {
    const tokens = buildTokenMap(ctx, i, total);
    const sorted = [...page.elements].sort((a, b) => a.y - b.y || a.x - b.x);
    for (const el of sorted) {
      if (el.hidden) continue;
      if (el.type === "heading") {
        parts.push(`<h2>${escHtml(resolveTokens(el.props.text, tokens))}</h2>`);
      } else if (el.type === "text") {
        parts.push(`<p>${formatSafeText(resolveTokens(el.props.text, tokens))}</p>`);
      } else if (el.type === "price_card") {
        parts.push(
          `<p><strong>${escHtml(resolveTokens(el.props.title, tokens))}</strong> — ${escHtml(resolveTokens(el.props.price, tokens))}</p>`,
        );
      }
    }
  });
  return parts.join("\n").slice(0, 50_000);
}

/** Indica se o modelo visual referencia o logotipo da empresa cliente em algum elemento visível. */
export function designUsesClientLogo(design: VisualDesign): boolean {
  const scan = (els: VisualElement[]): boolean =>
    els.some((el) => {
      if (el.hidden) return false;
      if (el.type === "image" && el.props.bindLogo === "client") return true;
      if (
        (el.type === "text" || el.type === "heading") &&
        /\{\{\s*company\.logo\s*\}\}/.test(el.props.text)
      ) {
        return true;
      }
      return false;
    });
  return (
    scan(design.master.headerElements) ||
    scan(design.master.footerElements) ||
    design.pages.some((p) => scan(p.elements))
  );
}

/** Mescla o contexto da pré-visualização preservando fallbacks de marca e workspace. */
export function mergeVisualPreviewContext(
  base: VisualRenderContext,
  design: VisualDesign,
  signedUrls: Record<string, string>,
  workspaceLogoUrl?: string | null,
): VisualRenderContext {
  return {
    ...base,
    contractingName: base.contractingName || design.brandKit.legalEntityName || "WK Technology",
    contractingLogoUrl: base.contractingLogoUrl || design.brandKit.logoUrl || null,
    workspaceLogoUrl: base.workspaceLogoUrl || workspaceLogoUrl || null,
    signedUrls: { ...signedUrls, ...(base.signedUrls ?? {}) },
  };
}

const REVIEW_MM_TO_PX = 96 / 25.4;
const REVIEW_PAGE_GAP_PX = 16;
const REVIEW_FRAME_PADDING_PX = 24;

export function computeReviewPreviewScale(
  orientation: VisualDesign["orientation"],
  containerWidthPx: number,
): { scale: number; pageWidthPx: number; pageHeightPx: number } {
  const dims = pageSizeMm(orientation);
  const pageWidthPx = dims.width * REVIEW_MM_TO_PX;
  const pageHeightPx = dims.height * REVIEW_MM_TO_PX;
  const available = Math.max(240, containerWidthPx - REVIEW_FRAME_PADDING_PX);
  const scale = Math.min(1, Math.max(0.25, available / pageWidthPx));
  return { scale, pageWidthPx, pageHeightPx };
}

/** Monta o documento HTML isolado (sem scripts) em escala para o iframe da Revisão. */
export function buildVisualReviewSrcDoc(
  design: VisualDesign,
  ctx: VisualRenderContext,
  containerWidthPx: number,
): string {
  const { scale, pageWidthPx, pageHeightPx } = computeReviewPreviewScale(
    design.orientation,
    containerWidthPx,
  );
  const count = Math.max(1, design.pages.length);
  const totalUnscaledH = count * pageHeightPx + Math.max(0, count - 1) * REVIEW_PAGE_GAP_PX;
  const scaledW = Math.round(pageWidthPx * scale);
  const scaledH = Math.round(totalUnscaledH * scale);
  const inner = renderVisualDesignPagesHtml(design, ctx);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<style>
html, body { margin: 0; padding: 0; background: transparent; overflow-x: hidden; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { padding: 12px 0; display: flex; justify-content: center; }
.vp-scale-box { width: ${scaledW}px; height: ${scaledH}px; position: relative; overflow: hidden; }
.vp-scale-inner { width: ${pageWidthPx.toFixed(2)}px; transform: scale(${scale.toFixed(4)}); transform-origin: top left; }
.vp-deck { display: flex; flex-direction: column; align-items: center; gap: ${REVIEW_PAGE_GAP_PX}px; margin: 0; padding: 0; }
.vp-page { margin: 0 !important; box-shadow: 0 2px 10px rgba(15, 23, 42, 0.14); border-radius: 2px; }
* { box-sizing: border-box; }
</style>
</head>
<body><div class="vp-scale-box"><div class="vp-scale-inner">${inner}</div></div></body>
</html>`;
}
