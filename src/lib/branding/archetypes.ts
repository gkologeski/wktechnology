import { BRAND_TOKEN_KEYS, sanitizeTheme, type BrandTheme } from "./tokens";

export type BrandArchetypeId = "quiet-premium" | "modern-soft" | "enterprise-classic";

export type BrandArchetypeStyle = {
  primary_color: string;
  accent_color: string;
  radius: string;
  density: "compact" | "cozy" | "comfortable";
  heading_font: string;
  body_font: string;
};

export type BrandArchetype = {
  id: BrandArchetypeId;
  name: string;
  description: string;
  recommendedFor: string;
  style: BrandArchetypeStyle;
  theme: BrandTheme & {
    light: Record<string, string>;
    dark: Record<string, string>;
    icons: { stroke: number; size: number };
  };
};

const quietLight = {
  primary: "#1779E1", "primary-foreground": "#FAFCFE", accent: "#E2ECF9", "accent-foreground": "#192A3C", "ai-accent": "#855DD7",
  background: "#FAFCFE", card: "#FFFFFF", "surface-3": "#F4F7FA", "surface-sunken": "#EFF2F6", muted: "#EDF2F8", sidebar: "#F8FAFD",
  "product-canvas": "#E9F1F8", "product-header": "#F7FBFE", "product-toolbar": "#F2F8FC", "product-panel": "#FFFFFF", "product-panel-muted": "#F0F6FB", "product-panel-strong": "#E0EBF3", "product-divider": "#C9D4DD",
  foreground: "#101C28", "muted-foreground": "#606A74", "text-secondary": "#4D5660", "text-tertiary": "#737B85", "sidebar-foreground": "#192A3C",
  border: "#E0E5EB", "border-subtle": "#E7ECF0", "border-strong": "#BEC5CC", input: "#E0E5EB",
  success: "#208A48", warning: "#C97705", destructive: "#D72C2C", "dei-accent": "#087F97",
  "hs-stage-1": "#8096AD", "hs-stage-2": "#248BB8", "hs-stage-3": "#079CA4", "hs-stage-4": "#A98212", "hs-stage-won": "#258A49", "hs-stage-lost": "#CE3732",
};

const quietDark = {
  primary: "#4699FE", "primary-foreground": "#0B121A", accent: "#253447", "accent-foreground": "#EFF2F5", "ai-accent": "#AE8BFF",
  background: "#0B121A", card: "#121C26", "surface-3": "#1A2531", "surface-sunken": "#070E16", muted: "#1D2A37", sidebar: "#121C26",
  "product-canvas": "#050B11", "product-header": "#0F1822", "product-toolbar": "#0B131C", "product-panel": "#121C26", "product-panel-muted": "#19242F", "product-panel-strong": "#202D3A", "product-divider": "#353E47",
  foreground: "#EFF2F5", "muted-foreground": "#A5AFB9", "text-secondary": "#C0C7CF", "text-tertiary": "#98A2AD", "sidebar-foreground": "#EFF2F5",
  border: "#303A44", "border-subtle": "#252E37", "border-strong": "#4A5560", input: "#36414C",
  success: "#45C56E", warning: "#F7A224", destructive: "#FF665D", "dei-accent": "#38C4DB",
  "hs-stage-1": "#8FA3B8", "hs-stage-2": "#37B6E8", "hs-stage-3": "#2AC5CD", "hs-stage-4": "#E3BB35", "hs-stage-won": "#4AC570", "hs-stage-lost": "#FF665D",
};

const modernLight = {
  primary: "#5B5BD6", "primary-foreground": "#FFFFFF", accent: "#EDEDFE", "accent-foreground": "#303052", "ai-accent": "#A855F7",
  background: "#FBFBFD", card: "#FFFFFF", "surface-3": "#F7F7FA", "surface-sunken": "#F2F2F6", muted: "#F1F2F6", sidebar: "#F8F8FB",
  "product-canvas": "#F1F3F7", "product-header": "#FFFFFF", "product-toolbar": "#F8F8FB", "product-panel": "#FFFFFF", "product-panel-muted": "#F6F6F9", "product-panel-strong": "#ECECF2", "product-divider": "#DDDDE6",
  foreground: "#202127", "muted-foreground": "#666975", "text-secondary": "#535661", "text-tertiary": "#7A7D88", "sidebar-foreground": "#30313A",
  border: "#E5E5EC", "border-subtle": "#EEEEF3", "border-strong": "#CACAD5", input: "#DDDDE6",
  success: "#238A57", warning: "#B96B08", destructive: "#D63C4A", "dei-accent": "#087E9A",
  "hs-stage-1": "#8792A2", "hs-stage-2": "#4F87D9", "hs-stage-3": "#338F96", "hs-stage-4": "#A87917", "hs-stage-won": "#27875A", "hs-stage-lost": "#C8424E",
};

const modernDark = {
  primary: "#8B8BEA", "primary-foreground": "#17171C", accent: "#34344A", "accent-foreground": "#F4F4F7", "ai-accent": "#C084FC",
  background: "#17171C", card: "#1E1E24", "surface-3": "#26262D", "surface-sunken": "#121217", muted: "#292931", sidebar: "#1B1B21",
  "product-canvas": "#111116", "product-header": "#1D1D23", "product-toolbar": "#18181E", "product-panel": "#202027", "product-panel-muted": "#282830", "product-panel-strong": "#303039", "product-divider": "#41414B",
  foreground: "#F4F4F7", "muted-foreground": "#AAAAB4", "text-secondary": "#C7C7CF", "text-tertiary": "#9696A1", "sidebar-foreground": "#ECECF1",
  border: "#34343D", "border-subtle": "#2A2A32", "border-strong": "#50505B", input: "#41414B",
  success: "#48C78A", warning: "#F1AD4E", destructive: "#F26B78", "dei-accent": "#47C3DD",
  "hs-stage-1": "#9AA4B2", "hs-stage-2": "#78A9EF", "hs-stage-3": "#65BCC2", "hs-stage-4": "#D7B45A", "hs-stage-won": "#54C990", "hs-stage-lost": "#F17782",
};

const classicLight = {
  primary: "#1557A0", "primary-foreground": "#FFFFFF", accent: "#DCE8F5", "accent-foreground": "#17324D", "ai-accent": "#6B4CB3",
  background: "#F5F7FA", card: "#FFFFFF", "surface-3": "#EDF1F5", "surface-sunken": "#E8EDF2", muted: "#E9EEF3", sidebar: "#EEF3F8",
  "product-canvas": "#E3E9EF", "product-header": "#F7F9FB", "product-toolbar": "#EAF0F5", "product-panel": "#FFFFFF", "product-panel-muted": "#EDF2F6", "product-panel-strong": "#D9E2EA", "product-divider": "#B8C4CF",
  foreground: "#17212B", "muted-foreground": "#536170", "text-secondary": "#3E4B58", "text-tertiary": "#687684", "sidebar-foreground": "#203449",
  border: "#C8D1DA", "border-subtle": "#D9E0E7", "border-strong": "#9DAAB7", input: "#B9C5D0",
  success: "#187744", warning: "#A85E00", destructive: "#C12D35", "dei-accent": "#08758A",
  "hs-stage-1": "#70859A", "hs-stage-2": "#2472B8", "hs-stage-3": "#187F87", "hs-stage-4": "#946D0A", "hs-stage-won": "#1C7848", "hs-stage-lost": "#B7373D",
};

const classicDark = {
  primary: "#5A9BE2", "primary-foreground": "#09111A", accent: "#263B52", "accent-foreground": "#F1F5F8", "ai-accent": "#A98AE3",
  background: "#101820", card: "#17212B", "surface-3": "#202C37", "surface-sunken": "#0A1118", muted: "#22303C", sidebar: "#131D27",
  "product-canvas": "#080E14", "product-header": "#15202A", "product-toolbar": "#111A23", "product-panel": "#18232D", "product-panel-muted": "#212E39", "product-panel-strong": "#2A3945", "product-divider": "#46535F",
  foreground: "#F1F5F8", "muted-foreground": "#A9B4BE", "text-secondary": "#C7D0D8", "text-tertiary": "#94A0AC", "sidebar-foreground": "#E8EEF3",
  border: "#3A4651", "border-subtle": "#2B3640", "border-strong": "#596673", input: "#46535F",
  success: "#45BE78", warning: "#E4A13D", destructive: "#EE6269", "dei-accent": "#42B8CB",
  "hs-stage-1": "#91A4B7", "hs-stage-2": "#69A8E1", "hs-stage-3": "#52B3BA", "hs-stage-4": "#D3AD4B", "hs-stage-won": "#4BC182", "hs-stage-lost": "#EE6A70",
};

export const BRAND_ARCHETYPES: BrandArchetype[] = [
  {
    id: "quiet-premium",
    name: "Quiet Premium",
    description: "Sóbrio, preciso e equilibrado para grande volume de informações.",
    recommendedFor: "SaaS B2B, CRM e operações financeiras",
    style: { primary_color: "#1779E1", accent_color: "#E2ECF9", radius: "6px", density: "compact", heading_font: "Inter, ui-sans-serif, system-ui", body_font: "Inter, ui-sans-serif, system-ui" },
    theme: { light: quietLight, dark: quietDark, icons: { stroke: 1.75, size: 16 } },
  },
  {
    id: "modern-soft",
    name: "Modern Soft",
    description: "Arejado, acolhedor e contemporâneo, com formas mais suaves.",
    recommendedFor: "Consultorias, agências e portais de clientes",
    style: { primary_color: "#5B5BD6", accent_color: "#EDEDFE", radius: "12px", density: "comfortable", heading_font: "'Outfit', ui-sans-serif, system-ui", body_font: "'DM Sans', ui-sans-serif, system-ui" },
    theme: { light: modernLight, dark: modernDark, icons: { stroke: 1.5, size: 18 } },
  },
  {
    id: "enterprise-classic",
    name: "Enterprise Classic",
    description: "Estruturado e denso, com divisões claras para operações complexas.",
    recommendedFor: "ERP corporativo, indústria e alta conformidade",
    style: { primary_color: "#1557A0", accent_color: "#DCE8F5", radius: "3px", density: "compact", heading_font: "'Plus Jakarta Sans', ui-sans-serif, system-ui", body_font: "Inter, ui-sans-serif, system-ui" },
    theme: { light: classicLight, dark: classicDark, icons: { stroke: 2, size: 15 } },
  },
];

function normalized(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : String(value ?? "");
}

export function archetypeMatches(
  archetype: BrandArchetype,
  style: BrandArchetypeStyle,
  theme: BrandTheme,
): boolean {
  for (const key of Object.keys(archetype.style) as Array<keyof BrandArchetypeStyle>) {
    if (normalized(style[key]) !== normalized(archetype.style[key])) return false;
  }
  const clean = sanitizeTheme(theme);
  for (const mode of ["light", "dark"] as const) {
    for (const key of BRAND_TOKEN_KEYS) {
      if (normalized(clean[mode]?.[key]) !== normalized(archetype.theme[mode][key])) return false;
    }
  }
  return clean.icons?.stroke === archetype.theme.icons.stroke && clean.icons?.size === archetype.theme.icons.size;
}

export function identifyBrandArchetype(
  style: BrandArchetypeStyle,
  theme: BrandTheme,
): BrandArchetypeId | null {
  return BRAND_ARCHETYPES.find((archetype) => archetypeMatches(archetype, style, theme))?.id ?? null;
}

export function applyBrandArchetype(
  archetype: BrandArchetype,
  currentTheme: BrandTheme,
): { style: BrandArchetypeStyle; theme: BrandTheme } {
  return {
    style: { ...archetype.style },
    theme: sanitizeTheme({
      light: { ...archetype.theme.light },
      dark: { ...archetype.theme.dark },
      icons: { ...archetype.theme.icons },
      assets: { ...(currentTheme.assets ?? {}) },
    }),
  };
}

export function archetypeHasCompletePalette(archetype: BrandArchetype): boolean {
  const expected = [...BRAND_TOKEN_KEYS].sort();
  return (["light", "dark"] as const).every(
    (mode) => JSON.stringify(Object.keys(archetype.theme[mode]).sort()) === JSON.stringify(expected),
  );
}