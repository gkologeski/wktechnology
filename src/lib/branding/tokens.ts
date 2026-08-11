// Catálogo único de tokens de tema do white-label.
//
// Um único lugar define: chave da variável CSS, rótulo em pt-BR, grupo e os
// valores padrão para tema claro e escuro. É consumido pelo editor de branding,
// pela prévia ao vivo e pela aplicação em runtime (`src/lib/branding.tsx`),
// evitando divergência entre as três camadas.

export type BrandTokenGroupId =
  | "brand"
  | "surfaces"
  | "text"
  | "structure"
  | "status"
  | "stages";

export type BrandToken = {
  /** Nome da variável CSS, sem os dois hífens iniciais. */
  key: string;
  label: string;
  group: BrandTokenGroupId;
  light: string;
  dark: string;
  /** Variáveis CSS adicionais que recebem o mesmo valor (aliases do design system). */
  aliases?: string[];
  hint?: string;
};

export const BRAND_TOKEN_GROUPS: Array<{ id: BrandTokenGroupId; label: string }> = [
  { id: "brand", label: "Marca" },
  { id: "surfaces", label: "Superfícies" },
  { id: "text", label: "Texto" },
  { id: "structure", label: "Estrutura" },
  { id: "status", label: "Status" },
  { id: "stages", label: "Etapas do funil" },
];

export const BRAND_TOKENS: BrandToken[] = [
  // Marca
  {
    key: "primary",
    label: "Primária",
    group: "brand",
    light: "#1779e1",
    dark: "#4699fe",
    aliases: ["ring", "sidebar-primary", "chart-1"],
  },
  {
    key: "primary-foreground",
    label: "Texto sobre primária",
    group: "brand",
    light: "#fafcfe",
    dark: "#0b121a",
    aliases: ["sidebar-primary-foreground"],
  },
  {
    key: "accent",
    label: "Destaque (accent)",
    group: "brand",
    light: "#e2ecf9",
    dark: "#253447",
    aliases: ["sidebar-accent"],
  },
  {
    key: "accent-foreground",
    label: "Texto sobre destaque",
    group: "brand",
    light: "#192a3c",
    dark: "#eff2f5",
    aliases: ["sidebar-accent-foreground"],
  },
  {
    key: "ai-accent",
    label: "Realce de IA",
    group: "brand",
    light: "#855dd7",
    dark: "#ae8bff",
  },

  // Superfícies
  {
    key: "background",
    label: "Fundo da página",
    group: "surfaces",
    light: "#fafcfe",
    dark: "#0b121a",
    aliases: ["surface-1"],
  },
  {
    key: "card",
    label: "Cartão / superfície",
    group: "surfaces",
    light: "#ffffff",
    dark: "#121c26",
    aliases: ["popover", "surface-2"],
  },
  {
    key: "surface-3",
    label: "Superfície elevada",
    group: "surfaces",
    light: "#f4f7fa",
    dark: "#1a2531",
  },
  {
    key: "surface-sunken",
    label: "Superfície rebaixada",
    group: "surfaces",
    light: "#eff2f6",
    dark: "#070e16",
  },
  {
    key: "muted",
    label: "Fundo neutro (muted)",
    group: "surfaces",
    light: "#edf2f8",
    dark: "#1d2a37",
    aliases: ["secondary"],
  },
  {
    key: "sidebar",
    label: "Barra lateral",
    group: "surfaces",
    light: "#f8fafd",
    dark: "#121c26",
  },

  // Texto
  {
    key: "foreground",
    label: "Texto principal",
    group: "text",
    light: "#101c28",
    dark: "#eff2f5",
    aliases: ["card-foreground", "popover-foreground", "text-primary"],
  },
  {
    key: "muted-foreground",
    label: "Texto secundário",
    group: "text",
    light: "#606a74",
    dark: "#95a0ab",
    aliases: ["hs-text-muted"],
  },
  {
    key: "text-secondary",
    label: "Texto de apoio",
    group: "text",
    light: "#4d5660",
    dark: "#b0b8c1",
  },
  {
    key: "text-tertiary",
    label: "Texto terciário",
    group: "text",
    light: "#737b85",
    dark: "#8a939d",
  },
  {
    key: "sidebar-foreground",
    label: "Texto da barra lateral",
    group: "text",
    light: "#192a3c",
    dark: "#eff2f5",
  },

  // Estrutura
  {
    key: "border",
    label: "Borda",
    group: "structure",
    light: "#e0e5eb",
    dark: "#262f38",
    aliases: ["border-default", "sidebar-border", "hs-divider"],
  },
  {
    key: "border-subtle",
    label: "Divisor sutil",
    group: "structure",
    light: "#e7ecf0",
    dark: "#1d252d",
  },
  {
    key: "border-strong",
    label: "Borda destacada",
    group: "structure",
    light: "#bec5cc",
    dark: "#404952",
  },
  {
    key: "input",
    label: "Borda de campos",
    group: "structure",
    light: "#e0e5eb",
    dark: "#2b343d",
  },

  // Status
  {
    key: "success",
    label: "Sucesso",
    group: "status",
    light: "#20a04e",
    dark: "#2ea957",
    aliases: ["status-open", "sla-ok", "chart-2"],
  },
  {
    key: "warning",
    label: "Aviso",
    group: "status",
    light: "#ed990e",
    dark: "#f7a224",
    aliases: ["status-onhold", "sla-warn", "chart-3"],
  },
  {
    key: "destructive",
    label: "Erro / destrutivo",
    group: "status",
    light: "#e62c2c",
    dark: "#f14e46",
    aliases: ["sla-breached", "chart-5"],
  },
  {
    key: "dei-accent",
    label: "Informação",
    group: "status",
    light: "#0a9bb4",
    dark: "#28b6cf",
  },

  // Etapas do funil
  { key: "hs-stage-1", label: "Etapa inicial", group: "stages", light: "#92a7bd", dark: "#74889e" },
  { key: "hs-stage-2", label: "Etapa 2", group: "stages", light: "#32a5d4", dark: "#00a7dd" },
  { key: "hs-stage-3", label: "Etapa 3", group: "stages", light: "#00bcc5", dark: "#00b7c1" },
  { key: "hs-stage-4", label: "Etapa 4", group: "stages", light: "#cda629", dark: "#d8ab00" },
  { key: "hs-stage-won", label: "Ganho", group: "stages", light: "#2ea957", dark: "#3bb360" },
  { key: "hs-stage-lost", label: "Perdido", group: "stages", light: "#e6443d", dark: "#f45249" },
];

export const BRAND_TOKEN_KEYS = BRAND_TOKENS.map((t) => t.key);

export function tokensByGroup(group: BrandTokenGroupId): BrandToken[] {
  return BRAND_TOKENS.filter((t) => t.group === group);
}

export function defaultThemeColors(mode: "light" | "dark"): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of BRAND_TOKENS) out[t.key] = mode === "dark" ? t.dark : t.light;
  return out;
}

// ────────────────────────────────────────────────────────────────────────
// Ícones e imagens
// ────────────────────────────────────────────────────────────────────────

export type BrandIcons = {
  /** Espessura do traço dos ícones (Lucide). */
  stroke?: number;
  /** Tamanho base dos ícones, em px. */
  size?: number;
};

export type BrandAssets = {
  logo_light?: string;
  logo_dark?: string;
  logo_mark?: string;
  login_image?: string;
  empty_illustration?: string;
};

export const DEFAULT_ICONS: Required<BrandIcons> = { stroke: 2, size: 16 };

export type BrandTheme = {
  light?: Record<string, string>;
  dark?: Record<string, string>;
  icons?: BrandIcons;
  assets?: BrandAssets;
};

export const EMPTY_THEME: BrandTheme = { light: {}, dark: {}, icons: {}, assets: {} };

/** Mescla temas na ordem recebida (o último vence, chave por chave). */
export function mergeThemes(...themes: Array<BrandTheme | null | undefined>): BrandTheme {
  const out: BrandTheme = { light: {}, dark: {}, icons: {}, assets: {} };
  for (const t of themes) {
    if (!t) continue;
    Object.assign(out.light!, t.light ?? {});
    Object.assign(out.dark!, t.dark ?? {});
    Object.assign(out.icons!, t.icons ?? {});
    Object.assign(out.assets!, t.assets ?? {});
  }
  return out;
}

/** Remove chaves desconhecidas/vazias antes de persistir. */
export function sanitizeTheme(theme: BrandTheme | null | undefined): BrandTheme {
  const pickColors = (src: Record<string, string> | undefined) => {
    const out: Record<string, string> = {};
    for (const key of BRAND_TOKEN_KEYS) {
      const v = src?.[key];
      if (typeof v === "string" && v.trim()) out[key] = v.trim();
    }
    return out;
  };
  const assetsIn = theme?.assets ?? {};
  const assets: BrandAssets = {};
  for (const k of [
    "logo_light",
    "logo_dark",
    "logo_mark",
    "login_image",
    "empty_illustration",
  ] as const) {
    const v = assetsIn[k];
    if (typeof v === "string" && v.trim()) assets[k] = v.trim();
  }
  const icons: BrandIcons = {};
  if (typeof theme?.icons?.stroke === "number") icons.stroke = theme.icons.stroke;
  if (typeof theme?.icons?.size === "number") icons.size = theme.icons.size;

  return { light: pickColors(theme?.light), dark: pickColors(theme?.dark), icons, assets };
}

/** Gera o CSS (`:root` + `.dark`) para as variáveis definidas no tema. */
export function themeToCss(theme: BrandTheme | null | undefined, scope = ":root"): string {
  if (!theme) return "";
  const decl = (colors: Record<string, string> | undefined) => {
    if (!colors) return "";
    const lines: string[] = [];
    for (const token of BRAND_TOKENS) {
      const value = colors[token.key];
      if (!value) continue;
      lines.push(`--${token.key}:${value};`);
      for (const alias of token.aliases ?? []) lines.push(`--${alias}:${value};`);
    }
    return lines.join("");
  };
  const light = decl(theme.light);
  const dark = decl(theme.dark);
  const icons: string[] = [];
  if (theme.icons?.stroke) icons.push(`--icon-stroke:${theme.icons.stroke};`);
  if (theme.icons?.size) icons.push(`--icon-size:${theme.icons.size}px;`);

  let css = "";
  if (light || icons.length) css += `${scope}{${light}${icons.join("")}}`;
  if (dark) css += `${scope === ":root" ? ".dark" : `${scope}.dark, .dark ${scope}`}{${dark}}`;
  return css;
}
