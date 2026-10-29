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

describe("indicação escrita pelo cliente", () => {
  it("e-mail com tratamento antes: nome sem 'Sr.' e e-mail válido", async () => {
    const { parseSharedEmail, cleanPersonName } = await import("./conversation-state");
    const text =
      "Olá Bruna, tudo bem ?\nsou responsável pelos times de desenvolvimento, teste e produto\nsobre infraestrutura, o responsável é o Sr. Bruno bruno@dsin.com.br";
    expect(parseSharedEmail(text)).toEqual({ name: "Bruno", email: "bruno@dsin.com.br" });
    expect(cleanPersonName("Dra. Ana Lima")).toBe("Ana Lima");
  });
  it("texto sem e-mail válido não vira indicação", async () => {
    const { parseSharedEmail } = await import("./conversation-state");
    expect(parseSharedEmail("me chama no @bruno do instagram")).toBeNull();
    expect(parseSharedEmail("fala com o João do financeiro")).toBeNull();
  });
});
