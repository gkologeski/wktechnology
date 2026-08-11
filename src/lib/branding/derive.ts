// Derivação de paleta escura a partir da clara + verificação de contraste (WCAG).
import { hexToRgb, rgbToHex, anyToHex } from "@/lib/color-utils";
import { BRAND_TOKENS, type BrandToken } from "./tokens";

function relLuminance(hex: string): number {
  const rgb = hexToRgb(anyToHex(hex));
  if (!rgb) return 0;
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
}

/** Razão de contraste entre duas cores (1 a 21). */
export function contrastRatio(a: string, b: string): number {
  const la = relLuminance(a);
  const lb = relLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** Passa no critério AA para texto normal (4.5:1). */
export function meetsAA(fg: string, bg: string): boolean {
  return contrastRatio(fg, bg) >= 4.5;
}

function mix(hex: string, target: string, amount: number): string {
  const a = hexToRgb(anyToHex(hex));
  const b = hexToRgb(anyToHex(target));
  if (!a || !b) return hex;
  return rgbToHex(
    a.r + (b.r - a.r) * amount,
    a.g + (b.g - a.g) * amount,
    a.b + (b.b - a.b) * amount,
  );
}

/**
 * Deriva o valor escuro de um token a partir do valor claro escolhido.
 * Superfícies e textos são invertidos; cores de marca/status apenas clareiam
 * para manter contraste em fundo escuro.
 */
function deriveToken(token: BrandToken, lightValue: string): string {
  const v = anyToHex(lightValue);
  switch (token.group) {
    case "surfaces":
      // Quanto mais claro o valor original, mais escuro o correspondente.
      return mix("#0b121a", "#243040", 1 - Math.min(1, relLuminance(v) + 0.15));
    case "text":
      return relLuminance(v) > 0.5 ? mix(v, "#0b121a", 0.85) : mix(v, "#ffffff", 0.88);
    case "structure":
      return mix("#0b121a", "#ffffff", 0.14);
    default:
      // marca / status / etapas — clareia levemente
      return relLuminance(v) < 0.45 ? mix(v, "#ffffff", 0.22) : mix(v, "#ffffff", 0.08);
  }
}

/** Deriva toda a paleta escura a partir da paleta clara informada. */
export function deriveDarkFromLight(
  light: Record<string, string>,
  fallback: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const token of BRAND_TOKENS) {
    const src = light[token.key] ?? fallback[token.key];
    if (!src) continue;
    out[token.key] = deriveToken(token, src);
  }
  // Textos sobre marca acompanham a nova primária.
  if (out["primary"]) {
    out["primary-foreground"] = relLuminance(out["primary"]) > 0.5 ? "#0b121a" : "#ffffff";
  }
  return out;
}

export type ContrastIssue = { fgKey: string; bgKey: string; ratio: number; label: string };

const CONTRAST_PAIRS: Array<{ fg: string; bg: string; label: string }> = [
  { fg: "foreground", bg: "background", label: "Texto principal sobre o fundo" },
  { fg: "foreground", bg: "card", label: "Texto principal sobre cartão" },
  { fg: "muted-foreground", bg: "card", label: "Texto secundário sobre cartão" },
  { fg: "primary-foreground", bg: "primary", label: "Texto sobre a cor primária" },
  { fg: "accent-foreground", bg: "accent", label: "Texto sobre o destaque" },
  { fg: "sidebar-foreground", bg: "sidebar", label: "Texto da barra lateral" },
];

/** Lista pares de tokens com contraste abaixo de AA. */
export function contrastIssues(colors: Record<string, string>): ContrastIssue[] {
  const issues: ContrastIssue[] = [];
  for (const pair of CONTRAST_PAIRS) {
    const fg = colors[pair.fg];
    const bg = colors[pair.bg];
    if (!fg || !bg) continue;
    const ratio = contrastRatio(fg, bg);
    if (ratio < 4.5) {
      issues.push({ fgKey: pair.fg, bgKey: pair.bg, ratio, label: pair.label });
    }
  }
  return issues;
}
