import { describe, expect, it } from "vitest";
import { effectiveState, parseSituation, stateJobIds } from "./conversation-state";

describe("estado efetivo da conversa", () => {
  it("itens que dependem de mensagem nossa só valem se o turno foi enviado", () => {
    const raw = {
      referral_asked: { at: "t", job_id: "j1" },
      closed: { at: "t", job_id: "j2", reason: "no_demand" as const },
      confirmed_name: { at: "t", job_id: "j3", name: "Ana", message_id: "m1" },
    };
    expect(stateJobIds(raw).sort()).toEqual(["j1", "j2"]);
    const s = effectiveState(raw, new Set(["j1"]));
    expect(s.referral_asked).toBeTruthy();
    expect(s.closed).toBeNull();
    // Fato do cliente vale mesmo sem envio.
    expect(s.confirmed_name?.name).toBe("Ana");
  });
  it("encerramento antigo registrado no atendimento vira estado, sem backfill", () => {
    expect(effectiveState({}, new Set(), { cancel_reason: "not_this_person" }).closed?.reason).toBe(
      "not_target",
    );
    expect(effectiveState({}, new Set(), { cancel_reason: "opt_out" }).closed).toBeUndefined();
    expect(
      effectiveState({}, new Set(), { cancel_reason: "asked_contact_source" }).contact_source_asked,
    ).toBeTruthy();
  });
  it("situação inválida da IA cai no padrão seguro", () => {
    const s = parseSituation({
      suppress_reply: "qualquer",
      conversation: "closed",
      close_reason: 3,
    });
    expect(s.suppress_reply).toBe("none");
    expect(s.conversation).toBe("closed");
    expect(s.close_reason).toBe("none");
  });
});
