import { describe, expect, it } from "vitest";
import { splitReferralName } from "./third-party";

describe("splitReferralName", () => {
  it("remove empresa e cargo do cartão", () => {
    expect(splitReferralName("Thiago City Gerente TI", "City Connect BR")).toEqual({
      name: "Thiago",
      role: "Gerente TI",
    });
  });
  it("preserva sobrenome real", () => {
    expect(splitReferralName("Daniel Flamia", "Acme Ltda")).toEqual({ name: "Daniel Flamia", role: null });
  });
  it("sem empresa retira só o cargo", () => {
    expect(splitReferralName("Ana Souza Diretora de TI")).toEqual({ name: "Ana Souza", role: "Diretora de TI" });
  });
});

import { thanksReferral } from "./turn";

describe("thanksReferral", () => {
  const i = {
    history: [
      { id: "1", direction: "outbound", body: "Para quem devo falar?", created_at: "2026-11-04T14:19:00Z" },
      { id: "2", direction: "inbound", body: "👤 Contato compartilhado\nThiago City Gerente TI: +55 24 98182-0188", created_at: "2026-11-04T14:21:00Z" },
    ],
  } as never;
  const out = { situation: { referral_name: "Thiago City Gerente TI" } } as never;
  it("reprova agradecer pelo nome do indicado", () => {
    expect(thanksReferral("Obrigada, Thiago City! Vou falar com o Thiago.", out, i)).toBe(true);
  });
  it("aprova agradecer a quem indicou", () => {
    expect(thanksReferral("Obrigada, Marcelo! Vou falar com o Thiago.", out, i)).toBe(false);
  });
});
