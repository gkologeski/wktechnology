// Unit tests para helpers de entitlements (plano + limites).
import { describe, it, expect } from "vitest";
import { ENT, PLAN_RANK, PLAN_LABELS, minPlanFor, type PlanCode } from "./entitlements";

type Row = { plan_code: PlanCode; enabled: boolean; limit_int: number | null };
const rows = (...r: Row[]) => r;

describe("PLAN_RANK / PLAN_LABELS", () => {
  it("ordena planos do menor para o maior", () => {
    expect(PLAN_RANK.free).toBe(0);
    expect(PLAN_RANK.bronze).toBeLessThan(PLAN_RANK.prata);
    expect(PLAN_RANK.prata).toBeLessThan(PLAN_RANK.ouro);
  });

  it("tem label para cada plano", () => {
    for (const code of ["free", "bronze", "prata", "ouro"] as PlanCode[]) {
      expect(PLAN_LABELS[code]).toBeTruthy();
    }
  });
});

describe("minPlanFor", () => {
  it("retorna null quando nenhum plano habilita a key", () => {
    const map = {
      [ENT.QUOTES]: rows(
        { plan_code: "free", enabled: false, limit_int: null },
        { plan_code: "bronze", enabled: false, limit_int: null },
      ),
    };
    expect(minPlanFor(map, ENT.QUOTES)).toBeNull();
  });

  it("retorna o menor plano que habilita a feature", () => {
    const map = {
      [ENT.QUOTES]: rows(
        { plan_code: "ouro", enabled: true, limit_int: null },
        { plan_code: "prata", enabled: true, limit_int: null },
        { plan_code: "bronze", enabled: false, limit_int: null },
      ),
    };
    expect(minPlanFor(map, ENT.QUOTES)).toBe("prata");
  });

  it("trata limit_int=0 como NÃO habilitado", () => {
    const map = {
      [ENT.LEADS_MAX]: rows(
        { plan_code: "free", enabled: true, limit_int: 0 },
        { plan_code: "bronze", enabled: true, limit_int: 100 },
      ),
    };
    expect(minPlanFor(map, ENT.LEADS_MAX)).toBe("bronze");
  });

  it("trata limit_int=null como ilimitado e válido", () => {
    const map = {
      [ENT.LEADS_MAX]: rows({ plan_code: "free", enabled: true, limit_int: null }),
    };
    expect(minPlanFor(map, ENT.LEADS_MAX)).toBe("free");
  });

  it("retorna null para key inexistente no mapa", () => {
    expect(minPlanFor({}, ENT.QUOTES)).toBeNull();
  });
});
