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

import {
  classicDark,
  classicLight,
  modernDark,
  modernLight,
  quietDark,
  quietLight,
} from "./archetype-palettes";

export const BRAND_ARCHETYPES: BrandArchetype[] = [
  {
    id: "quiet-premium",
    name: "Quiet Premium",
    description: "Sóbrio, preciso e equilibrado para grande volume de informações.",
    recommendedFor: "SaaS B2B, CRM e operações financeiras",
    style: {
      primary_color: "#1672D4",
      accent_color: "#E2ECF9",
      radius: "6px",
      density: "compact",
      heading_font: "Inter, ui-sans-serif, system-ui",
      body_font: "Inter, ui-sans-serif, system-ui",
    },
    theme: { light: quietLight, dark: quietDark, icons: { stroke: 1.75, size: 16 } },
  },
  {
    id: "modern-soft",
    name: "Modern Soft",
    description: "Arejado, acolhedor e contemporâneo, com formas mais suaves.",
    recommendedFor: "Consultorias, agências e portais de clientes",
    style: {
      primary_color: "#5B5BD6",
      accent_color: "#EDEDFE",
      radius: "12px",
      density: "comfortable",
      heading_font: "'Outfit', ui-sans-serif, system-ui",
      body_font: "'DM Sans', ui-sans-serif, system-ui",
    },
    theme: { light: modernLight, dark: modernDark, icons: { stroke: 1.5, size: 18 } },
  },
  {
    id: "enterprise-classic",
    name: "Enterprise Classic",
    description: "Estruturado e denso, com divisões claras para operações complexas.",
    recommendedFor: "ERP corporativo, indústria e alta conformidade",
    style: {
      primary_color: "#1557A0",
      accent_color: "#DCE8F5",
      radius: "3px",
      density: "compact",
      heading_font: "'Plus Jakarta Sans', ui-sans-serif, system-ui",
      body_font: "Inter, ui-sans-serif, system-ui",
    },
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
  return (
    clean.icons?.stroke === archetype.theme.icons.stroke &&
    clean.icons?.size === archetype.theme.icons.size
  );
}

export function identifyBrandArchetype(
  style: BrandArchetypeStyle,
  theme: BrandTheme,
): BrandArchetypeId | null {
  return (
    BRAND_ARCHETYPES.find((archetype) => archetypeMatches(archetype, style, theme))?.id ?? null
  );
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
    (mode) =>
      JSON.stringify(Object.keys(archetype.theme[mode]).sort()) === JSON.stringify(expected),
  );
}
