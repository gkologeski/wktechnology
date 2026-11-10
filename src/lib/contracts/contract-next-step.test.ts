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
