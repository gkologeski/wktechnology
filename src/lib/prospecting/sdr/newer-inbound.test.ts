import { describe, expect, it } from "vitest";
import { shouldRequeueForNewerInbound as f } from "./newer-inbound";

const base = {
  kind: "reply",
  lastReadInboundAt: "2026-11-04T12:57:20Z",
  latestInboundAt: "2026-11-04T12:57:37Z",
  requeues: 0,
  hadEffects: false,
};
describe("shouldRequeueForNewerInbound", () => {
  it("cartão chegou durante a geração → refaz", () => expect(f(base)).toBe(true));
  it("sem mensagem nova → envia", () =>
    expect(f({ ...base, latestInboundAt: base.lastReadInboundAt })).toBe(false));
  it("limite de 2 refações", () => expect(f({ ...base, requeues: 2 })).toBe(false));
  it("com efeito de ferramenta não refaz", () => expect(f({ ...base, hadEffects: true })).toBe(false));
  it("retomada não refaz", () => expect(f({ ...base, kind: "follow_up" })).toBe(false));
});
