import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { mergeThemes, sanitizeTheme, themeToCss, workspaceLayout, type BrandTheme } from "./tokens";
import { applyBrandArchetype, BRAND_ARCHETYPES } from "./archetypes";

describe("workspace layout compatibility", () => {
  it("defaults legacy, empty and unsupported themes to classic", () => {
    for (const theme of [undefined, null, {}, { layout: "unknown" } as unknown as BrandTheme])
      expect(workspaceLayout(sanitizeTheme(theme))).toBe("classic");
  });
  it("round-trips the opt-in layout without changing identity or palette", () => {
    const theme = {
      ...BRAND_ARCHETYPES[2].theme,
      assets: { logo_light: "https://example.com/logo.svg" },
    };
    const selected = sanitizeTheme({ ...theme, layout: "attio" });
    expect(selected).toEqual({ ...sanitizeTheme(theme), layout: "attio" });
    expect(themeToCss(selected)).toBe(themeToCss(theme));
    expect(sanitizeTheme({ ...selected, layout: "classic" })).toEqual({
      ...sanitizeTheme(theme),
      layout: "classic",
    });
  });
  it("keeps selected structure when editing colors or applying an archetype", () => {
    const theme: BrandTheme = {
      layout: "attio",
      assets: { logo_dark: "https://example.com/dark.svg" },
    };
    expect(applyBrandArchetype(BRAND_ARCHETYPES[0], theme).theme).toMatchObject(theme);
    expect(mergeThemes(theme, { light: { primary: "var(--primary)" } }).layout).toBe("attio");
  });
  it("uses workspace layout independently from module token overrides", () => {
    const workspace: BrandTheme = { layout: "attio" };
    const module: BrandTheme = { layout: "classic", light: { primary: "var(--module-primary)" } };
    expect(workspaceLayout(workspace)).toBe("attio");
    // Provider intentionally uses branding.theme for structure, not effectiveTheme.
    const source = readFileSync(new URL("../branding.tsx", import.meta.url), "utf8");
    expect(source).toContain("workspaceLayout(branding.theme)");
    expect(source).not.toContain("localStorage");
  });
});
