import { describe, expect, it } from "vitest";
import { BRAND_TOKEN_KEYS } from "./tokens";
import {
  applyBrandArchetype,
  archetypeHasCompletePalette,
  BRAND_ARCHETYPES,
  identifyBrandArchetype,
} from "./archetypes";

describe("arquétipos de branding", () => {
  it("define três modelos com paletas completas e valores válidos", () => {
    expect(BRAND_ARCHETYPES).toHaveLength(3);
    for (const archetype of BRAND_ARCHETYPES) {
      expect(archetypeHasCompletePalette(archetype)).toBe(true);
      expect(Object.keys(archetype.theme.light)).toHaveLength(BRAND_TOKEN_KEYS.length);
      expect(Object.keys(archetype.theme.dark)).toHaveLength(BRAND_TOKEN_KEYS.length);
      for (const value of Object.values(archetype.theme.light)) expect(value).toMatch(/^#[0-9A-F]{6}$/);
      for (const value of Object.values(archetype.theme.dark)) expect(value).toMatch(/^#[0-9A-F]{6}$/);
      expect(archetype.theme.icons.stroke).toBeGreaterThanOrEqual(1);
      expect(archetype.theme.icons.stroke).toBeLessThanOrEqual(3);
      expect(archetype.theme.icons.size).toBeGreaterThanOrEqual(12);
      expect(archetype.theme.icons.size).toBeLessThanOrEqual(24);
    }
  });

  it("substitui o estilo e preserva somente os assets existentes", () => {
    const archetype = BRAND_ARCHETYPES[1];
    expect(archetype).toBeDefined();
    if (!archetype) return;
    const applied = applyBrandArchetype(archetype, {
      light: { primary: "#000000" },
      icons: { stroke: 3 },
      assets: { logo_light: "https://example.com/logo.svg", empty_illustration: "https://example.com/empty.svg" },
    });
    expect(applied.style).toEqual(archetype.style);
    expect(applied.theme.light).toEqual(archetype.theme.light);
    expect(applied.theme.dark).toEqual(archetype.theme.dark);
    expect(applied.theme.icons).toEqual(archetype.theme.icons);
    expect(applied.theme.assets).toEqual({
      logo_light: "https://example.com/logo.svg",
      empty_illustration: "https://example.com/empty.svg",
    });
  });

  it("reconhece modelos completos e trata uma edição manual como personalizada", () => {
    const archetype = BRAND_ARCHETYPES[0];
    expect(archetype).toBeDefined();
    if (!archetype) return;
    expect(identifyBrandArchetype(archetype.style, archetype.theme)).toBe(archetype.id);
    expect(
      identifyBrandArchetype(archetype.style, {
        ...archetype.theme,
        light: { ...archetype.theme.light, primary: "#000000" },
      }),
    ).toBeNull();
  });
});