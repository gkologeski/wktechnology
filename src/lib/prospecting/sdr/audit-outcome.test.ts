import { describe, expect, it } from "vitest";
import {
  AUDIT_MAX_REGENERATIONS,
  auditHandoffReason,
  auditRecord,
  unsendableAction,
} from "./audit-outcome";
import { followUpDeadline, nextSendableAt } from "./policy";

describe("auditoria automática sem supervisão", () => {
  it("a IA refaz a mensagem até 3 vezes", () => {
    expect(AUDIT_MAX_REGENERATIONS).toBe(3);
  });

  it("resposta que não pode sair passa para um humano; nunca vira rascunho", () => {
    expect(unsendableAction("reply", "price")).toBe("handoff");
    expect(unsendableAction("reply", "repetition_detected")).toBe("handoff");
    expect(unsendableAction("reply", "provider_failed", "technical")).toBe("handoff");
  });

  it("retomada que não pode sair é descartada; fora do horário é reagendada", () => {
    expect(unsendableAction("follow_up", "price")).toBe("discard");
    expect(unsendableAction("follow_up", "followup_repetition")).toBe("discard");
    expect(unsendableAction("follow_up", "followup_quota", "prospecting")).toBe("discard");
    expect(unsendableAction("follow_up", "followup_hours", "prospecting")).toBe("reschedule");
  });

  it("trabalho obsoleto é descartado e envio incerto fica para reconciliar", () => {
    expect(unsendableAction("reply", "owner_not_ai")).toBe("discard");
    expect(unsendableAction("reply", "stale_version")).toBe("discard");
    expect(unsendableAction("reply", "uncertain_after_send", "reconcile")).toBe("keep_failed");
  });

  it("motivo da passagem para humano explica as regras em português", () => {
    expect(auditHandoffReason(["price", "price"])).toBe(
      "Auditoria automática: a resposta citava valores e o agente não pode informar preços. Responda o cliente pela Inbox.",
    );
  });

  it("só registra quando a auditoria agiu", () => {
    expect(auditRecord({ regenerations: 0, reasons: [], outcome: "sent" })).toBeNull();
    expect(auditRecord({ regenerations: 1, reasons: ["price", "price"], outcome: "sent" })).toEqual(
      { regenerations: 1, reasons: ["price"], outcome: "sent" },
    );
  });
});

describe("reagendamento da retomada", () => {
  it("próximo horário permitido após o silêncio das 20h às 8h (São Paulo)", () => {
    // 23:10 em São Paulo (UTC-3) = 02:10 UTC do dia seguinte.
    const at = nextSendableAt(new Date("2026-11-03T02:10:00Z"), "America/Sao_Paulo", 20, 8);
    expect(at.toISOString()).toBe("2026-11-03T11:00:00.000Z");
  });

  it("prazo da retomada: 24 h após a última mensagem do cliente, menos 1 h", () => {
    expect(followUpDeadline("2026-11-02T10:00:00Z")?.toISOString()).toBe(
      "2026-11-03T09:00:00.000Z",
    );
    expect(followUpDeadline(null)).toBeNull();
  });
});
