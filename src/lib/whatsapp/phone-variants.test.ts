import { describe, expect, it } from "vitest";
import { brPhoneVariants, pickWindowConversation } from "./phone-variants";

describe("janela de 24 h por celular brasileiro", () => {
  it("trata com e sem o nono dígito como o mesmo celular", () => {
    expect(brPhoneVariants("+5548991104003")).toEqual(["+5548991104003", "+554891104003"]);
    expect(brPhoneVariants("+554891104003")).toEqual(["+554891104003", "+5548991104003"]);
  });
  it("não altera número fixo nem estrangeiro", () => {
    expect(brPhoneVariants("+554833334444")).toEqual(["+554833334444"]);
    expect(brPhoneVariants("+14155238886")).toEqual(["+14155238886"]);
  });
  it("conversa antiga sem recebimento não fecha a janela da conversa atual", () => {
    const recent = new Date(Date.now() - 60_000).toISOString();
    const best = pickWindowConversation([
      { id: "antiga", last_inbound_at: null, last_message_at: "2026-06-07T23:52:41Z" },
      { id: "meta", last_inbound_at: recent, last_message_at: recent },
    ]);
    expect(best?.id).toBe("meta");
  });
});
