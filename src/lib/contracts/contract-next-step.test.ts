import { describe, expect, it } from "vitest";
import { contractNextStep, type NextStepInput } from "./contract-next-step";

const base: NextStepInput = {
  status: "draft",
  startsAt: "2026-11-10",
  endsAt: "2027-02-08",
  totalValue: 45000,
  hasBody: true,
  canUpdate: true,
  canTransition: true,
  canActivate: true,
  today: new Date(2026, 10, 10),
};

describe("contractNextStep", () => {
  it("rascunho completo envia para aprovação", () => {
    const s = contractNextStep(base);
    expect(s.stageIndex).toBe(0);
    expect(s.primary?.label).toBe("Enviar para aprovação");
    expect(s.primary?.disabledReason).toBeUndefined();
  });
  it("rascunho sem corpo fica bloqueado", () => {
    const s = contractNextStep({ ...base, hasBody: false });
    expect(s.primary?.disabledReason).toBe("Conclua os itens pendentes");
    expect(s.checklist.find((c) => c.label === "Corpo do contrato")?.done).toBe(false);
  });
  it("rascunho sem permissão de transição bloqueia", () => {
    expect(contractNextStep({ ...base, canTransition: false }).primary?.disabledReason).toBe(
      "Sem permissão",
    );
  });
  it("em revisão leva às aprovações", () => {
    const s = contractNextStep({ ...base, status: "in_review" });
    expect(s.stageIndex).toBe(1);
    expect(s.primary?.target).toEqual({ kind: "tab", tab: "approvals" });
  });
  it("aguardando assinatura só ativa com permissão de ativação", () => {
    const s = contractNextStep({ ...base, status: "awaiting_signature", canActivate: false });
    expect(s.stageIndex).toBe(2);
    expect(s.secondary[0].disabledReason).toBe("Sem permissão");
  });
  it("ativo longe do fim registra medição", () => {
    const s = contractNextStep({ ...base, status: "active" });
    expect(s.primary?.target).toEqual({ kind: "measurements" });
    expect(s.explanation).toContain("faltam 90 dias");
  });
  it("ativo a 30 dias do fim sugere renovar", () => {
    const s = contractNextStep({ ...base, status: "active", endsAt: "2026-12-10" });
    expect(s.primary?.label).toBe("Renovar");
  });
  it("encerrado não tem ação principal", () => {
    expect(contractNextStep({ ...base, status: "ended" }).primary).toBeNull();
  });
});

describe("contract next step — legacy (LEGADO-REGULARIZA)", () => {
  const base = {
    status: "draft",
    startsAt: null,
    endsAt: null,
    totalValue: 0,
    hasBody: true,
    canUpdate: true,
    canTransition: true,
    canActivate: true,
    today: new Date("2026-11-19T12:00:00"),
  };
  it("pending legacy never offers approval/signature", () => {
    const s = contractNextStep({ ...base, legacy: "pending" });
    expect(s.primary?.label).toBe("Revisar e regularizar");
    expect(JSON.stringify(s)).not.toMatch(/aprovação"|Enviar para aprovação|Acompanhar assinatura/);
  });
  it("unknown legacy hides approval instead of assuming a normal contract", () => {
    expect(contractNextStep({ ...base, legacy: "unknown" }).primary).toBeNull();
  });
  it("eligible draft offers explicit recognition", () => {
    const s = contractNextStep({ ...base, legacyEligible: true });
    expect(s.secondary.map((x) => x.label)).toContain("Reconhecer contrato legado");
  });
  it("regularized legacy keeps the canonical status flow without retroactive commercial steps", () => {
    const s = contractNextStep({ ...base, status: "active", legacy: "regularized" });
    expect(s.headline).toBe("Contrato em vigor");
    expect(s.explanation).toMatch(/aditivo/);
  });
});
