import { BRAND_TOKENS } from "@/lib/branding/tokens";

export type PreviewEditorTab = "basics" | "theme";
export type PreviewMode = "light" | "dark";

export type PreviewTarget = {
  id: string;
  label: string;
  tab: PreviewEditorTab;
  related?: string[];
};

const tokenTargets = new Map(
  BRAND_TOKENS.map((token) => [
    token.key,
    { id: token.key, label: token.label, tab: "theme" as const },
  ]),
);

const basicTargets: Record<string, PreviewTarget> = {
  brand_name: { id: "brand_name", label: "Nome da marca", tab: "basics" },
  logo_url: { id: "logo_url", label: "Logo", tab: "basics" },
  primary_color: { id: "primary_color", label: "Cor primária", tab: "basics" },
  accent_color: { id: "accent_color", label: "Destaque (accent)", tab: "basics" },
  radius: { id: "radius", label: "Raio da borda", tab: "basics" },
  density: { id: "density", label: "Densidade", tab: "basics" },
  heading_font: { id: "heading_font", label: "Fonte de títulos", tab: "basics" },
  body_font: { id: "body_font", label: "Fonte de texto", tab: "basics" },
  "icon-stroke": { id: "icon-stroke", label: "Espessura dos ícones", tab: "theme" },
  "icon-size": { id: "icon-size", label: "Tamanho dos ícones", tab: "theme" },
  logo_light: { id: "logo_light", label: "Logo do tema claro", tab: "theme" },
  logo_dark: { id: "logo_dark", label: "Logo do tema escuro", tab: "theme" },
  empty_illustration: {
    id: "empty_illustration",
    label: "Ilustração de estado vazio",
    tab: "theme",
  },
};

export function previewTarget(id: string, related?: string[]): PreviewTarget {
  const target = tokenTargets.get(id) ?? basicTargets[id];
  return target ? { ...target, related } : { id, label: id, tab: "theme", related };
}
