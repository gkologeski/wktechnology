// Cobertura do catálogo de permissões nos itens de menu.
// Garante que a matriz de ações do diagnóstico de RBAC cubra 100% dos itens
// (exceto os exclusivos de plataforma e os da conta pessoal do usuário).
import { describe, expect, it } from "vitest";
import { auditMenus } from "./menu-audit";
import { permsForRole } from "./menu-config";

const rows = auditMenus(permsForRole("member"));

describe("cobertura de permissões no menu", () => {
  it("todo item não-plataforma e não-pessoal tem recursos mapeados", () => {
    const uncovered = rows
      .filter((r) => !r.platformOnly && !r.personal)
      .filter((r) => r.resources.length === 0 && r.permissionAny.length === 0)
      .map((r) => `${r.area} › ${r.title} (${r.url})`);
    expect(uncovered).toEqual([]);
  });

  it("itens de plataforma continuam apenas por papel", () => {
    const platform = rows.filter((r) => r.platformOnly);
    expect(platform.length).toBeGreaterThan(0);
    for (const r of platform) {
      expect(r.need).toBe("platform");
      expect(r.resources).toEqual([]);
    }
  });

  it("recursos declarados seguem o formato modulo.recurso", () => {
    for (const r of rows) {
      for (const res of r.resources) {
        expect(res).toMatch(/^[a-z]+\.[a-z0-9_.]+$/);
      }
    }
  });
});
