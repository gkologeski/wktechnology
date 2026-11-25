import { autoLogoUrls, logoDomain } from "@/lib/domain-utils";

export type CompanyLogoSourceRow = {
  logo_url?: string | null;
  logo_source?: string | null;
  domain?: string | null;
  website?: string | null;
};

const MAX_INLINE_LOGO_BYTES = 2 * 1024 * 1024;

/** Imagens raster inline: tamanho limitado, base64 estrito e assinatura compatível. */
function sanitizeInlineLogoUrl(raw: string): string | null {
  if (raw.length > Math.ceil(MAX_INLINE_LOGO_BYTES / 3) * 4 + 32) return null;
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(raw);
  const type = match?.[1];
  const payload = match?.[2];
  if (!type || !payload || payload.length % 4 !== 0) return null;
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  if ((payload.length / 4) * 3 - padding > MAX_INLINE_LOGO_BYTES) return null;
  let bytes: string;
  try {
    bytes = atob(payload);
  } catch {
    return null;
  }
  const valid =
    (type === "png" && bytes.startsWith("\x89PNG\r\n\x1a\n")) ||
    (type === "jpeg" && bytes.startsWith("\xff\xd8\xff")) ||
    (type === "webp" && bytes.startsWith("RIFF") && bytes.slice(8, 12) === "WEBP");
  return valid ? raw : null;
}

/** Aceita HTTPS e imagens raster inline seguras; mantém o nome por compatibilidade. */
export function sanitizeHttpsLogoUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith("data:")) return sanitizeInlineLogoUrl(trimmed);
  if (!trimmed || trimmed.length > 2048) return null;
  for (let i = 0; i < trimmed.length; i += 1) {
    const code = trimmed.charCodeAt(i);
    if (code <= 31 || code === 127) return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  if (!parsed.hostname) return null;
  return parsed.toString();
}

/**
 * Resolve o logotipo da empresa cliente seguindo a mesma cascata do sistema:
 * logo manual (HTTPS ou raster inline) -> logo pelo domínio -> nada.
 */
export function resolveCompanyLogoUrl(company?: CompanyLogoSourceRow | null): string | null {
  if (!company) return null;
  if (company.logo_source === "none") return null;
  const manual = sanitizeHttpsLogoUrl(company.logo_url);
  if (manual) return manual;
  const domain = logoDomain(company.domain, company.website);
  const auto = autoLogoUrls(domain)[0];
  return sanitizeHttpsLogoUrl(auto);
}

/** Resolve o logotipo da empresa prestadora: entidade legal -> workspace -> nada. */
export function resolveProviderLogoUrl(
  legalEntityLogoUrl?: string | null,
  workspaceLogoUrl?: string | null,
): string | null {
  return sanitizeHttpsLogoUrl(legalEntityLogoUrl) ?? sanitizeHttpsLogoUrl(workspaceLogoUrl);
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Renderiza a tag <img> sanitizada ou vazio quando não há imagem válida. */
export function renderLogoImgTag(
  url: unknown,
  alt: string,
  options?: { maxHeightPx?: number; maxWidthPx?: number },
): string {
  const safe = sanitizeHttpsLogoUrl(url);
  if (!safe) return "";
  const maxH = options?.maxHeightPx ?? 48;
  const maxW = options?.maxWidthPx ?? 180;
  const safeAlt = escapeAttr(alt.trim() || "Logotipo da empresa");
  return `<img src="${escapeAttr(safe)}" alt="${safeAlt}" style="max-height:${maxH}px;max-width:${maxW}px;height:auto;width:auto;object-fit:contain;display:inline-block;vertical-align:middle;" />`;
}

/**
 * Interpola {{company.logo}} e {{provider.logo}} (e variantes {{{...}}}) em HTML
 * de texto rico já salvo ou em renderização.
 */
export function replaceRichTextLogoTokens(
  html: string,
  opts: {
    companyLogoUrl?: string | null;
    companyName?: string | null;
    providerLogoUrl?: string | null;
    providerName?: string | null;
  },
): string {
  if (!html || (!html.includes("company.logo") && !html.includes("provider.logo"))) return html;
  const companyAlt = opts.companyName?.trim()
    ? `Logo de ${opts.companyName.trim()}`
    : "Logo da empresa cliente";
  const providerAlt = opts.providerName?.trim()
    ? `Logo de ${opts.providerName.trim()}`
    : "Logo da empresa prestadora";
  const companyTag = renderLogoImgTag(opts.companyLogoUrl, companyAlt);
  const providerTag = renderLogoImgTag(opts.providerLogoUrl, providerAlt);
  return html
    .replace(/\{\{\{?\s*company\.logo\s*\}?\}\}/g, companyTag)
    .replace(/\{\{\{?\s*provider\.logo\s*\}?\}\}/g, providerTag);
}
