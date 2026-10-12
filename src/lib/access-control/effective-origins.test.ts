import { describe, expect, it } from "vitest";
import { computeEffectiveOrigins, governanceWarnings, isReadOnlyRole } from "./effective-origins";
import { dependencyViolations, missingDependencies } from "./permission-dependencies";

const role = (name: string, setKeys: string[], grants: string[] = [], denies: string[] = []) => ({
  id: name,
  name,
  setKeys,
  grants,
  denies,
});

describe("permissão efetiva e origens", () => {
  it("deny de um cargo prevalece sobre a concessão de outro cargo da mesma pessoa", () => {
    const o = computeEffectiveOrigins({
      isActive: true,
      isAdminBypass: false,
      roles: [role("A", ["k.x.view.own"]), role("B", [], [], ["k.x.view.own"])],
      extraSets: [],
    });
    expect(o[0]).toMatchObject({ effective: false, deniedBy: ["B"] });
  });

  it("membro inativo não tem nenhuma permissão, nem com bypass de admin", () => {
    const o = computeEffectiveOrigins({
      isActive: false,
      isAdminBypass: true,
      roles: [role("A", ["k.x.view.own"])],
      extraSets: [],
    });
    expect(o.every((x) => !x.effective)).toBe(true);
  });

  it("cargo somente leitura em admin gera aviso sem rebaixar", () => {
    const input = {
      isActive: true,
      isAdminBypass: true,
      roles: [role("Auditor", ["a.b.view.workspace", "a.b.export.workspace"])],
      extraSets: [],
    };
    expect(isReadOnlyRole(input.roles[0])).toBe(true);
    expect(governanceWarnings(input).map((w) => w.kind)).toContain("admin_readonly_role");
  });
});

describe("dependências de perfis de vaga", () => {
  it("comercial sem a chave de ver perfis é inconsistente", () => {
    expect(missingDependencies(["techsales.role_profiles_commercial.view.workspace"])).toEqual([
      {
        key: "techsales.role_profiles_commercial.view.workspace",
        requires: "techsales.role_profiles.view.workspace",
      },
    ]);
  });

  it("bloqueia conceder aprovar sem ver, mas não bloqueia inconsistência antiga", () => {
    const current = ["techsales.role_profiles_commercial.view.workspace"];
    expect(
      dependencyViolations(current, ["techsales.role_profiles.approve.workspace"], true),
    ).toHaveLength(1);
    expect(dependencyViolations(current, ["techsales.leads.view.own"], true)).toHaveLength(0);
  });

  it("bloqueia revogar ver enquanto criar continua concedido", () => {
    const current = [
      "techsales.role_profiles.view.workspace",
      "techsales.role_profiles.create.workspace",
    ];
    expect(
      dependencyViolations(current, ["techsales.role_profiles.view.workspace"], false),
    ).toEqual([
      {
        key: "techsales.role_profiles.create.workspace",
        requires: "techsales.role_profiles.view.workspace",
      },
    ]);
  });
});
